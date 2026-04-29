use axum::{
    extract::{Path, Query, Request, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use validator::Validate;
use tracing::{info, error};
use crate::AppState;
use crate::db::schema::Widget;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateWidgetRequest {
    #[validate(length(min = 1, max = 50))]
    pub widget_type: String,
    #[validate(length(min = 1, max = 100))]
    pub title: String,
    pub config: Option<serde_json::Value>,
    pub position: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateWidgetRequest {
    #[validate(length(min = 1, max = 100))]
    pub title: Option<String>,
    pub config: Option<serde_json::Value>,
    pub position: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListWidgetsQuery {
    pub widget_type: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct WidgetResponse {
    pub success: bool,
    pub widget: Option<Widget>,
    pub widgets: Option<Vec<Widget>>,
    pub message: String,
    pub total: Option<u64>,
}

pub async fn create_widget(
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<CreateWidgetRequest>,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(WidgetResponse {
            success: false,
            widget: None,
            widgets: None,
            message: "Invalid input".to_string(),
            total: None,
        }));
    }

    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    let config = payload.config.unwrap_or_else(|| serde_json::json!({}));
    let position = payload.position.unwrap_or_else(|| serde_json::json!({"x": 0, "y": 0, "w": 1, "h": 1}));

    // Create widget
    let widget = match state.db.create_widget(
        &user_id,
        &payload.widget_type,
        &payload.title,
        config,
        position,
    ).await {
        Ok(widget) => widget,
        Err(e) => {
            error!("Database error creating widget: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Widget created: {} for user {}", payload.title, user_id);

    // Send WebSocket notification about widget creation
    let notification = serde_json::json!({
        "type": "widget_created",
        "widget_id": widget.id.id.to_string(),
        "user_id": user_id
    });
    state.ws_hub.broadcast_to_user(&user_id, notification).await;

    Ok(Json(WidgetResponse {
        success: true,
        widget: Some(widget),
        widgets: None,
        message: "Widget created successfully".to_string(),
        total: None,
    }))
}

pub async fn list_widgets(
    Query(params): Query<ListWidgetsQuery>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get widgets for user
    let widgets = match state.db.get_widgets_by_user(&user_id).await {
        Ok(widgets) => widgets,
        Err(e) => {
            error!("Database error getting widgets: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Filter by widget type if specified
    let filtered_widgets: Vec<Widget> = if let Some(ref widget_type) = params.widget_type {
        widgets.into_iter()
            .filter(|w| w.widget_type == *widget_type)
            .collect()
    } else {
        widgets
    };

    // Apply pagination
    let limit = params.limit.unwrap_or(50).min(100) as usize;
    let offset = params.offset.unwrap_or(0) as usize;
    
    let total = filtered_widgets.len() as u64;
    let paginated_widgets: Vec<Widget> = filtered_widgets
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    Ok(Json(WidgetResponse {
        success: true,
        widget: None,
        widgets: Some(paginated_widgets),
        message: "Widgets retrieved successfully".to_string(),
        total: Some(total),
    }))
}

pub async fn get_widget(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get widget by ID
    let widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Ok(Json(WidgetResponse {
                success: false,
                widget: None,
                widgets: None,
                message: "Widget not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting widget: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Check if widget belongs to user
    if widget.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(WidgetResponse {
        success: true,
        widget: Some(widget),
        widgets: None,
        message: "Widget retrieved successfully".to_string(),
        total: None,
    }))
}

pub async fn update_widget(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<UpdateWidgetRequest>,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(WidgetResponse {
            success: false,
            widget: None,
            widgets: None,
            message: "Invalid input".to_string(),
            total: None,
        }));
    }

    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if widget exists and belongs to user
    let existing_widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Ok(Json(WidgetResponse {
                success: false,
                widget: None,
                widgets: None,
                message: "Widget not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting widget: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_widget.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Update widget
    let updated_widget = match state.db.update_widget(
        &id,
        payload.title.as_deref(),
        payload.config,
        payload.position,
    ).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Ok(Json(WidgetResponse {
                success: false,
                widget: None,
                widgets: None,
                message: "Failed to update widget".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error updating widget: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Widget updated: {} by user {}", id, user_id);

    // Send WebSocket notification about widget update
    let notification = serde_json::json!({
        "type": "widget_updated",
        "widget_id": id,
        "user_id": user_id
    });
    state.ws_hub.broadcast_to_user(&user_id, notification).await;

    Ok(Json(WidgetResponse {
        success: true,
        widget: Some(updated_widget),
        widgets: None,
        message: "Widget updated successfully".to_string(),
        total: None,
    }))
}

pub async fn delete_widget(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if widget exists and belongs to user
    let existing_widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Ok(Json(WidgetResponse {
                success: false,
                widget: None,
                widgets: None,
                message: "Widget not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting widget: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_widget.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Delete widget
    if let Err(e) = state.db.delete_widget(&id).await {
        error!("Database error deleting widget: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Widget deleted: {} by user {}", id, user_id);

    // Send WebSocket notification about widget deletion
    let notification = serde_json::json!({
        "type": "widget_deleted",
        "widget_id": id,
        "user_id": user_id
    });
    state.ws_hub.broadcast_to_user(&user_id, notification).await;

    Ok(Json(WidgetResponse {
        success: true,
        widget: None,
        widgets: None,
        message: "Widget deleted successfully".to_string(),
        total: None,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_create_widget_request_validation() {
        let valid_request = CreateWidgetRequest {
            widget_type: "chart".to_string(),
            title: "My Chart Widget".to_string(),
            config: Some(json!({"chart_type": "line", "data_source": "api"})),
            position: Some(json!({"x": 0, "y": 0, "w": 2, "h": 2})),
        };
        assert!(valid_request.validate().is_ok());

        let invalid_request = CreateWidgetRequest {
            widget_type: "".to_string(), // Empty type should fail
            title: "".to_string(), // Empty title should fail
            config: None,
            position: None,
        };
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_update_widget_request_validation() {
        let valid_request = UpdateWidgetRequest {
            title: Some("Updated Widget Title".to_string()),
            config: Some(json!({"updated": true})),
            position: Some(json!({"x": 1, "y": 1, "w": 3, "h": 2})),
        };
        assert!(valid_request.validate().is_ok());

        let invalid_request = UpdateWidgetRequest {
            title: Some("".to_string()), // Empty title should fail
            config: None,
            position: None,
        };
        assert!(invalid_request.validate().is_err());
    }
}