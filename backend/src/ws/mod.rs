use axum::{extract::ws::{WebSocket, WebSocketUpgrade}, response::Response, extract::State};
use tokio::sync::{broadcast, RwLock};
use std::collections::HashMap;
use std::sync::Arc;
use serde_json::Value;
use uuid::Uuid;
use tracing::{info, error, warn};
use futures_util::{SinkExt, StreamExt};

mod handlers;

pub use handlers::*;

#[derive(Debug, Clone)]
pub struct Connection {
    pub id: String,
    pub user_id: Option<String>,
    pub sender: broadcast::Sender<Value>,
}

#[derive(Debug, Clone)]
pub struct Hub {
    connections: Arc<RwLock<HashMap<String, Connection>>>,
    user_connections: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            user_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection(&self, connection_id: String, user_id: Option<String>) -> broadcast::Receiver<Value> {
        let (sender, receiver) = broadcast::channel(256);
        
        let connection = Connection {
            id: connection_id.clone(),
            user_id: user_id.clone(),
            sender,
        };

        // Store connection
        self.connections.write().await.insert(connection_id.clone(), connection);

        // Map user to connection if authenticated
        if let Some(uid) = user_id {
            let mut user_conns = self.user_connections.write().await;
            user_conns.entry(uid).or_insert_with(Vec::new).push(connection_id.clone());
        }

        info!("WebSocket connection added: {} for user: {:?}", connection_id, user_id);
        receiver
    }

    pub async fn remove_connection(&self, connection_id: &str) {
        // Get connection to find user_id
        let connection = self.connections.write().await.remove(connection_id);
        
        if let Some(conn) = connection {
            if let Some(user_id) = &conn.user_id {
                // Remove from user connections
                let mut user_conns = self.user_connections.write().await;
                if let Some(conns) = user_conns.get_mut(user_id) {
                    conns.retain(|id| id != connection_id);
                    if conns.is_empty() {
                        user_conns.remove(user_id);
                    }
                }
            }
            info!("WebSocket connection removed: {} for user: {:?}", connection_id, conn.user_id);
        }
    }

    pub async fn broadcast_to_user(&self, user_id: &str, message: Value) {
        let user_conns = self.user_connections.read().await;
        if let Some(connection_ids) = user_conns.get(user_id) {
            let connections = self.connections.read().await;
            
            for conn_id in connection_ids {
                if let Some(connection) = connections.get(conn_id) {
                    if let Err(e) = connection.sender.send(message.clone()) {
                        warn!("Failed to send message to connection {}: {}", conn_id, e);
                    }
                }
            }
        }
    }

    pub async fn broadcast_to_all(&self, message: Value) {
        let connections = self.connections.read().await;
        
        for (conn_id, connection) in connections.iter() {
            if let Err(e) = connection.sender.send(message.clone()) {
                warn!("Failed to send broadcast message to connection {}: {}", conn_id, e);
            }
        }
    }

    pub async fn get_connection_count(&self) -> usize {
        self.connections.read().await.len()
    }

    pub async fn get_user_connection_count(&self, user_id: &str) -> usize {
        self.user_connections
            .read()
            .await
            .get(user_id)
            .map(|conns| conns.len())
            .unwrap_or(0)
    }

    pub async fn is_user_online(&self, user_id: &str) -> bool {
        self.user_connections.read().await.contains_key(user_id)
    }

    pub async fn get_online_users(&self) -> Vec<String> {
        self.user_connections.read().await.keys().cloned().collect()
    }
}

