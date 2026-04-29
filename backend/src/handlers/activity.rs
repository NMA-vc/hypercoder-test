use axum::{
    extract::{Query, Request, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error};
use chrono::{DateTime, Utc};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ActivityQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub activity_type: Option<String>,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ActivityItem {
    pub id: String,
    pub activity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub entity_type: String, // "item", "widget", "workspace"
    pub entity_id: String,
    pub workspace_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct ActivityResponse {
    pub success: bool,
    pub activities: Option<Vec<ActivityItem>>,
    pub message: String,
    pub total: Option<u64>,
    pub has_more: bool,
}

pub async fn get_activity(
    Query(params): Query<ActivityQuery>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ActivityResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    // If workspace_id is provided, verify it belongs to user
    if let Some(ref workspace_id) = params.workspace_id {
        let workspace = match state.db.get_workspace_by_id(workspace_id).await {
            Ok(Some(workspace)) => workspace,
            Ok(None) => {
                return Ok(Json(ActivityResponse {
                    success: false,
                    activities: None,
                    message: "Workspace not found".to_string(),
                    total: None,
                    has_more: false,
                }));
            },
            Err(e) => {
                error!("Database error getting workspace: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };

        if workspace.user_id != format!("User:{}", user_id) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // Collect activities from different sources
    let mut activities = Vec::new();

    // Get recent items as activity
    match state.db.get_items_by_user(
        &user_id,
        params.workspace_id.as_deref(),
        None, // item_type
        None, // tags
        None, // search
        limit,
        offset,
    ).await {
        Ok(items) => {
            for item in items {
                let activity = ActivityItem {
                    id: format!("item_{}", item.id.id.to_string()),
                    activity_type: "item_created".to_string(),
                    title: format!("Created item: {}", item.title),
                    description: item.content,
                    entity_type: "item".to_string(),
                    entity_id: item.id.id.to_string(),
                    workspace_id: Some(item.workspace_id.split(':').nth(1).unwrap_or("").to_string()),
                    created_at: item.created_at,
                    metadata: serde_json::json!({
                        "item_type": item.item_type,
                        "tags": item.tags
                    }),
                };
                activities.push(activity);
            }
        },
        Err(e) => {
            error!("Error getting items for activity: {}", e);
        }
    }

    // Get recent widgets as activity
    match state.db.get_widgets_by_user(&user_id).await {
        Ok(widgets) => {
            for widget in widgets.into_iter().take(limit as usize) {
                let activity = ActivityItem {
                    id: format!("widget_{}", widget.id.id.to_string()),
                    activity_type: "widget_created".to_string(),
                    title: format!("Created widget: {}", widget.title),
                    description: Some(format!("Widget type: {}", widget.widget_type)),
                    entity_type: "widget".to_string(),
                    entity_id: widget.id.id.to_string(),
                    workspace_id: None,
                    created_at: widget.updated_at,
                    metadata: serde_json::json!({
                        "widget_type": widget.widget_type,
                        "config": widget.config
                    }),
                };
                activities.push(activity);
            }
        },
        Err(e) => {
            error!("Error getting widgets for activity: {}", e);
        }
    }

    // Get recent workspaces as activity
    if params.workspace_id.is_none() { // Only show workspace activities when not filtering by workspace
        match state.db.get_workspaces_by_user(&user_id).await {
            Ok(workspaces) => {
                for workspace in workspaces.into_iter().take(5) { // Limit workspace activities
                    let activity = ActivityItem {
                        id: format!("workspace_{}", workspace.id.id.to_string()),
                        activity_type: "workspace_created".to_string(),
                        title: format!("Created workspace: {}", workspace.name),
                        description: workspace.description,
                        entity_type: "workspace".to_string(),
                        entity_id: workspace.id.id.to_string(),
                        workspace_id: Some(workspace.id.id.to_string()),
                        created_at: workspace.created_at,
                        metadata: serde_json::json!({
                            "settings": workspace.settings
                        }),
                    };
                    activities.push(activity);
                }
            },
            Err(e) => {
                error!("Error getting workspaces for activity: {}", e);
            }
        }
    }

    // Sort activities by created_at descending
    activities.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Filter by activity type if specified
    if let Some(ref activity_type) = params.activity_type {
        activities.retain(|a| a.activity_type == *activity_type);
    }

    // Apply pagination
    let total = activities.len() as u64;
    let offset = offset as usize;
    let limit = limit as usize;
    let has_more = offset + limit < total as usize;
    
    let paginated_activities: Vec<ActivityItem> = activities
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    info!("Retrieved {} activities for user {}", paginated_activities.len(), user_id);

    Ok(Json(ActivityResponse {
        success: true,
        activities: Some(paginated_activities),
        message: "Activity retrieved successfully".to_string(),
        total: Some(total),
        has_more,
    }))
}

pub async fn get_activity_summary(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get counts for different entity types
    let mut summary = serde_json::json!({
        "success": true,
        "message": "Activity summary retrieved successfully",
        "data": {
            "items_count": 0,
            "widgets_count": 0,
            "workspaces_count": 0,
            "recent_activity": []
        }
    });

    // Count items
    match state.db.get_items_by_user(
        &user_id,
        None, // workspace_id
        None, // item_type
        None, // tags
        None, // search
        1000, // high limit to get count
        0,    // offset
    ).await {
        Ok(items) => {
            summary["data"]["items_count"] = serde_json::Value::Number(serde_json::Number::from(items.len()));
        },
        Err(e) => {
            error!("Error counting items: {}", e);
        }
    }

    // Count widgets
    match state.db.get_widgets_by_user(&user_id).await {
        Ok(widgets) => {
            summary["data"]["widgets_count"] = serde_json::Value::Number(serde_json::Number::from(widgets.len()));
        },
        Err(e) => {
            error!("Error counting widgets: {}", e);
        }
    }

    // Count workspaces
    match state.db.get_workspaces_by_user(&user_id).await {
        Ok(workspaces) => {
            summary["data"]["workspaces_count"] = serde_json::Value::Number(serde_json::Number::from(workspaces.len()));
        },
        Err(e) => {
            error!("Error counting workspaces: {}", e);
        }
    }

    // Get recent activity (last 5 items)
    let activity_query = ActivityQuery {
        limit: Some(5),
        offset: Some(0),
        activity_type: None,
        workspace_id: None,
    };

    // Create a mock request for internal call
    let mut mock_request = axum::http::Request::builder()
        .body(axum::body::Body::empty())
        .unwrap();
    mock_request.extensions_mut().insert(user_id.clone());

    match get_activity(
        Query(activity_query),
        State(state),
        mock_request,
    ).await {
        Ok(Json(activity_response)) => {
            if let Some(activities) = activity_response.activities {
                summary["data"]["recent_activity"] = serde_json::to_value(activities).unwrap_or_default();
            }
        },
        Err(_) => {
            error!("Error getting recent activity for summary");
        }
    }

    info!("Generated activity summary for user {}", user_id);

    Ok(Json(summary))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;

    #[test]
    fn test_activity_item_serialization() {
        let activity = ActivityItem {
            id: "test_123".to_string(),
            activity_type: "item_created".to_string(),
            title: "Test Activity".to_string(),
            description: Some("Test description".to_string()),
            entity_type: "item".to_string(),
            entity_id: "item_456".to_string(),
            workspace_id: Some("workspace_789".to_string()),
            created_at: Utc::now(),
            metadata: json!({"test": true}),
        };

        let serialized = serde_json::to_string(&activity).unwrap();
        assert!(!serialized.is_empty());
        
        let deserialized: ActivityItem = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.id, "test_123");
        assert_eq!(deserialized.activity_type, "item_created");
    }

    #[test]
    fn test_activity_query_defaults() {
        let query = ActivityQuery {
            limit: None,
            offset: None,
            activity_type: None,
            workspace_id: None,
        };
        
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = query.offset.unwrap_or(0);
        
        assert_eq!(limit, 20);
        assert_eq!(offset, 0);
    }
}