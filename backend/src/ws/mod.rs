use axum::extract::{ws::WebSocketUpgrade, State};
use axum::response::Response;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod handlers;
pub use handlers::*;

use crate::AppState;

#[derive(Debug, Clone)]
pub struct Hub {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

#[derive(Debug, Clone)]
struct Room {
    id: String,
    sender: broadcast::Sender<Message>,
    connections: Arc<RwLock<HashMap<String, Connection>>>,
}

#[derive(Debug, Clone)]
struct Connection {
    id: String,
    user_id: Option<String>,
    room_id: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum Message {
    #[serde(rename = "widget_update")]
    WidgetUpdate {
        widget_id: String,
        data: serde_json::Value,
    },
    #[serde(rename = "widget_delete")]
    WidgetDelete {
        widget_id: String,
    },
    #[serde(rename = "dashboard_update")]
    DashboardUpdate {
        dashboard_id: String,
        layout: serde_json::Value,
    },
    #[serde(rename = "user_joined")]
    UserJoined {
        user_id: String,
    },
    #[serde(rename = "user_left")]
    UserLeft {
        user_id: String,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn join_room(&self, room_id: &str, connection_id: String, user_id: Option<String>) -> broadcast::Receiver<Message> {
        let mut rooms = self.rooms.write().await;
        
        let room = rooms.entry(room_id.to_string()).or_insert_with(|| {
            let (sender, _) = broadcast::channel(1000);
            Room {
                id: room_id.to_string(),
                sender,
                connections: Arc::new(RwLock::new(HashMap::new())),
            }
        });

        let connection = Connection {
            id: connection_id.clone(),
            user_id: user_id.clone(),
            room_id: room_id.to_string(),
        };

        room.connections.write().await.insert(connection_id, connection);
        
        if let Some(uid) = user_id {
            let _ = room.sender.send(Message::UserJoined { user_id: uid });
        }
        
        room.sender.subscribe()
    }

    pub async fn leave_room(&self, room_id: &str, connection_id: &str) {
        let rooms = self.rooms.read().await;
        
        if let Some(room) = rooms.get(room_id) {
            let mut connections = room.connections.write().await;
            
            if let Some(connection) = connections.remove(connection_id) {
                if let Some(user_id) = connection.user_id {
                    let _ = room.sender.send(Message::UserLeft { user_id });
                }
            }
        }
    }

    pub async fn broadcast_to_room(&self, room_id: &str, message: Message) {
        let rooms = self.rooms.read().await;
        
        if let Some(room) = rooms.get(room_id) {
            if let Err(e) = room.sender.send(message) {
                warn!("Failed to broadcast message to room {}: {}", room_id, e);
            }
        }
    }

    pub async fn broadcast_widget_update(&self, user_id: &str, widget_id: &str, data: serde_json::Value) {
        let message = Message::WidgetUpdate {
            widget_id: widget_id.to_string(),
            data,
        };
        
        // Broadcast to user's personal room
        let room_id = format!("user:{}", user_id);
        self.broadcast_to_room(&room_id, message).await;
    }

    pub async fn broadcast_widget_delete(&self, user_id: &str, widget_id: &str) {
        let message = Message::WidgetDelete {
            widget_id: widget_id.to_string(),
        };
        
        // Broadcast to user's personal room
        let room_id = format!("user:{}", user_id);
        self.broadcast_to_room(&room_id, message).await;
    }

    pub async fn broadcast_dashboard_update(&self, user_id: &str, dashboard_id: &str, layout: serde_json::Value) {
        let message = Message::DashboardUpdate {
            dashboard_id: dashboard_id.to_string(),
            layout,
        };
        
        // Broadcast to user's personal room
        let room_id = format!("user:{}", user_id);
        self.broadcast_to_room(&room_id, message).await;
    }

    pub async fn cleanup_empty_rooms(&self) {
        let mut rooms = self.rooms.write().await;
        
        let empty_rooms: Vec<String> = {
            let mut empty = Vec::new();
            for (room_id, room) in rooms.iter() {
                let connections = room.connections.read().await;
                if connections.is_empty() {
                    empty.push(room_id.clone());
                }
            }
            empty
        };
        
        for room_id in empty_rooms {
            rooms.remove(&room_id);
            debug!("Removed empty room: {}", room_id);
        }
    }

    pub async fn get_room_stats(&self) -> HashMap<String, usize> {
        let rooms = self.rooms.read().await;
        let mut stats = HashMap::new();
        
        for (room_id, room) in rooms.iter() {
            let connections = room.connections.read().await;
            stats.insert(room_id.clone(), connections.len());
        }
        
        stats
    }
}

pub async fn upgrade_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(
    socket: axum::extract::ws::WebSocket,
    state: AppState,
) {
    let connection_id = Uuid::new_v4().to_string();
    info!("WebSocket connection established: {}", connection_id);
    
    if let Err(e) = handle_socket_inner(socket, state, connection_id.clone()).await {
        error!("WebSocket error for connection {}: {}", connection_id, e);
    }
    
    info!("WebSocket connection closed: {}", connection_id);
}

async fn handle_socket_inner(
    socket: axum::extract::ws::WebSocket,
    state: AppState,
    connection_id: String,
) -> Result<(), Box<dyn std::error::Error>> {
    use axum::extract::ws::{Message as WsMessage, CloseFrame};
    use futures_util::{SinkExt, StreamExt};
    
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let mut current_room: Option<String> = None;
    let mut broadcast_receiver: Option<broadcast::Receiver<Message>> = None;
    
    // Handle incoming WebSocket messages
    let state_clone = state.clone();
    let connection_id_clone = connection_id.clone();
    
    let receive_task = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(WsMessage::Text(text)) => {
                    debug!("Received WebSocket message: {}", text);
                    
                    // Parse the message
                    if let Ok(parsed_message) = serde_json::from_str::<IncomingMessage>(&text) {
                        match parsed_message {
                            IncomingMessage::Join { room_id, user_id } => {
                                // Join a room (typically user's personal room)
                                let receiver = state_clone.ws_hub.join_room(&room_id, connection_id_clone.clone(), user_id).await;
                                current_room = Some(room_id.clone());
                                broadcast_receiver = Some(receiver);
                                info!("Connection {} joined room: {}", connection_id_clone, room_id);
                            }
                            IncomingMessage::Ping => {
                                // Handle ping - pong will be sent in the broadcast loop
                                if let Some(room_id) = &current_room {
                                    state_clone.ws_hub.broadcast_to_room(room_id, Message::Pong).await;
                                }
                            }
                        }
                    } else {
                        warn!("Failed to parse WebSocket message: {}", text);
                    }
                }
                Ok(WsMessage::Close(close_frame)) => {
                    if let Some(CloseFrame { code, reason }) = close_frame {
                        info!("WebSocket closed with code {} and reason: {}", code, reason);
                    } else {
                        info!("WebSocket closed without close frame");
                    }
                    break;
                }
                Ok(WsMessage::Ping(data)) => {
                    // Respond to ping with pong
                    // This is handled automatically by axum
                    debug!("Received ping with {} bytes", data.len());
                }
                Ok(WsMessage::Pong(_)) => {
                    // Handle pong
                    debug!("Received pong");
                }
                Ok(WsMessage::Binary(_)) => {
                    warn!("Received binary message, ignoring");
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
            }
        }
        
        // Clean up when receiver task ends
        if let Some(room_id) = current_room {
            state_clone.ws_hub.leave_room(&room_id, &connection_id_clone).await;
        }
    });
    
