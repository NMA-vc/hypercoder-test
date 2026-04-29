use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::{AppState, auth::AuthUser};

#[derive(Debug, Deserialize)]
pub struct CreateWidgetRequest {
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub position: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWidgetRequest {
    pub title: Option<String>,
    pub config: Option<serde_json::Value>,
    pub position: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct WidgetQuery {
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct WidgetResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub position: serde_json::Value,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct WidgetsListResponse {
    pub widgets: Vec<WidgetResponse>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
}

impl From<crate::db::schema::Widget> for WidgetResponse {
    fn from(widget: crate::db::schema::Widget) -> Self {
        Self {
            id: widget.id.id.to_string(),
            widget_type: widget.widget_type,
            title: widget.title,
            config: widget.config,
            position: widget.position,
            updated_at: widget.updated_at,
        }
    }
}

pub async fn get_widgets(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<WidgetQuery>,
) -> Result<Json<WidgetsListResponse>, StatusCode> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);
    
    let widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let total = widgets.len();
    let start = (page - 1) * limit;
    let end = std::cmp::min(start + limit, total);
    
    let paginated_widgets = if start < total {
        widgets[start..end].iter().map(|w| w.clone().into()).collect()
    } else {
        vec![]
    };
    
    Ok(Json(WidgetsListResponse {
        widgets: paginated_widgets,
        total,
        page,
        limit,
    }))
}

pub async fn create_widget(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<CreateWidgetRequest>,
) -> Result<Json<WidgetResponse>, StatusCode> {
    let widget = state.db.create_widget(
        &user.id,
        &request.widget_type,
        &request.title,
        request.config,
        request.position,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(widget.into()))
}

pub async fn update_widget(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(widget_id): Path<String>,
    Json(request): Json<UpdateWidgetRequest>,
) -> Result<Json<WidgetResponse>, StatusCode> {
    // First verify the widget belongs to the user
    let existing_widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let widget_exists = existing_widgets.iter()
        .any(|w| w.id.id.to_string() == widget_id);
    
    if !widget_exists {
        return Err(StatusCode::NOT_FOUND);
    }
    
    let updated_widget = state.db.update_widget(
        &widget_id,
        request.title.as_deref(),
        request.config,
        request.position,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(updated_widget.into()))
}

pub async fn delete_widget(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(widget_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    // First verify the widget belongs to the user
    let existing_widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let widget_exists = existing_widgets.iter()
        .any(|w| w.id.id.to_string() == widget_id);
    
    if !widget_exists {
        return Err(StatusCode::NOT_FOUND);
    }
    
    state.db.delete_widget(&widget_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_widget_by_id(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(widget_id): Path<String>,
) -> Result<Json<WidgetResponse>, StatusCode> {
    let widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let widget = widgets.iter()
        .find(|w| w.id.id.to_string() == widget_id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(widget.clone().into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_widget_response_serialization() {
        let widget_response = WidgetResponse {
            id: "widget_123".to_string(),
            widget_type: "chart".to_string(),
            title: "Sales Chart".to_string(),
            config: json!({"chart_type": "bar"}),
            position: json!({"x": 0, "y": 0, "w": 4, "h": 3}),
            updated_at: chrono::Utc::now(),
        };
        
        let serialized = serde_json::to_string(&widget_response).unwrap();
        assert!(serialized.contains("chart"));
        assert!(serialized.contains("Sales Chart"));
    }
}