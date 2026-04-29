use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade}, State},
    response::Response,
    http::StatusCode,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
};
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub mod handlers;

use handlers::*;

#[derive(Debug, Clone)]
pub struct Client {
    pub id: String,
    pub user_id: Option<String>,
    pub sender: broadcast::Sender<String>,
}

#[derive(Debug, Clone)]
pub struct Hub {
    clients: Arc<RwLock<HashMap<String, Client>>>,
    broadcast_tx: broadcast::Sender<String>,
}

impl Hub {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(1000);
        
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
        }
    }
    
    pub async fn add_client(&self, client_id: String, user_id: Option<String>) -> broadcast::Receiver<String> {
        let (sender, _) = broadcast::channel(100);
        let receiver = self.broadcast_tx.subscribe();
        
        let client = Client {
            id: client_id.clone(),
            user_id: user_id.clone(),
            sender,
        };
        
        self.clients.write().await.insert(client_id.clone(), client);
        
        if let Some(user_id) = &user_id {
            info!("Client {} connected for user: {}", client_id, user_id);
        } else {
            info!("Anonymous client {} connected", client_id);
        }
        
        receiver
    }
    
    pub async fn remove_client(&self, client_id: &str) {
        if let Some(client) = self.clients.write().await.remove(client_id) {
            if let Some(user_id) = &client.user_id {
                info!("Client {} disconnected for user: {}", client_id, user_id);
            } else {
                info!("Anonymous client {} disconnected", client_id);
            }
        }
    }
    
    pub async fn broadcast(&self, message: &str) {
        debug!("Broadcasting message to {} clients", self.clients.read().await.len());
        
        if let Err(e) = self.broadcast_tx.send(message.to_string()) {
            error!("Failed to broadcast message: {}", e);
        }
    }
    
    pub async fn send_to_user(&self, user_id: &str, message: &str) {
        let clients = self.clients.read().await;
        let user_clients: Vec<_> = clients
            .values()
            .filter(|client| {
                client.user_id.as_ref().map_or(false, |uid| uid == user_id)
            })
            .collect();
        
        debug!("Sending message to {} clients for user: {}", user_clients.len(), user_id);
        
        for client in user_clients {
            if let Err(e) = client.sender.send(message.to_string()) {
                warn!("Failed to send message to client {}: {}", client.id, e);
            }
        }
    }
    
    pub async fn get_connected_users(&self) -> Vec<String> {
        self.clients
            .read()
            .await
            .values()
            .filter_map(|client| client.user_id.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect()
    }
    
    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "ping")]
    Ping { timestamp: i64 },
    
    #[serde(rename = "pong")]
    Pong { timestamp: i64 },
    
    #[serde(rename = "auth")]
    Auth { token: String },
    
    #[serde(rename = "item_created")]
    ItemCreated {
        item_id: String,
        workspace_id: String,
        title: String,
        item_type: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "item_updated")]
    ItemUpdated {
        item_id: String,
        title: Option<String>,
        content: Option<String>,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "item_deleted")]
    ItemDeleted {
        item_id: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "workspace_created")]
    WorkspaceCreated {
        workspace_id: String,
        name: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "workspace_updated")]
    WorkspaceUpdated {
        workspace_id: String,
        name: Option<String>,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "workspace_deleted")]
    WorkspaceDeleted {
        workspace_id: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "widget_created")]
    WidgetCreated {
        widget_id: String,
        title: String,
        widget_type: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "widget_updated")]
    WidgetUpdated {
        widget_id: String,
        title: Option<String>,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "widget_deleted")]
    WidgetDeleted {
        widget_id: String,
        user_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "notification")]
    Notification {
        id: String,
        title: String,
        message: String,
        level: String, // info, warning, error, success
        timestamp: i64,
    },
    
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
        timestamp: i64,
    },
}

impl WebSocketMessage {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
    
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
    
