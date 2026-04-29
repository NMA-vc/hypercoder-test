use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{AppState, db::schema::*};
use tracing::{error, info};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub settings: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub settings: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub settings: Value,
    pub user_id: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // TODO: Extract user_id from auth when auth is implemented
    let user_id = "temp_user_123";
    
    let settings = payload.settings.unwrap_or(serde_json::json!({}));
    
    match state.db.create_workspace(
        user_id,
        &payload.name,
        payload.description.as_deref(),
        settings,
    ).await {
        Ok(workspace) => {
            info!("Workspace created: {}", workspace.id);
            Ok(Json(WorkspaceResponse {
                id: workspace.id.to_string(),
                name: workspace.name,
                description: workspace.description,
                settings: workspace.settings,
                user_id: workspace.user_id,
                created_at: workspace.created_at.to_rfc3339(),
                updated_at: workspace.updated_at.to_rfc3339(),
            }))
        }
        Err(e) => {
            error!("Failed to create workspace: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_workspaces(
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceResponse>>, StatusCode> {
    // TODO: Extract user_id from auth when auth is implemented
    let user_id = "temp_user_123";
    
    match state.db.get_workspaces_by_user(user_id).await {
        Ok(workspaces) => {
            let response: Vec<WorkspaceResponse> = workspaces
                .into_iter()
                .map(|w| WorkspaceResponse {
                    id: w.id.to_string(),
                    name: w.name,
                    description: w.description,
                    settings: w.settings,
                    user_id: w.user_id,
                    created_at: w.created_at.to_rfc3339(),
                    updated_at: w.updated_at.to_rfc3339(),
                })
                .collect();
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to get workspaces: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    match state.db.get_workspace_by_id(&workspace_id).await {
        Ok(Some(workspace)) => {
            Ok(Json(WorkspaceResponse {
                id: workspace.id.to_string(),
                name: workspace.name,
                description: workspace.description,
                settings: workspace.settings,
                user_id: workspace.user_id,
                created_at: workspace.created_at.to_rfc3339(),
                updated_at: workspace.updated_at.to_rfc3339(),
            }))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get workspace: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_workspace(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    match state.db.update_workspace(
        &workspace_id,
        payload.name.as_deref(),
        payload.description.as_deref(),
        payload.settings,
    ).await {
        Ok(Some(workspace)) => {
            info!("Workspace updated: {}", workspace_id);
            Ok(Json(WorkspaceResponse {
                id: workspace.id.to_string(),
                name: workspace.name,
                description: workspace.description,
                settings: workspace.settings,
                user_id: workspace.user_id,
                created_at: workspace.created_at.to_rfc3339(),
                updated_at: workspace.updated_at.to_rfc3339(),
            }))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to update workspace: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_workspace(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    match state.db.delete_workspace(&workspace_id).await {
        Ok(()) => {
            info!("Workspace deleted: {}", workspace_id);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            error!("Failed to delete workspace: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}