    // Handle outgoing messages (broadcasts from the hub)
    let send_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        
        loop {
            tokio::select! {
                // Handle broadcast messages
                msg = async {
                    if let Some(ref mut receiver) = broadcast_receiver {
                        receiver.recv().await
                    } else {
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                        Err(broadcast::error::RecvError::Closed)
                    }
                } => {
                    match msg {
                        Ok(message) => {
                            let json = serde_json::to_string(&message).unwrap_or_else(|_| "null".to_string());
                            if ws_sender.send(WsMessage::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(skipped)) => {
                            warn!("WebSocket receiver lagged, skipped {} messages", skipped);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            // Channel closed, continue to next iteration
                        }
                    }
                }
                
                // Send periodic pings
                _ = interval.tick() => {
                    if ws_sender.send(WsMessage::Ping(vec![])).await.is_err() {
                        break;
                    }
                }
            }
        }
    });
    
    // Wait for either task to complete
    tokio::select! {
        _ = receive_task => {},
        _ = send_task => {},
    }
    
    Ok(())
}

#[derive(Debug, serde::Deserialize)]
#[serde(tag = "type")]
enum IncomingMessage {
    #[serde(rename = "join")]
    Join {
        room_id: String,
        user_id: Option<String>,
    },
    #[serde(rename = "ping")]
    Ping,
}