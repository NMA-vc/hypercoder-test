use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::AppState;
use crate::auth::handlers::{UserId, ErrorResponse};

#[derive(Debug, Deserialize)]
pub struct GetActivityQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ActivityItem {
    pub id: String,
    pub activity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ActivityResponse {
    pub activities: Vec<ActivityItem>,
    pub total: usize,
}

pub async fn get_activity(
    user_id: UserId,
    Query(params): Query<GetActivityQuery>,
    State(state): State<AppState>,
) -> Result<Json<ActivityResponse>, (StatusCode, Json<ErrorResponse>)> {
    let limit = params.limit.unwrap_or(20).min(100); // max 100 items
    let offset = params.offset.unwrap_or(0);

    // Get recent activities from the database
    let raw_activities = match state.db.get_activity(&user_id.0).await {
        Ok(activities) => activities,
        Err(e) => {
            error!("Failed to get activity: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch activity".to_string(),
                }),
            ));
        }
    };

    // Get recent items
    let recent_items = match state.db.get_items_by_user(
        &user_id.0,
        None, // all workspaces
        None, // all types
        None, // no tag filter
        None, // no search
        limit / 2, // half the limit for items
        0,
    ).await {
        Ok(items) => items,
        Err(e) => {
            error!("Failed to get recent items: {}", e);
            Vec::new()
        }
    };

    // Get recent widgets
    let recent_widgets = match state.db.get_widgets_by_user(&user_id.0).await {
        Ok(widgets) => widgets.into_iter().take(5).collect::<Vec<_>>(), // limit to 5 widgets
        Err(e) => {
            error!("Failed to get recent widgets: {}", e);
            Vec::new()
        }
    };

    // Get recent workspaces
    let recent_workspaces = match state.db.get_workspaces_by_user(&user_id.0).await {
        Ok(workspaces) => workspaces.into_iter().take(5).collect::<Vec<_>>(), // limit to 5 workspaces
        Err(e) => {
            error!("Failed to get recent workspaces: {}", e);
            Vec::new()
        }
    };

    let mut activities = Vec::new();

    // Convert items to activity items
    for item in recent_items {
        activities.push(ActivityItem {
            id: item.id.id.to_string(),
            activity_type: "item_created".to_string(),
            title: format!("Created item: {}", item.title),
            description: Some(format!("Created a new {} item", item.item_type)),
            metadata: serde_json::json!({
                "item_type": item.item_type,
                "workspace_id": item.workspace_id,
                "tags": item.tags
            }),
            created_at: item.created_at,
            updated_at: item.updated_at,
        });
    }

    // Convert widgets to activity items
    for widget in recent_widgets {
        activities.push(ActivityItem {
            id: widget.id.id.to_string(),
            activity_type: "widget_created".to_string(),
            title: format!("Created widget: {}", widget.title),
            description: Some(format!("Created a new {} widget", widget.widget_type)),
            metadata: serde_json::json!({
                "widget_type": widget.widget_type,
                "position": widget.position
            }),
            created_at: widget.updated_at, // use updated_at as creation time for widgets
            updated_at: widget.updated_at,
        });
    }

    // Convert workspaces to activity items
    for workspace in recent_workspaces {
        activities.push(ActivityItem {
            id: workspace.id.id.to_string(),
            activity_type: "workspace_created".to_string(),
            title: format!("Created workspace: {}", workspace.name),
            description: workspace.description.clone(),
            metadata: serde_json::json!({
                "settings": workspace.settings
            }),
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
        });
    }

    // Sort activities by creation time (newest first)
    activities.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Apply pagination
    let total = activities.len();
    let paginated_activities: Vec<ActivityItem> = activities
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect();

    info!("Retrieved {} activities for user: {}", paginated_activities.len(), user_id.0);

    Ok(Json(ActivityResponse {
        activities: paginated_activities,
        total,
    }))
}

#[derive(Debug, Serialize)]
pub struct DashboardStatsResponse {
    pub total_items: u32,
    pub total_widgets: u32,
    pub total_workspaces: u32,
    pub recent_activity_count: u32,
}

pub async fn get_dashboard_stats(
    user_id: UserId,
    State(state): State<AppState>,
) -> Result<Json<DashboardStatsResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Get counts for different entities
    let items_count = match state.db.get_items_by_user(
        &user_id.0,
        None, // all workspaces
        None, // all types
        None, // no tag filter
        None, // no search
        1000, // high limit to get total count
        0,
    ).await {
        Ok(items) => items.len() as u32,
        Err(e) => {
            error!("Failed to get items count: {}", e);
            0
        }
    };

    let widgets_count = match state.db.get_widgets_by_user(&user_id.0).await {
        Ok(widgets) => widgets.len() as u32,
        Err(e) => {
            error!("Failed to get widgets count: {}", e);
            0
        }
    };

    let workspaces_count = match state.db.get_workspaces_by_user(&user_id.0).await {
        Ok(workspaces) => workspaces.len() as u32,
        Err(e) => {
            error!("Failed to get workspaces count: {}", e);
            0
        }
    };

    // Get recent activity count (last 7 days worth of activity approximation)
    let recent_activity_count = (items_count + widgets_count + workspaces_count).min(50);

    info!("Retrieved dashboard stats for user: {}", user_id.0);

    Ok(Json(DashboardStatsResponse {
        total_items: items_count,
        total_widgets: widgets_count,
        total_workspaces: workspaces_count,
        recent_activity_count,
    }))
}