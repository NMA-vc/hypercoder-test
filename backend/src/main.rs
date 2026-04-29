use axum::{http::Method, routing::get, Router};
use std::{env, net::SocketAddr, str::FromStr, sync::Arc};
use tokio::net::TcpListener;
use tower::{ServiceBuilder, limit::RateLimitLayer};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
    compression::CompressionLayer,
    set_header::SetResponseHeaderLayer,
};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod config;
mod router;
mod db;
mod auth;
mod widgets;
mod ws;

use config::Config;
use crate::db::Db;
use crate::ws::Hub;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Db>,
    pub config: Arc<Config>,
    pub ws_hub: Arc<Hub>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting BentoBoard backend");

    // Load configuration
    let config = Arc::new(Config::from_env()?);
    info!("Configuration loaded");

    // Initialize database connection
    let db = Arc::new(Db::connect(&config.database_url).await?);
    db.migrate().await?;
    info!("Database connected and migrated");

    // Initialize WebSocket hub
    let ws_hub = Arc::new(Hub::new());
    info!("WebSocket hub initialized");

    let state = AppState {
        db,
        config: config.clone(),
        ws_hub,
    };

    // Build application with middleware stack
    let app = Router::new()
        .merge(router::create_router())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CompressionLayer::new())
                .layer(RateLimitLayer::new(100, std::time::Duration::from_secs(60)))
                .layer(
                    CorsLayer::new()
                        .allow_origin(config.frontend_url.parse::<tower_http::cors::AllowOrigin>().unwrap())
                        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
                        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE])
                        .allow_credentials(true),
                )
                .layer(SetResponseHeaderLayer::if_not_present(
                    axum::http::header::X_CONTENT_TYPE_OPTIONS,
                    axum::http::HeaderValue::from_static("nosniff"),
                ))
                .layer(SetResponseHeaderLayer::if_not_present(
                    axum::http::header::X_FRAME_OPTIONS,
                    axum::http::HeaderValue::from_static("DENY"),
                ))
                .layer(SetResponseHeaderLayer::if_not_present(
                    axum::http::header::REFERRER_POLICY,
                    axum::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
                ))
        )
        .with_state(state);

    // Start server
    let addr = SocketAddr::from_str(&format!("{}:{}", config.host, config.port))?;
    let listener = TcpListener::bind(addr).await?;
    
    info!("Server listening on {}", addr);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}