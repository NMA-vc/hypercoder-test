use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use validator::Validate;
use tracing::{error, info};

use crate::AppState;
use crate::auth::handlers::{UserId, ErrorResponse};
use crate::db::schema::Widget;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWidgetRequest {
    #[validate(length(min = 1, max = 100, message = "Title must be between 1 and 100 characters"))]
    pub title: String,
    #[validate(length(min = 1, message = "Widget type is required"))]
    pub widget_type: String,
    pub config: Option<serde_json::Value>,
    pub position: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateWidgetRequest {
    #[validate(length(min = 1, max = 100, message = "Title must be between 1 and 100 characters"))]
    pub title: Option<String>,
    pub config: Option<serde_json::Value>,
    pub position: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct WidgetResponse {
    pub id: String,
    pub user_id: String,
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub position: serde_json::Value,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Widget> for WidgetResponse {
    fn from(widget: Widget) -> Self {
        Self {
            id: widget.id.id.to_string(),
            user_id: widget.user_id,
            widget_type: widget.widget_type,
            title: widget.title,
            config: widget.config,
            position: widget.position,
            updated_at: widget.updated_at,
        }
    }
}

pub async fn create_widget(
    user_id: UserId,
    State(state): State<AppState>,
    Json(payload): Json<CreateWidgetRequest>,
) -> Result<Json<WidgetResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate input
    if let Err(errors) = payload.validate() {
        error!("Validation failed: {:?}", errors);
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "validation_failed".to_string(),
                message: "Invalid input data".to_string(),
            }),
        ));
    }

    let config = payload.config.unwrap_or(serde_json::json!({}));
    let position = payload.position.unwrap_or(serde_json::json!({
        "x": 0,
        "y": 0,
        "width": 4,
        "height": 4
    }));

    // Create widget
    let widget = match state.db.create_widget(
        &user_id.0,
        &payload.widget_type,
        &payload.title,
        config,
        position,
    ).await {
        Ok(widget) => widget,
        Err(e) => {
            error!("Failed to create widget: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "widget_creation_failed".to_string(),
                    message: "Failed to create widget".to_string(),
                }),
            ));
        }
    };

    info!("Widget created successfully: {} for user: {}", widget.title, user_id.0);

    Ok(Json(widget.into()))
}

pub async fn get_widgets(
    user_id: UserId,
    State(state): State<AppState>,
) -> Result<Json<Vec<WidgetResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let widgets = match state.db.get_widgets_by_user(&user_id.0).await {
        Ok(widgets) => widgets,
        Err(e) => {
            error!("Failed to get widgets: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch widgets".to_string(),
                }),
            ));
        }
    };

    let response: Vec<WidgetResponse> = widgets.into_iter().map(|w| w.into()).collect();
    Ok(Json(response))
}

pub async fn get_widget(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<WidgetResponse>, (StatusCode, Json<ErrorResponse>)> {
    let widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "widget_not_found".to_string(),
                    message: "Widget not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get widget: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch widget".to_string(),
                }),
            ));
        }
    };

    // Check if user owns the widget
    let widget_user_id = widget.user_id.strip_prefix("User:").unwrap_or(&widget.user_id);
    if widget_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to access this widget".to_string(),
            }),
        ));
    }

    Ok(Json(widget.into()))
}

pub async fn update_widget(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateWidgetRequest>,
) -> Result<Json<WidgetResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate input
    if let Err(errors) = payload.validate() {
        error!("Validation failed: {:?}", errors);
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "validation_failed".to_string(),
                message: "Invalid input data".to_string(),
            }),
        ));
    }

    // Check if widget exists and user owns it
    let existing_widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "widget_not_found".to_string(),
                    message: "Widget not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get widget: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch widget".to_string(),
                }),
            ));
        }
    };

    let widget_user_id = existing_widget.user_id.strip_prefix("User:").unwrap_or(&existing_widget.user_id);
    if widget_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to update this widget".to_string(),
            }),
        ));
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
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "widget_not_found".to_string(),
                    message: "Widget not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to update widget: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "widget_update_failed".to_string(),
                    message: "Failed to update widget".to_string(),
                }),
            ));
        }
    };

    info!("Widget updated successfully: {} for user: {}", id, user_id.0);

    Ok(Json(updated_widget.into()))
}

pub async fn delete_widget(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Check if widget exists and user owns it
    let widget = match state.db.get_widget_by_id(&id).await {
        Ok(Some(widget)) => widget,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "widget_not_found".to_string(),
                    message: "Widget not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get widget: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch widget".to_string(),
                }),
            ));
        }
    };

    let widget_user_id = widget.user_id.strip_prefix("User:").unwrap_or(&widget.user_id);
    if widget_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to delete this widget".to_string(),
            }),
        ));
    }

    // Delete widget
    if let Err(e) = state.db.delete_widget(&id).await {
        error!("Failed to delete widget: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "widget_deletion_failed".to_string(),
                message: "Failed to delete widget".to_string(),
            }),
        ));
    }

    info!("Widget deleted successfully: {} for user: {}", id, user_id.0);

    Ok(StatusCode::NO_CONTENT)
}