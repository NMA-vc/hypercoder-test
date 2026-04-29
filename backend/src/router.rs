use axum::{routing::get, Router};
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        .nest("/api", api_router())
        .nest("/ws", ws_router())
}

fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/auth", crate::auth::router())
        .nest("/widgets", crate::widgets::router())
        .route("/me", get(crate::auth::handlers::me))
        .route("/dashboards", get(crate::widgets::handlers::get_dashboards))
}

fn ws_router() -> Router<AppState> {
    Router::new()
        .route("/", get(crate::ws::upgrade_handler))
}

async fn health_check() -> &'static str {
    "OK"
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use tower::ServiceExt;
    
    #[tokio::test]
    async fn test_health_check() {
        let app = Router::new().route("/health", get(health_check));
        
        let request = axum::http::Request::builder()
            .uri("/health")
            .body(axum::body::Body::empty())
            .unwrap();
            
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}