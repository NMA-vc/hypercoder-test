use axum::{
    extract::{Path, Query, Request, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use validator::Validate;
use tracing::{info, error};
use crate::AppState;
use crate::db::schema::Item;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateItemRequest {
    pub workspace_id: String,
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    #[validate(length(max = 10000))]
    pub content: Option<String>,
    #[validate(length(min = 1, max = 50))]
    pub item_type: String,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateItemRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    #[validate(length(max = 10000))]
    pub content: Option<String>,
    #[validate(length(min = 1, max = 50))]
    pub item_type: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ListItemsQuery {
    pub workspace_id: Option<String>,
    pub item_type: Option<String>,
    pub tags: Option<String>, // Comma-separated list
    pub search: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ItemResponse {
    pub success: bool,
    pub item: Option<Item>,
    pub items: Option<Vec<Item>>,
    pub message: String,
    pub total: Option<u64>,
}

pub async fn create_item(
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(ItemResponse {
            success: false,
            item: None,
            items: None,
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

    // Verify workspace exists and belongs to user
    let workspace = match state.db.get_workspace_by_id(&payload.workspace_id).await {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            return Ok(Json(ItemResponse {
                success: false,
                item: None,
                items: None,
                message: "Workspace not found".to_string(),
                total: None,
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

    let metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));
    let tags = payload.tags.unwrap_or_default();

    // Create item
    let item = match state.db.create_item(
        &user_id,
        &payload.workspace_id,
        &payload.title,
        payload.content.as_deref(),
        &payload.item_type,
        metadata,
        tags,
    ).await {
        Ok(item) => item,
        Err(e) => {
            error!("Database error creating item: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Item created: {} for user {}", payload.title, user_id);

    Ok(Json(ItemResponse {
        success: true,
        item: Some(item),
        items: None,
        message: "Item created successfully".to_string(),
        total: None,
    }))
}

pub async fn list_items(
    Query(params): Query<ListItemsQuery>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Parse tags if provided
    let tags = params.tags.as_ref().map(|t| {
        t.split(',')
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .collect::<Vec<String>>()
    });

    let limit = params.limit.unwrap_or(50).min(100); // Cap at 100
    let offset = params.offset.unwrap_or(0);

    // If workspace_id is provided, verify it belongs to user
    if let Some(ref workspace_id) = params.workspace_id {
        let workspace = match state.db.get_workspace_by_id(workspace_id).await {
            Ok(Some(workspace)) => workspace,
            Ok(None) => {
                return Ok(Json(ItemResponse {
                    success: false,
                    item: None,
                    items: None,
                    message: "Workspace not found".to_string(),
                    total: None,
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

    // Get items for user
    let items = match state.db.get_items_by_user(
        &user_id,
        params.workspace_id.as_deref(),
        params.item_type.as_deref(),
        tags,
        params.search.as_deref(),
        limit,
        offset,
    ).await {
        Ok(items) => items,
        Err(e) => {
            error!("Database error getting items: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(ItemResponse {
        success: true,
        item: None,
        items: Some(items.clone()),
        message: "Items retrieved successfully".to_string(),
        total: Some(items.len() as u64),
    }))
}

pub async fn get_item(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get item by ID
    let item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Ok(Json(ItemResponse {
                success: false,
                item: None,
                items: None,
                message: "Item not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting item: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Check if item belongs to user
    if item.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(ItemResponse {
        success: true,
        item: Some(item),
        items: None,
        message: "Item retrieved successfully".to_string(),
        total: None,
    }))
}

pub async fn update_item(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<UpdateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(ItemResponse {
            success: false,
            item: None,
            items: None,
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

    // Check if item exists and belongs to user
    let existing_item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Ok(Json(ItemResponse {
                success: false,
                item: None,
                items: None,
                message: "Item not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting item: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_item.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Update item
    let updated_item = match state.db.update_item(
        &id,
        payload.title.as_deref(),
        payload.content.as_deref(),
        payload.item_type.as_deref(),
        payload.metadata,
        payload.tags,
    ).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Ok(Json(ItemResponse {
                success: false,
                item: None,
                items: None,
                message: "Failed to update item".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error updating item: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Item updated: {} by user {}", id, user_id);

    Ok(Json(ItemResponse {
        success: true,
        item: Some(updated_item),
        items: None,
        message: "Item updated successfully".to_string(),
        total: None,
    }))
}

pub async fn delete_item(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if item exists and belongs to user
    let existing_item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Ok(Json(ItemResponse {
                success: false,
                item: None,
                items: None,
                message: "Item not found".to_string(),
                total: None,
            }));
        },
        Err(e) => {
            error!("Database error getting item: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_item.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Delete item
    if let Err(e) = state.db.delete_item(&id).await {
        error!("Database error deleting item: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Item deleted: {} by user {}", id, user_id);

    Ok(Json(ItemResponse {
        success: true,
        item: None,
        items: None,
        message: "Item deleted successfully".to_string(),
        total: None,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_create_item_request_validation() {
        let valid_request = CreateItemRequest {
            workspace_id: "workspace123".to_string(),
            title: "Test Item".to_string(),
            content: Some("Item content".to_string()),
            item_type: "note".to_string(),
            metadata: Some(json!({"priority": "high"})),
            tags: Some(vec!["work".to_string(), "important".to_string()]),
        };
        assert!(valid_request.validate().is_ok());

        let invalid_request = CreateItemRequest {
            workspace_id: "workspace123".to_string(),
            title: "".to_string(), // Empty title should fail
            content: None,
            item_type: "".to_string(), // Empty type should fail
            metadata: None,
            tags: None,
        };
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_list_items_query_parsing() {
        let query = ListItemsQuery {
            workspace_id: Some("workspace123".to_string()),
            item_type: Some("note".to_string()),
            tags: Some("work,important".to_string()),
            search: Some("test".to_string()),
            limit: Some(10),
            offset: Some(0),
        };
        
        // Test tag parsing
        let tags = query.tags.as_ref().map(|t| {
            t.split(',')
                .map(|tag| tag.trim().to_string())
                .filter(|tag| !tag.is_empty())
                .collect::<Vec<String>>()
        });
        
        assert_eq!(tags, Some(vec!["work".to_string(), "important".to_string()]));
    }
}