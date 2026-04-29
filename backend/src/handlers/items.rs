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
use crate::db::schema::Item;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateItemRequest {
    #[validate(length(min = 1, max = 200, message = "Title must be between 1 and 200 characters"))]
    pub title: String,
    #[validate(length(max = 10000, message = "Content must be less than 10000 characters"))]
    pub content: Option<String>,
    #[validate(length(min = 1, message = "Item type is required"))]
    pub item_type: String,
    #[validate(length(min = 1, message = "Workspace ID is required"))]
    pub workspace_id: String,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateItemRequest {
    #[validate(length(min = 1, max = 200, message = "Title must be between 1 and 200 characters"))]
    pub title: Option<String>,
    #[validate(length(max = 10000, message = "Content must be less than 10000 characters"))]
    pub content: Option<String>,
    pub item_type: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct GetItemsQuery {
    pub workspace_id: Option<String>,
    pub item_type: Option<String>,
    pub tags: Option<String>, // comma-separated tags
    pub search: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ItemResponse {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub metadata: serde_json::Value,
    pub status: String,
    pub tags: Vec<String>,
    pub user_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Item> for ItemResponse {
    fn from(item: Item) -> Self {
        Self {
            id: item.id.id.to_string(),
            workspace_id: item.workspace_id,
            title: item.title,
            content: item.content,
            item_type: item.item_type,
            metadata: item.metadata,
            status: item.status,
            tags: item.tags,
            user_id: item.user_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }
    }
}

pub async fn create_item(
    user_id: UserId,
    State(state): State<AppState>,
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    // Check if workspace exists and user owns it
    let workspace = match state.db.get_workspace_by_id(&payload.workspace_id).await {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "workspace_not_found".to_string(),
                    message: "Workspace not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get workspace: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to validate workspace".to_string(),
                }),
            ));
        }
    };

    let workspace_user_id = workspace.user_id.strip_prefix("User:").unwrap_or(&workspace.user_id);
    if workspace_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to create items in this workspace".to_string(),
            }),
        ));
    }

    let metadata = payload.metadata.unwrap_or(serde_json::json!({}));
    let tags = payload.tags.unwrap_or_default();

    // Create item
    let item = match state.db.create_item(
        &user_id.0,
        &payload.workspace_id,
        &payload.title,
        payload.content.as_deref(),
        &payload.item_type,
        metadata,
        tags,
    ).await {
        Ok(item) => item,
        Err(e) => {
            error!("Failed to create item: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "item_creation_failed".to_string(),
                    message: "Failed to create item".to_string(),
                }),
            ));
        }
    };

    info!("Item created successfully: {} for user: {}", item.title, user_id.0);

    Ok(Json(item.into()))
}

pub async fn get_items(
    user_id: UserId,
    Query(params): Query<GetItemsQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ItemResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let limit = params.limit.unwrap_or(50).min(100); // max 100 items
    let offset = params.offset.unwrap_or(0);
    
    // Parse tags if provided
    let tags = params.tags.map(|t| {
        t.split(',').map(|s| s.trim().to_string()).collect::<Vec<String>>()
    });

    let items = match state.db.get_items_by_user(
        &user_id.0,
        params.workspace_id.as_deref(),
        params.item_type.as_deref(),
        tags,
        params.search.as_deref(),
        limit,
        offset,
    ).await {
        Ok(items) => items,
        Err(e) => {
            error!("Failed to get items: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch items".to_string(),
                }),
            ));
        }
    };

    let response: Vec<ItemResponse> = items.into_iter().map(|i| i.into()).collect();
    Ok(Json(response))
}

pub async fn get_item(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ItemResponse>, (StatusCode, Json<ErrorResponse>)> {
    let item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "item_not_found".to_string(),
                    message: "Item not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get item: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch item".to_string(),
                }),
            ));
        }
    };

    // Check if user owns the item
    let item_user_id = item.user_id.strip_prefix("User:").unwrap_or(&item.user_id);
    if item_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to access this item".to_string(),
            }),
        ));
    }

    Ok(Json(item.into()))
}

pub async fn update_item(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateItemRequest>,
) -> Result<Json<ItemResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    // Check if item exists and user owns it
    let existing_item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "item_not_found".to_string(),
                    message: "Item not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get item: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch item".to_string(),
                }),
            ));
        }
    };

    let item_user_id = existing_item.user_id.strip_prefix("User:").unwrap_or(&existing_item.user_id);
    if item_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to update this item".to_string(),
            }),
        ));
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
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "item_not_found".to_string(),
                    message: "Item not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to update item: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "item_update_failed".to_string(),
                    message: "Failed to update item".to_string(),
                }),
            ));
        }
    };

    info!("Item updated successfully: {} for user: {}", id, user_id.0);

    Ok(Json(updated_item.into()))
}

pub async fn delete_item(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Check if item exists and user owns it
    let item = match state.db.get_item_by_id(&id).await {
        Ok(Some(item)) => item,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "item_not_found".to_string(),
                    message: "Item not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Failed to get item: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch item".to_string(),
                }),
            ));
        }
    };

    let item_user_id = item.user_id.strip_prefix("User:").unwrap_or(&item.user_id);
    if item_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to delete this item".to_string(),
            }),
        ));
    }

    // Delete item
    if let Err(e) = state.db.delete_item(&id).await {
        error!("Failed to delete item: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "item_deletion_failed".to_string(),
                message: "Failed to delete item".to_string(),
            }),
        ));
    }

    info!("Item deleted successfully: {} for user: {}", id, user_id.0);

    Ok(StatusCode::NO_CONTENT)
}