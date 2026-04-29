use axum::extract::{ws::WebSocketUpgrade, State};
use axum::response::Response;
use crate::AppState;

pub async fn upgrade_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| super::handle_socket(socket, state))
}