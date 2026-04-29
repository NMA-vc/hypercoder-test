use chrono::Utc;
use serde_json::json;
use tracing::{error, info};

use crate::AppState;
use super::{Hub, WebSocketMessage};

// Event handlers for broadcasting real-time updates

pub struct WebSocketEventHandler {
    hub: std::sync::Arc<Hub>,
}

impl WebSocketEventHandler {
    pub fn new(hub: std::sync::Arc<Hub>) -> Self {
        Self { hub }
    }
    
    pub async fn notify_item_created(
        &self,
        item_id: &str,
        workspace_id: &str,
        title: &str,
        item_type: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::ItemCreated {
            item_id: item_id.to_string(),
            workspace_id: workspace_id.to_string(),
            title: title.to_string(),
            item_type: item_type.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of item creation: {}", user_id, item_id);
        } else {
            error!("Failed to serialize item created message");
        }
    }
    
    pub async fn notify_item_updated(
        &self,
        item_id: &str,
        title: Option<&str>,
        content: Option<&str>,
        user_id: &str,
    ) {
        let message = WebSocketMessage::ItemUpdated {
            item_id: item_id.to_string(),
            title: title.map(|s| s.to_string()),
            content: content.map(|s| s.to_string()),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of item update: {}", user_id, item_id);
        } else {
            error!("Failed to serialize item updated message");
        }
    }
    
    pub async fn notify_item_deleted(
        &self,
        item_id: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::ItemDeleted {
            item_id: item_id.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of item deletion: {}", user_id, item_id);
        } else {
            error!("Failed to serialize item deleted message");
        }
    }
    
    pub async fn notify_workspace_created(
        &self,
        workspace_id: &str,
        name: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WorkspaceCreated {
            workspace_id: workspace_id.to_string(),
            name: name.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of workspace creation: {}", user_id, workspace_id);
        } else {
            error!("Failed to serialize workspace created message");
        }
    }
    
    pub async fn notify_workspace_updated(
        &self,
        workspace_id: &str,
        name: Option<&str>,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WorkspaceUpdated {
            workspace_id: workspace_id.to_string(),
            name: name.map(|s| s.to_string()),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of workspace update: {}", user_id, workspace_id);
        } else {
            error!("Failed to serialize workspace updated message");
        }
    }
    
    pub async fn notify_workspace_deleted(
        &self,
        workspace_id: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WorkspaceDeleted {
            workspace_id: workspace_id.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of workspace deletion: {}", user_id, workspace_id);
        } else {
            error!("Failed to serialize workspace deleted message");
        }
    }
    
    pub async fn notify_widget_created(
        &self,
        widget_id: &str,
        title: &str,
        widget_type: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WidgetCreated {
            widget_id: widget_id.to_string(),
            title: title.to_string(),
            widget_type: widget_type.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of widget creation: {}", user_id, widget_id);
        } else {
            error!("Failed to serialize widget created message");
        }
    }
    
    pub async fn notify_widget_updated(
        &self,
        widget_id: &str,
        title: Option<&str>,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WidgetUpdated {
            widget_id: widget_id.to_string(),
            title: title.map(|s| s.to_string()),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of widget update: {}", user_id, widget_id);
        } else {
            error!("Failed to serialize widget updated message");
        }
    }
    
    pub async fn notify_widget_deleted(
        &self,
        widget_id: &str,
        user_id: &str,
    ) {
        let message = WebSocketMessage::WidgetDeleted {
            widget_id: widget_id.to_string(),
            user_id: user_id.to_string(),
            timestamp: Utc::now().timestamp(),
        };
        
        if let Ok(json) = message.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Notified user {} of widget deletion: {}", user_id, widget_id);
        } else {
            error!("Failed to serialize widget deleted message");
        }
    }
    
    pub async fn send_notification(
        &self,
        user_id: &str,
        title: &str,
        message: &str,
        level: &str,
    ) {
        let notification = WebSocketMessage::notification(title, message, level);
        
        if let Ok(json) = notification.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Sent {} notification to user {}: {}", level, user_id, title);
        } else {
            error!("Failed to serialize notification message");
        }
    }
    
    pub async fn broadcast_notification(
        &self,
        title: &str,
        message: &str,
        level: &str,
    ) {
        let notification = WebSocketMessage::notification(title, message, level);
        
        if let Ok(json) = notification.to_json() {
            self.hub.broadcast(&json).await;
            info!("Broadcasted {} notification: {}", level, title);
        } else {
            error!("Failed to serialize broadcast notification message");
        }
    }
    
    pub async fn send_error(
        &self,
        user_id: &str,
        code: &str,
        message: &str,
    ) {
        let error_msg = WebSocketMessage::error(code, message);
        
        if let Ok(json) = error_msg.to_json() {
            self.hub.send_to_user(user_id, &json).await;
            info!("Sent error to user {}: {} - {}", user_id, code, message);
        } else {
            error!("Failed to serialize error message");
        }
    }
    
    pub async fn get_connected_users(&self) -> Vec<String> {
        self.hub.get_connected_users().await
    }
    
    pub async fn get_client_count(&self) -> usize {
        self.hub.client_count().await
    }
    
    // Health check message
    pub async fn send_ping(&self, user_id: Option<&str>) {
        let ping = WebSocketMessage::ping();
        
        if let Ok(json) = ping.to_json() {
            match user_id {
                Some(uid) => self.hub.send_to_user(uid, &json).await,
                None => self.hub.broadcast(&json).await,
            }
        }
    }
}

// Integration with AppState for easy access
impl AppState {
    pub fn ws_events(&self) -> WebSocketEventHandler {
        WebSocketEventHandler::new(self.ws_hub.clone())
    }
}

// Utility functions for creating common messages
pub async fn notify_system_maintenance(hub: &Hub, start_time: chrono::DateTime<chrono::Utc>) {
    let message = WebSocketMessage::notification(
        "System Maintenance",
        &format!("System maintenance will begin at {}", start_time.format("%Y-%m-%d %H:%M UTC")),
        "warning"
    );
    
    if let Ok(json) = message.to_json() {
        hub.broadcast(&json).await;
    }
}

pub async fn notify_system_update(hub: &Hub, version: &str) {
    let message = WebSocketMessage::notification(
        "System Update",
        &format!("BentoBoard has been updated to version {}", version),
        "info"
    );
    
    if let Ok(json) = message.to_json() {
        hub.broadcast(&json).await;
    }
}

pub async fn notify_user_welcome(hub: &Hub, user_id: &str, email: &str) {
    let message = WebSocketMessage::notification(
        "Welcome to BentoBoard!",
        &format!("Welcome, {}! You're now connected and ready to organize your digital life.", email),
        "success"
    );
    
    if let Ok(json) = message.to_json() {
        hub.send_to_user(user_id, &json).await;
    }
}

pub async fn notify_quota_warning(hub: &Hub, user_id: &str, usage_percent: u32) {
    let message = WebSocketMessage::notification(
        "Storage Warning",
        &format!("You've used {}% of your storage quota. Consider cleaning up old items.", usage_percent),
        "warning"
    );
    
    if let Ok(json) = message.to_json() {
        hub.send_to_user(user_id, &json).await;
    }
}