    pub fn ping() -> Self {
        Self::Ping {
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
    
    pub fn pong() -> Self {
        Self::Pong {
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
    
    pub fn error(code: &str, message: &str) -> Self {
        Self::Error {
            code: code.to_string(),
            message: message.to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
    
    pub fn notification(title: &str, message: &str, level: &str) -> Self {
        Self::Notification {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            message: message.to_string(),
            level: level.to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
}

use crate::AppState;

pub async fn upgrade_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Result<Response, StatusCode> {
    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state)))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let client_id = Uuid::new_v4().to_string();
    let mut user_id: Option<String> = None;
    
    // Add client to hub
    let mut receiver = state.ws_hub.add_client(client_id.clone(), None).await;
    
    let (mut sender, mut receiver_ws) = socket.split();
    
    // Spawn task to handle outgoing messages
    let client_id_clone = client_id.clone();
    let hub_clone = state.ws_hub.clone();
    let outgoing_task = tokio::spawn(async move {
        while let Ok(message) = receiver.recv().await {
            if let Err(e) = sender.send(axum::extract::ws::Message::Text(message)).await {
                error!("Failed to send message to client {}: {}", client_id_clone, e);
                break;
            }
        }
        
        hub_clone.remove_client(&client_id_clone).await;
    });
    
    // Handle incoming messages
    while let Some(message) = receiver_ws.next().await {
        match message {
            Ok(axum::extract::ws::Message::Text(text)) => {
                if let Err(e) = handle_message(&text, &client_id, &mut user_id, &state).await {
                    error!("Error handling WebSocket message: {}", e);
                    
                    let error_msg = WebSocketMessage::error("message_error", "Failed to process message");
                    if let Ok(error_json) = error_msg.to_json() {
                        if let Err(send_err) = sender.send(axum::extract::ws::Message::Text(error_json)).await {
                            error!("Failed to send error message: {}", send_err);
                            break;
                        }
                    }
                }
            }
            Ok(axum::extract::ws::Message::Binary(_)) => {
                warn!("Received binary message from client {}, ignoring", client_id);
            }
            Ok(axum::extract::ws::Message::Close(_)) => {
                info!("Client {} closed connection", client_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error for client {}: {}", client_id, e);
                break;
            }
            _ => {}
        }
    }
    
    // Cleanup
    outgoing_task.abort();
    state.ws_hub.remove_client(&client_id).await;
}

async fn handle_message(
    text: &str,
    client_id: &str,
    user_id: &mut Option<String>,
    state: &AppState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let message = WebSocketMessage::from_json(text)?;
    
    match message {
        WebSocketMessage::Ping { timestamp: _ } => {
            let pong = WebSocketMessage::pong();
            if let Ok(pong_json) = pong.to_json() {
                state.ws_hub.broadcast(&pong_json).await;
            }
        }
        
        WebSocketMessage::Auth { token } => {
            match crate::auth::jwt::extract_user_id(&token, &state.config.jwt_secret) {
                Ok(uid) => {
                    *user_id = Some(uid.clone());
                    
                    // Update client with user_id
                    state.ws_hub.remove_client(client_id).await;
                    let _receiver = state.ws_hub.add_client(client_id.to_string(), Some(uid.clone())).await;
                    
                    info!("Client {} authenticated as user: {}", client_id, uid);
                    
                    let notification = WebSocketMessage::notification(
                        "Connected",
                        "Successfully connected to BentoBoard",
                        "success"
                    );
                    if let Ok(notification_json) = notification.to_json() {
                        state.ws_hub.send_to_user(&uid, &notification_json).await;
                    }
                }
                Err(e) => {
                    error!("Authentication failed for client {}: {}", client_id, e);
                    let error_msg = WebSocketMessage::error("auth_failed", "Invalid or expired token");
                    if let Ok(error_json) = error_msg.to_json() {
                        state.ws_hub.broadcast(&error_json).await;
                    }
                }
            }
        }
        
        _ => {
            warn!("Received unexpected message type from client {}", client_id);
        }
    }
    
    Ok(())
}