pub async fn upgrade_handler(
    ws: WebSocketUpgrade,
    State(state): State<crate::AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: crate::AppState) {
    let connection_id = Uuid::new_v4().to_string();
    let mut receiver = state.ws_hub.add_connection(connection_id.clone(), None).await;
    
    let (mut sender, mut ws_receiver) = socket.split();
    
    // Task to handle incoming WebSocket messages
    let hub_clone = state.ws_hub.clone();
    let db_clone = state.db.clone();
    let connection_id_clone = connection_id.clone();
    
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(axum::extract::ws::Message::Text(text)) => {
                    if let Err(e) = handle_text_message(
                        text,
                        &connection_id_clone,
                        &hub_clone,
                        &db_clone,
                    ).await {
                        error!("Error handling WebSocket message: {}", e);
                    }
                }
                Ok(axum::extract::ws::Message::Binary(_)) => {
                    warn!("Binary messages not supported");
                }
                Ok(axum::extract::ws::Message::Close(_)) => {
                    info!("WebSocket connection {} closed", connection_id_clone);
                    break;
                }
                Err(e) => {
                    error!("WebSocket error for connection {}: {}", connection_id_clone, e);
                    break;
                }
                _ => {}
            }
        }
        
        hub_clone.remove_connection(&connection_id_clone).await;
    });
    
    // Task to handle outgoing messages
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = receiver.recv().await {
            let message_text = match serde_json::to_string(&msg) {
                Ok(text) => text,
                Err(e) => {
                    error!("Failed to serialize message: {}", e);
                    continue;
                }
            };
            
            if sender.send(axum::extract::ws::Message::Text(message_text)).await.is_err() {
                error!("Failed to send WebSocket message");
                break;
            }
        }
    });
    
    // Wait for either task to complete
    tokio::select! {
        _ = recv_task => {},
        _ = send_task => {},
    }
    
    // Cleanup
    state.ws_hub.remove_connection(&connection_id).await;
    info!("WebSocket handler completed for connection: {}", connection_id);
}

async fn handle_text_message(
    text: String,
    connection_id: &str,
    hub: &Hub,
    db: &Arc<crate::db::Db>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let message: Value = serde_json::from_str(&text)?;
    
    match message.get("type").and_then(|t| t.as_str()) {
        Some("auth") => {
            handle_auth_message(message, connection_id, hub, db).await?
        },
        Some("ping") => {
            handle_ping_message(connection_id, hub).await?
        },
        Some("subscribe") => {
            handle_subscribe_message(message, connection_id, hub).await?
        },
        Some("unsubscribe") => {
            handle_unsubscribe_message(message, connection_id, hub).await?
        },
        _ => {
            warn!("Unknown message type received: {}", text);
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};
    
    #[tokio::test]
    async fn test_hub_creation() {
        let hub = Hub::new();
        assert_eq!(hub.get_connection_count().await, 0);
    }
    
    #[tokio::test]
    async fn test_add_remove_connection() {
        let hub = Hub::new();
        let connection_id = "test_conn_1".to_string();
        
        let _receiver = hub.add_connection(connection_id.clone(), Some("user123".to_string())).await;
        assert_eq!(hub.get_connection_count().await, 1);
        assert!(hub.is_user_online("user123").await);
        
        hub.remove_connection(&connection_id).await;
        assert_eq!(hub.get_connection_count().await, 0);
        assert!(!hub.is_user_online("user123").await);
    }
    
    #[tokio::test]
    async fn test_user_connections() {
        let hub = Hub::new();
        let user_id = "user123";
        
        // Add multiple connections for same user
        let _recv1 = hub.add_connection("conn1".to_string(), Some(user_id.to_string())).await;
        let _recv2 = hub.add_connection("conn2".to_string(), Some(user_id.to_string())).await;
        
        assert_eq!(hub.get_user_connection_count(user_id).await, 2);
        assert!(hub.is_user_online(user_id).await);
        
        hub.remove_connection("conn1").await;
        assert_eq!(hub.get_user_connection_count(user_id).await, 1);
        assert!(hub.is_user_online(user_id).await);
        
        hub.remove_connection("conn2").await;
        assert_eq!(hub.get_user_connection_count(user_id).await, 0);
        assert!(!hub.is_user_online(user_id).await);
    }
    
    #[tokio::test]
    async fn test_broadcast_to_user() {
        let hub = Hub::new();
        let user_id = "user123";
        
        let mut receiver = hub.add_connection("conn1".to_string(), Some(user_id.to_string())).await;
        
        let message = serde_json::json!({"test": "message"});
        hub.broadcast_to_user(user_id, message.clone()).await;
        
        // Give a moment for the message to propagate
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        match receiver.try_recv() {
            Ok(received_msg) => {
                assert_eq!(received_msg, message);
            },
            Err(e) => {
                panic!("Failed to receive message: {}", e);
            }
        }
    }
}