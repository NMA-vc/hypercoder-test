use axum::Router;
use crate::AppState;

pub mod workspace;
pub mod items;

use workspace::*;
use items::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/workspaces", workspace_router())
        .nest("/items", items_router())
}

fn workspace_router() -> Router<AppState> {
    use axum::routing::{get, post, patch, delete};
    
    Router::new()
        .route("/", get(get_workspaces).post(create_workspace))
        .route("/:id", get(get_workspace).patch(update_workspace).delete(delete_workspace))
}

fn items_router() -> Router<AppState> {
    use axum::routing::{get, post, patch, delete};
    
    Router::new()
        .route("/", get(get_items).post(create_item))
        .route("/:id", get(get_item).patch(update_item).delete(delete_item))
}