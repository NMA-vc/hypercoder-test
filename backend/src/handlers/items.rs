use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{AppState, db::schema::*};
use tracing::{error, info};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateItemRequest {
    pub workspace_id: String,
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub metadata: Option<Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateItemRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub item_type: Option<String>,
    pub metadata: Option<Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemResponse {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub metadata: Value,
    pub tags: Vec<String>,
    pub user_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ItemFilters {
    pub workspace_id: Option<String>,
    pub item_type: Option<String>,
    pub tags: Option<String>, // Comma-separated tags
    pub search: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

pub async fn create_item(
    State(state): State<AppState>,
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // TODO: Extract user_id from auth when auth is implemented
    let user_id = "temp_user_123";
    
    let metadata = payload.metadata.unwrap_or(serde_json::json!({}));
    let tags = payload.tags.unwrap_or_default();
    
    match state.db.create_item(
        user_id,
        &payload.workspace_id,
        &payload.title,
        payload.content.as_deref(),
        &payload.item_type,
        metadata,
        tags,
    ).await {
        Ok(item) => {
            info!("Item created: {}", item.id);
            Ok(Json(ItemResponse {
                id: item.id.to_string(),
                workspace_id: item.workspace_id,
                title: item.title,
                content: item.content,
                item_type: item.item_type,
                metadata: item.metadata,
                tags: item.tags,
                user_id: item.user_id,
                created_at: item.created_at.to_rfc3339(),
                updated_at: item.updated_at.to_rfc3339(),
            }))
        }
        Err(e) => {
            error!("Failed to create item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_items(
    State(state): State<AppState>,
    Query(filters): Query<ItemFilters>,
) -> Result<Json<Vec<ItemResponse>>, StatusCode> {
    // TODO: Extract user_id from auth when auth is implemented
    let user_id = "temp_user_123";
    
    let tags = filters.tags
        .map(|t| t.split(',').map(|s| s.trim().to_string()).collect::<Vec<String>>())
        .unwrap_or_default();
    
    match state.db.get_items_by_user(
        user_id,
        filters.workspace_id.as_deref(),
        filters.item_type.as_deref(),
        if tags.is_empty() { None } else { Some(tags) },
        filters.search.as_deref(),
        filters.limit.unwrap_or(50),
        filters.offset.unwrap_or(0),
    ).await {
        Ok(items) => {
            let response: Vec<ItemResponse> = items
                .into_iter()
                .map(|item| ItemResponse {
                    id: item.id.to_string(),
                    workspace_id: item.workspace_id,
                    title: item.title,
                    content: item.content,
                    item_type: item.item_type,
                    metadata: item.metadata,
                    tags: item.tags,
                    user_id: item.user_id,
                    created_at: item.created_at.to_rfc3339(),
                    updated_at: item.updated_at.to_rfc3339(),
                })
                .collect();
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to get items: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_item(
    State(state): State<AppState>,
    Path(item_id): Path<String>,
) -> Result<Json<ItemResponse>, StatusCode> {
    match state.db.get_item_by_id(&item_id).await {
        Ok(Some(item)) => {
            Ok(Json(ItemResponse {
                id: item.id.to_string(),
                workspace_id: item.workspace_id,
                title: item.title,
                content: item.content,
                item_type: item.item_type,
                metadata: item.metadata,
                tags: item.tags,
                user_id: item.user_id,
                created_at: item.created_at.to_rfc3339(),
                updated_at: item.updated_at.to_rfc3339(),
            }))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_item(
    State(state): State<AppState>,
    Path(item_id): Path<String>,
    Json(payload): Json<UpdateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    match state.db.update_item(
        &item_id,
        payload.title.as_deref(),
        payload.content.as_deref(),
        payload.item_type.as_deref(),
        payload.metadata,
        payload.tags,
    ).await {
        Ok(Some(item)) => {
            info!("Item updated: {}", item_id);
            Ok(Json(ItemResponse {
                id: item.id.to_string(),
                workspace_id: item.workspace_id,
                title: item.title,
                content: item.content,
                item_type: item.item_type,
                metadata: item.metadata,
                tags: item.tags,
                user_id: item.user_id,
                created_at: item.created_at.to_rfc3339(),
                updated_at: item.updated_at.to_rfc3339(),
            }))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to update item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_item(
    State(state): State<AppState>,
    Path(item_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    match state.db.delete_item(&item_id).await {
        Ok(()) => {
            info!("Item deleted: {}", item_id);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            error!("Failed to delete item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_items_by_workspace(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
    Query(mut filters): Query<ItemFilters>,
) -> Result<Json<Vec<ItemResponse>>, StatusCode> {
    // Override workspace_id from path
    filters.workspace_id = Some(workspace_id);
    get_items(State(state), Query(filters)).await
}