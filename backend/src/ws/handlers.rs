use serde_json::Value;
use tracing::{info, error, warn};
use std::sync::Arc;
use crate::auth::validate_token;

use super::Hub;

pub async fn handle_auth_message(
    message: Value,
    connection_id: &str,
    hub: &Hub,
    db: &Arc<crate::db::Db>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let token = message
        .get("token")
        .and_then(|t| t.as_str())
        .ok_or("Missing token in auth message")?;

    // Validate the JWT token (assuming we have access to the secret)
    // Note: In a real implementation, you'd want to access the config for the JWT secret
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key".to_string());
    
    match crate::auth::validate_token(token, &jwt_secret) {
        Ok(user_id) => {
            // Verify user exists in database
            match db.find_user_by_id(&user_id).await {
                Ok(Some(_user)) => {
                    // Update connection with authenticated user_id
                    // First remove the old connection
                    hub.remove_connection(connection_id).await;
                    
                    // Add back with user_id
                    let _receiver = hub.add_connection(
                        connection_id.to_string(),
                        Some(user_id.clone()),
                    ).await;
                    
                    info!("WebSocket connection {} authenticated for user {}", connection_id, user_id);
                    
                    // Send success response
                    let response = serde_json::json!({
                        "type": "auth_success",
                        "user_id": user_id,
                        "message": "Authentication successful"
                    });
                    
                    hub.broadcast_to_user(&user_id, response).await;
                },
                Ok(None) => {
                    warn!("WebSocket auth failed: user not found for ID {}", user_id);
                    send_auth_error(connection_id, hub, "User not found").await;
                },
                Err(e) => {
                    error!("Database error during WebSocket auth: {}", e);
                    send_auth_error(connection_id, hub, "Database error").await;
                }
            }
        },
        Err(e) => {
            warn!("WebSocket auth failed: invalid token - {}", e);
            send_auth_error(connection_id, hub, "Invalid token").await;
        }
    }
    
    Ok(())
}

pub async fn handle_ping_message(
    connection_id: &str,
    hub: &Hub,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let response = serde_json::json!({
        "type": "pong",
        "timestamp": chrono::Utc::now().timestamp()
    });
    
    // Find the connection and send pong
    let connections = hub.connections.read().await;
    if let Some(connection) = connections.get(connection_id) {
        if let Err(e) = connection.sender.send(response) {
            error!("Failed to send pong to connection {}: {}", connection_id, e);
        }
    }
    
    Ok(())
}

pub async fn handle_subscribe_message(
    message: Value,
    connection_id: &str,
    hub: &Hub,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let channel = message
        .get("channel")
        .and_then(|c| c.as_str())
        .ok_or("Missing channel in subscribe message")?;
        
    info!("Connection {} subscribing to channel: {}", connection_id, channel);
    
    // For now, just acknowledge the subscription
    // In a more complex implementation, you'd maintain channel subscriptions
    let response = serde_json::json!({
        "type": "subscription_success",
        "channel": channel,
        "message": format!("Subscribed to channel: {}", channel)
    });
    
    let connections = hub.connections.read().await;
    if let Some(connection) = connections.get(connection_id) {
        if let Err(e) = connection.sender.send(response) {
            error!("Failed to send subscription success to connection {}: {}", connection_id, e);
        }
    }
    
    Ok(())
}

pub async fn handle_unsubscribe_message(
    message: Value,
    connection_id: &str,
    hub: &Hub,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let channel = message
        .get("channel")
        .and_then(|c| c.as_str())
        .ok_or("Missing channel in unsubscribe message")?;
        
    info!("Connection {} unsubscribing from channel: {}", connection_id, channel);
    
    // For now, just acknowledge the unsubscription
    let response = serde_json::json!({
        "type": "unsubscription_success",
        "channel": channel,
        "message": format!("Unsubscribed from channel: {}", channel)
    });
    
    let connections = hub.connections.read().await;
    if let Some(connection) = connections.get(connection_id) {
        if let Err(e) = connection.sender.send(response) {
            error!("Failed to send unsubscription success to connection {}: {}", connection_id, e);
        }
    }
    
    Ok(())
}

