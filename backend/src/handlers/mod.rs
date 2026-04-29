use axum::{routing::{get, post}, Router, middleware};
use crate::AppState;

mod workspace;
mod items;

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/workspaces", workspace_router())
        .nest("/items", items_router())
        .layer(middleware::from_fn_with_state(
            AppState::default(),
            crate::auth::auth_middleware,
        ))
}

fn workspace_router() -> Router<AppState> {
    Router::new()
        .route("/", get(workspace::list_workspaces).post(workspace::create_workspace))
        .route("/:id", get(workspace::get_workspace).patch(workspace::update_workspace).delete(workspace::delete_workspace))
}

fn items_router() -> Router<AppState> {
    Router::new()
        .route("/", get(items::list_items).post(items::create_item))
        .route("/:id", get(items::get_item).patch(items::update_item).delete(items::delete_item))
}