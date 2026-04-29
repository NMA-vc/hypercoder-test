use axum::{routing::post, Router};
use crate::AppState;

mod handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(handlers::login))
        .route("/register", post(handlers::register))
        .route("/logout", post(handlers::logout))
        .route("/me", axum::routing::get(handlers::me))
}

pub use handlers::*;