async fn send_auth_error(connection_id: &str, hub: &Hub, error_message: &str) {
    let error_response = serde_json::json!({
        "type": "auth_error",
        "message": error_message
    });
    
    let connections = hub.connections.read().await;
    if let Some(connection) = connections.get(connection_id) {
        if let Err(e) = connection.sender.send(error_response) {
            error!("Failed to send auth error to connection {}: {}", connection_id, e);
        }
    }
}

// Notification helpers that can be used by other parts of the application
pub async fn notify_item_created(hub: &Hub, user_id: &str, item_id: &str, item_title: &str) {
    let notification = serde_json::json!({
        "type": "item_created",
        "item_id": item_id,
        "title": item_title,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn notify_item_updated(hub: &Hub, user_id: &str, item_id: &str, item_title: &str) {
    let notification = serde_json::json!({
        "type": "item_updated",
        "item_id": item_id,
        "title": item_title,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn notify_item_deleted(hub: &Hub, user_id: &str, item_id: &str) {
    let notification = serde_json::json!({
        "type": "item_deleted",
        "item_id": item_id,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn notify_workspace_created(hub: &Hub, user_id: &str, workspace_id: &str, workspace_name: &str) {
    let notification = serde_json::json!({
        "type": "workspace_created",
        "workspace_id": workspace_id,
        "name": workspace_name,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn notify_workspace_updated(hub: &Hub, user_id: &str, workspace_id: &str, workspace_name: &str) {
    let notification = serde_json::json!({
        "type": "workspace_updated",
        "workspace_id": workspace_id,
        "name": workspace_name,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn notify_workspace_deleted(hub: &Hub, user_id: &str, workspace_id: &str) {
    let notification = serde_json::json!({
        "type": "workspace_deleted",
        "workspace_id": workspace_id,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

pub async fn send_system_notification(hub: &Hub, user_id: &str, title: &str, message: &str, priority: &str) {
    let notification = serde_json::json!({
        "type": "system_notification",
        "title": title,
        "message": message,
        "priority": priority,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    hub.broadcast_to_user(user_id, notification).await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::time::Duration;
    
    #[tokio::test]
    async fn test_ping_pong() {
        let hub = Hub::new();
        let connection_id = "test_conn";
        
        let mut receiver = hub.add_connection(connection_id.to_string(), None).await;
        
        // Send ping
        handle_ping_message(connection_id, &hub).await.unwrap();
        
        // Check for pong response
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        match receiver.try_recv() {
            Ok(msg) => {
                assert_eq!(msg.get("type").unwrap(), "pong");
                assert!(msg.get("timestamp").is_some());
            },
            Err(e) => panic!("Expected pong message but got error: {}", e)
        }
    }
    
    #[tokio::test]
    async fn test_subscribe_message() {
        let hub = Hub::new();
        let connection_id = "test_conn";
        
        let mut receiver = hub.add_connection(connection_id.to_string(), None).await;
        
        let subscribe_msg = json!({
            "type": "subscribe",
            "channel": "test_channel"
        });
        
        handle_subscribe_message(subscribe_msg, connection_id, &hub).await.unwrap();
        
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        match receiver.try_recv() {
            Ok(msg) => {
                assert_eq!(msg.get("type").unwrap(), "subscription_success");
                assert_eq!(msg.get("channel").unwrap(), "test_channel");
            },
            Err(e) => panic!("Expected subscription success but got error: {}", e)
        }
    }
    
    #[tokio::test]
    async fn test_notification_helpers() {
        let hub = Hub::new();
        let user_id = "user123";
        
        let mut receiver = hub.add_connection("conn1".to_string(), Some(user_id.to_string())).await;
        
        // Test item notification
        notify_item_created(&hub, user_id, "item123", "Test Item").await;
        
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        match receiver.try_recv() {
            Ok(msg) => {
                assert_eq!(msg.get("type").unwrap(), "item_created");
                assert_eq!(msg.get("item_id").unwrap(), "item123");
                assert_eq!(msg.get("title").unwrap(), "Test Item");
            },
            Err(e) => panic!("Expected item notification but got error: {}", e)
        }
    }
}