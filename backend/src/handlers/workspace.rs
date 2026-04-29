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
use crate::db::schema::Workspace;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWorkspaceRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    pub name: String,
    #[validate(length(max = 500, message = "Description must be less than 500 characters"))]
    pub description: Option<String>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateWorkspaceRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    pub name: Option<String>,
    #[validate(length(max = 500, message = "Description must be less than 500 characters"))]
    pub description: Option<String>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub settings: serde_json::Value,
    pub user_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Workspace> for WorkspaceResponse {
    fn from(workspace: Workspace) -> Self {
        Self {
            id: workspace.id.id.to_string(),
            name: workspace.name,
            description: workspace.description,
            settings: workspace.settings,
            user_id: workspace.user_id,
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
        }
    }
}

pub async fn create_workspace(
    user_id: UserId,
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    let settings = payload.settings.unwrap_or(serde_json::json!({}));

    // Create workspace
    let workspace = match state.db.create_workspace(
        &user_id.0,
        &payload.name,
        payload.description.as_deref(),
        settings,
    ).await {
        Ok(workspace) => workspace,
        Err(e) => {
            error!("Failed to create workspace: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "workspace_creation_failed".to_string(),
                    message: "Failed to create workspace".to_string(),
                }),
            ));
        }
    };

    info!("Workspace created successfully: {} for user: {}", workspace.name, user_id.0);

    Ok(Json(workspace.into()))
}

pub async fn get_workspaces(
    user_id: UserId,
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let workspaces = match state.db.get_workspaces_by_user(&user_id.0).await {
        Ok(workspaces) => workspaces,
        Err(e) => {
            error!("Failed to get workspaces: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to fetch workspaces".to_string(),
                }),
            ));
        }
    };

    let response: Vec<WorkspaceResponse> = workspaces.into_iter().map(|w| w.into()).collect();
    Ok(Json(response))
}

pub async fn get_workspace(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<WorkspaceResponse>, (StatusCode, Json<ErrorResponse>)> {
    let workspace = match state.db.get_workspace_by_id(&id).await {
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
                    message: "Failed to fetch workspace".to_string(),
                }),
            ));
        }
    };

    // Check if user owns the workspace
    let workspace_user_id = workspace.user_id.strip_prefix("User:").unwrap_or(&workspace.user_id);
    if workspace_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to access this workspace".to_string(),
            }),
        ));
    }

    Ok(Json(workspace.into()))
}

pub async fn update_workspace(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, (StatusCode, Json<ErrorResponse>)> {
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
    let existing_workspace = match state.db.get_workspace_by_id(&id).await {
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
                    message: "Failed to fetch workspace".to_string(),
                }),
            ));
        }
    };

    let workspace_user_id = existing_workspace.user_id.strip_prefix("User:").unwrap_or(&existing_workspace.user_id);
    if workspace_user_id != user_id.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "access_denied".to_string(),
                message: "You don't have permission to update this workspace".to_string(),
            }),
        ));
    }

    // Update workspace
    let updated_workspace = match state.db.update_workspace(
        &id,
        payload.name.as_deref(),
        payload.description.as_deref(),
        payload.settings,
    ).await {
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
            error!("Failed to update workspace: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "workspace_update_failed".to_string(),
                    message: "Failed to update workspace".to_string(),
                }),
            ));
        }
    };

    info!("Workspace updated successfully: {} for user: {}", id, user_id.0);

    Ok(Json(updated_workspace.into()))
}

pub async fn delete_workspace(
    user_id: UserId,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Check if workspace exists and user owns it
    let workspace = match state.db.get_workspace_by_id(&id).await {
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
                    message: "Failed to fetch workspace".to_string(),
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
                message: "You don't have permission to delete this workspace".to_string(),
            }),
        ));
    }

    // Delete workspace
    if let Err(e) = state.db.delete_workspace(&id).await {
        error!("Failed to delete workspace: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "workspace_deletion_failed".to_string(),
                message: "Failed to delete workspace".to_string(),
            }),
        ));
    }

    info!("Workspace deleted successfully: {} for user: {}", id, user_id.0);

    Ok(StatusCode::NO_CONTENT)
}