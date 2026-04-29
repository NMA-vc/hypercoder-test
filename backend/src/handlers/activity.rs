use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::{AppState, auth::AuthUser};

#[derive(Debug, Deserialize)]
pub struct ActivityQuery {
    pub page: Option<usize>,
    pub limit: Option<usize>,
    pub activity_type: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ActivityItem {
    pub id: String,
    pub activity_type: String,
    pub description: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ActivityFeedResponse {
    pub activities: Vec<ActivityItem>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
}

#[derive(Debug, Serialize)]
pub struct ActivityStatsResponse {
    pub total_activities: usize,
    pub activities_today: usize,
    pub activities_this_week: usize,
    pub activity_types: std::collections::HashMap<String, usize>,
}

pub async fn get_activity_feed(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ActivityQuery>,
) -> Result<Json<ActivityFeedResponse>, StatusCode> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);
    
    // Generate mock activity data based on user's widgets
    let widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut activities = Vec::new();
    
    // Generate activities for each widget
    for (i, widget) in widgets.iter().enumerate() {
        let widget_id = widget.id.id.to_string();
        
        // Widget creation activity
        activities.push(ActivityItem {
            id: format!("activity_{}_{}", widget_id, i * 3),
            activity_type: "widget_created".to_string(),
            description: format!("Widget '{}' was created", widget.title),
            metadata: serde_json::json!({
                "widget_id": widget_id,
                "widget_type": widget.widget_type,
                "widget_title": widget.title
            }),
            created_at: widget.updated_at - chrono::Duration::hours(2),
        });
        
        // Widget update activity
        activities.push(ActivityItem {
            id: format!("activity_{}_{}", widget_id, i * 3 + 1),
            activity_type: "widget_updated".to_string(),
            description: format!("Widget '{}' was updated", widget.title),
            metadata: serde_json::json!({
                "widget_id": widget_id,
                "widget_type": widget.widget_type,
                "widget_title": widget.title
            }),
            created_at: widget.updated_at,
        });
        
        // Data sync activity
        activities.push(ActivityItem {
            id: format!("activity_{}_{}", widget_id, i * 3 + 2),
            activity_type: "data_sync".to_string(),
            description: format!("Data synchronized for widget '{}'", widget.title),
            metadata: serde_json::json!({
                "widget_id": widget_id,
                "widget_type": widget.widget_type,
                "sync_status": "success",
                "records_updated": 42
            }),
            created_at: widget.updated_at + chrono::Duration::minutes(30),
        });
    }
    
    // Add some general system activities
    activities.push(ActivityItem {
        id: "activity_system_1".to_string(),
        activity_type: "user_login".to_string(),
        description: "User logged in to dashboard".to_string(),
        metadata: serde_json::json!({
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0"
        }),
        created_at: Utc::now() - chrono::Duration::hours(1),
    });
    
    activities.push(ActivityItem {
        id: "activity_system_2".to_string(),
        activity_type: "dashboard_viewed".to_string(),
        description: "Dashboard was accessed".to_string(),
        metadata: serde_json::json!({
            "view_duration": 300,
            "widgets_viewed": widgets.len()
        }),
        created_at: Utc::now() - chrono::Duration::minutes(30),
    });
    
    // Filter by activity type if specified
    if let Some(ref activity_type) = query.activity_type {
        activities.retain(|a| a.activity_type == *activity_type);
    }
    
    // Filter by date range if specified
    if let Some(from) = query.from {
        activities.retain(|a| a.created_at >= from);
    }
    if let Some(to) = query.to {
        activities.retain(|a| a.created_at <= to);
    }
    
    // Sort by creation time (newest first)
    activities.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    let total = activities.len();
    let start = (page - 1) * limit;
    let end = std::cmp::min(start + limit, total);
    
    let paginated_activities = if start < total {
        activities[start..end].to_vec()
    } else {
        vec![]
    };
    
    Ok(Json(ActivityFeedResponse {
        activities: paginated_activities,
        total,
        page,
        limit,
    }))
}

pub async fn get_activity_stats(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<ActivityStatsResponse>, StatusCode> {
    let widgets = state.db.get_widgets_by_user(&user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let now = Utc::now();
    let today_start = now.date_naive().and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let week_start = now - chrono::Duration::days(7);
    
    // Calculate stats based on mock data
    let total_activities = widgets.len() * 3 + 2; // 3 activities per widget + 2 system activities
    
    let activities_today = widgets.iter()
        .filter(|w| w.updated_at >= today_start)
        .count() * 2; // Assume 2 activities per widget updated today
    
    let activities_this_week = widgets.iter()
        .filter(|w| w.updated_at >= week_start)
        .count() * 3 + 2; // All activities for widgets updated this week + system activities
    
    let mut activity_types = std::collections::HashMap::new();
    activity_types.insert("widget_created".to_string(), widgets.len());
    activity_types.insert("widget_updated".to_string(), widgets.len());
    activity_types.insert("data_sync".to_string(), widgets.len());
    activity_types.insert("user_login".to_string(), 1);
    activity_types.insert("dashboard_viewed".to_string(), 1);
    
    Ok(Json(ActivityStatsResponse {
        total_activities,
        activities_today,
        activities_this_week,
        activity_types,
    }))
}

pub async fn get_activity_types(
    _state: State<AppState>,
    _user: Extension<AuthUser>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let activity_types = vec![
        "widget_created".to_string(),
        "widget_updated".to_string(),
        "widget_deleted".to_string(),
        "data_sync".to_string(),
        "user_login".to_string(),
        "user_logout".to_string(),
        "dashboard_viewed".to_string(),
        "dashboard_created".to_string(),
        "dashboard_updated".to_string(),
        "dashboard_deleted".to_string(),
        "export_generated".to_string(),
        "alert_triggered".to_string(),
        "notification_sent".to_string(),
    ];
    
    Ok(Json(activity_types))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_activity_item_serialization() {
        let activity = ActivityItem {
            id: "test_123".to_string(),
            activity_type: "widget_created".to_string(),
            description: "Test widget created".to_string(),
            metadata: json!({"widget_id": "123"}),
            created_at: Utc::now(),
        };
        
        let serialized = serde_json::to_string(&activity).unwrap();
        assert!(serialized.contains("widget_created"));
        assert!(serialized.contains("Test widget created"));
    }
    
    #[test]
    fn test_activity_query_defaults() {
        let query = ActivityQuery {
            page: None,
            limit: None,
            activity_type: None,
            from: None,
            to: None,
        };
        
        assert_eq!(query.page.unwrap_or(1), 1);
        assert_eq!(query.limit.unwrap_or(20), 20);
    }
}