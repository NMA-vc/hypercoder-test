use axum::{
    extract::{Path, Query, Request, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use validator::Validate;
use tracing::{info, error};
use crate::AppState;
use crate::db::schema::Workspace;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateWorkspaceRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(max = 500))]
    pub description: Option<String>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateWorkspaceRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    #[validate(length(max = 500))]
    pub description: Option<String>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub success: bool,
    pub workspace: Option<Workspace>,
    pub workspaces: Option<Vec<Workspace>>,
    pub message: String,
}

pub async fn create_workspace(
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(WorkspaceResponse {
            success: false,
            workspace: None,
            workspaces: None,
            message: "Invalid input".to_string(),
        }));
    }

    // Get user_id from request extensions (set by auth middleware)
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    let settings = payload.settings.unwrap_or_else(|| serde_json::json!({}));

    // Create workspace
    let workspace = match state.db.create_workspace(
        &user_id,
        &payload.name,
        payload.description.as_deref(),
        settings,
    ).await {
        Ok(workspace) => workspace,
        Err(e) => {
            error!("Database error creating workspace: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Workspace created: {} for user {}", payload.name, user_id);

    Ok(Json(WorkspaceResponse {
        success: true,
        workspace: Some(workspace),
        workspaces: None,
        message: "Workspace created successfully".to_string(),
    }))
}

pub async fn list_workspaces(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get workspaces for user
    let workspaces = match state.db.get_workspaces_by_user(&user_id).await {
        Ok(workspaces) => workspaces,
        Err(e) => {
            error!("Database error getting workspaces: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(WorkspaceResponse {
        success: true,
        workspace: None,
        workspaces: Some(workspaces),
        message: "Workspaces retrieved successfully".to_string(),
    }))
}

pub async fn get_workspace(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get workspace by ID
    let workspace = match state.db.get_workspace_by_id(&id).await {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            return Ok(Json(WorkspaceResponse {
                success: false,
                workspace: None,
                workspaces: None,
                message: "Workspace not found".to_string(),
            }));
        },
        Err(e) => {
            error!("Database error getting workspace: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Check if workspace belongs to user
    if workspace.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(WorkspaceResponse {
        success: true,
        workspace: Some(workspace),
        workspaces: None,
        message: "Workspace retrieved successfully".to_string(),
    }))
}

pub async fn update_workspace(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // Validate input
    if let Err(_) = payload.validate() {
        return Ok(Json(WorkspaceResponse {
            success: false,
            workspace: None,
            workspaces: None,
            message: "Invalid input".to_string(),
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

    // Check if workspace exists and belongs to user
    let existing_workspace = match state.db.get_workspace_by_id(&id).await {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            return Ok(Json(WorkspaceResponse {
                success: false,
                workspace: None,
                workspaces: None,
                message: "Workspace not found".to_string(),
            }));
        },
        Err(e) => {
            error!("Database error getting workspace: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_workspace.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
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
            return Ok(Json(WorkspaceResponse {
                success: false,
                workspace: None,
                workspaces: None,
                message: "Failed to update workspace".to_string(),
            }));
        },
        Err(e) => {
            error!("Database error updating workspace: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    info!("Workspace updated: {} by user {}", id, user_id);

    Ok(Json(WorkspaceResponse {
        success: true,
        workspace: Some(updated_workspace),
        workspaces: None,
        message: "Workspace updated successfully".to_string(),
    }))
}

pub async fn delete_workspace(
    Path(id): Path<String>,
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    // Get user_id from request extensions
    let user_id = match request.extensions().get::<String>() {
        Some(id) => id.clone(),
        None => {
            error!("No user_id found in request extensions");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if workspace exists and belongs to user
    let existing_workspace = match state.db.get_workspace_by_id(&id).await {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            return Ok(Json(WorkspaceResponse {
                success: false,
                workspace: None,
                workspaces: None,
                message: "Workspace not found".to_string(),
            }));
        },
        Err(e) => {
            error!("Database error getting workspace: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if existing_workspace.user_id != format!("User:{}", user_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Delete workspace
    if let Err(e) = state.db.delete_workspace(&id).await {
        error!("Database error deleting workspace: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Workspace deleted: {} by user {}", id, user_id);

    Ok(Json(WorkspaceResponse {
        success: true,
        workspace: None,
        workspaces: None,
        message: "Workspace deleted successfully".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_create_workspace_request_validation() {
        let valid_request = CreateWorkspaceRequest {
            name: "Test Workspace".to_string(),
            description: Some("A test workspace".to_string()),
            settings: Some(json!({"theme": "dark"})),
        };
        assert!(valid_request.validate().is_ok());

        let invalid_request = CreateWorkspaceRequest {
            name: "".to_string(), // Empty name should fail
            description: None,
            settings: None,
        };
        assert!(invalid_request.validate().is_err());
    }
}