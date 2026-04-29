use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    response::Json,
    middleware::Next,
};
use serde::{Deserialize, Serialize};
use validator::Validate;
use tracing::{error, info};
use chrono::{Duration, Utc};

use crate::AppState;
use super::{jwt, password};

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub user_id: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    // Check if user already exists
    match state.db.find_user_by_email(&payload.email).await {
        Ok(Some(_)) => {
            return Err((
                StatusCode::CONFLICT,
                Json(ErrorResponse {
                    error: "user_exists".to_string(),
                    message: "User with this email already exists".to_string(),
                }),
            ));
        }
        Ok(None) => {}
        Err(e) => {
            error!("Database error checking user existence: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to check user existence".to_string(),
                }),
            ));
        }
    }

    // Hash password
    let password_hash = match password::hash_password(&payload.password) {
        Ok(hash) => hash,
        Err(e) => {
            error!("Password hashing failed: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "password_hashing_failed".to_string(),
                    message: "Failed to process password".to_string(),
                }),
            ));
        }
    };

    // Create user
    let user = match state.db.create_user(&payload.email, &password_hash).await {
        Ok(user) => user,
        Err(e) => {
            error!("Failed to create user: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "user_creation_failed".to_string(),
                    message: "Failed to create user".to_string(),
                }),
            ));
        }
    };

    let user_id = user.id.id.to_string();
    
    // Create tokens
    let access_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 1) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create access token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create access token".to_string(),
                }),
            ));
        }
    };

    let refresh_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 24 * 7) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create refresh token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create refresh token".to_string(),
                }),
            ));
        }
    };

    // Store refresh token in database
    let expires_at = Utc::now() + Duration::days(7);
    if let Err(e) = state.db.create_session(&user_id, &refresh_token, expires_at).await {
        error!("Failed to create session: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "session_creation_failed".to_string(),
                message: "Failed to create session".to_string(),
            }),
        ));
    }

    info!("User registered successfully: {}", user.email);

    Ok(Json(AuthResponse {
        user_id,
        email: user.email,
        access_token,
        refresh_token,
        expires_in: 3600, // 1 hour in seconds
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    // Find user by email
    let user = match state.db.find_user_by_email(&payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_credentials".to_string(),
                    message: "Invalid email or password".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Database error finding user: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to authenticate user".to_string(),
                }),
            ));
        }
    };

    // Verify password
    match password::verify_password(&payload.password, &user.password_hash) {
        Ok(true) => {},
        Ok(false) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_credentials".to_string(),
                    message: "Invalid email or password".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Password verification failed: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "password_verification_failed".to_string(),
                    message: "Failed to verify password".to_string(),
                }),
            ));
        }
    }

    let user_id = user.id.id.to_string();
    
    // Create tokens
    let access_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 1) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create access token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create access token".to_string(),
                }),
            ));
        }
    };

    let refresh_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 24 * 7) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create refresh token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create refresh token".to_string(),
                }),
            ));
        }
    };

    // Store refresh token in database
    let expires_at = Utc::now() + Duration::days(7);
    if let Err(e) = state.db.create_session(&user_id, &refresh_token, expires_at).await {
        error!("Failed to create session: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "session_creation_failed".to_string(),
                message: "Failed to create session".to_string(),
            }),
        ));
    }

    info!("User logged in successfully: {}", user.email);

    Ok(Json(AuthResponse {
        user_id,
        email: user.email,
        access_token,
        refresh_token,
        expires_in: 3600, // 1 hour in seconds
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Delete session from database
    if let Err(e) = state.db.delete_session(&payload.refresh_token).await {
        error!("Failed to delete session: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "logout_failed".to_string(),
                message: "Failed to logout".to_string(),
            }),
        ));
    }

    info!("User logged out successfully");
    Ok(StatusCode::OK)
}

pub async fn refresh_token(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Verify refresh token
    let user_id = match jwt::extract_user_id(&payload.refresh_token, &state.config.jwt_secret) {
        Ok(user_id) => user_id,
        Err(e) => {
            error!("Invalid refresh token: {}", e);
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_token".to_string(),
                    message: "Invalid refresh token".to_string(),
                }),
            ));
        }
    };

    // Check if session exists in database
    let session = match state.db.find_session_by_token(&payload.refresh_token).await {
        Ok(Some(session)) => session,
        Ok(None) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_session".to_string(),
                    message: "Session not found or expired".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Database error finding session: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to validate session".to_string(),
                }),
            ));
        }
    };

    // Get user details
    let user = match state.db.find_user_by_id(&user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "user_not_found".to_string(),
                    message: "User not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Database error finding user: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to find user".to_string(),
                }),
            ));
        }
    };

    // Create new access token
    let access_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 1) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create access token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create access token".to_string(),
                }),
            ));
        }
    };

    // Create new refresh token
    let new_refresh_token = match jwt::create_token(&user_id, &state.config.jwt_secret, 24 * 7) {
        Ok(token) => token,
        Err(e) => {
            error!("Failed to create refresh token: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "token_creation_failed".to_string(),
                    message: "Failed to create refresh token".to_string(),
                }),
            ));
        }
    };

    // Delete old session and create new one
    if let Err(e) = state.db.delete_session(&payload.refresh_token).await {
        error!("Failed to delete old session: {}", e);
    }

    let expires_at = Utc::now() + Duration::days(7);
    if let Err(e) = state.db.create_session(&user_id, &new_refresh_token, expires_at).await {
        error!("Failed to create new session: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "session_creation_failed".to_string(),
                message: "Failed to create session".to_string(),
            }),
        ));
    }

    info!("Token refreshed successfully for user: {}", user.email);

    Ok(Json(AuthResponse {
        user_id: user.id.id.to_string(),
        email: user.email,
        access_token,
        refresh_token: new_refresh_token,
        expires_in: 3600, // 1 hour in seconds
    }))
}

pub async fn get_current_user(
    user_id: UserId,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user = match state.db.find_user_by_id(&user_id.0).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "user_not_found".to_string(),
                    message: "User not found".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Database error finding user: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: "Failed to get user info".to_string(),
                }),
            ));
        }
    };

    Ok(Json(UserResponse {
        user_id: user.id.id.to_string(),
        email: user.email,
    }))
}

// Extractor for authenticated user
#[derive(Debug, Clone)]
pub struct UserId(pub String);

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for UserId
where
    AppState: axum::extract::FromRef<S>,
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<ErrorResponse>);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let state: AppState = axum::extract::FromRef::from_ref(state);
        
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ErrorResponse {
                        error: "missing_token".to_string(),
                        message: "Authorization header missing".to_string(),
                    }),
                )
            })?
            .to_str()
            .map_err(|_| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ErrorResponse {
                        error: "invalid_header".to_string(),
                        message: "Invalid authorization header".to_string(),
                    }),
                )
            })?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ErrorResponse {
                        error: "invalid_token_format".to_string(),
                        message: "Token must be in Bearer format".to_string(),
                    }),
                )
            })?;

        let user_id = jwt::extract_user_id(token, &state.config.jwt_secret)
            .map_err(|e| {
                error!("Token verification failed: {}", e);
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ErrorResponse {
                        error: "invalid_token".to_string(),
                        message: "Invalid or expired token".to_string(),
                    }),
                )
            })?;

        Ok(UserId(user_id))
    }
}

// Middleware for authentication
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<axum::response::Response, (StatusCode, Json<ErrorResponse>)> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "missing_token".to_string(),
                    message: "Authorization header missing".to_string(),
                }),
            )
        })?
        .to_str()
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_header".to_string(),
                    message: "Invalid authorization header".to_string(),
                }),
            )
        })?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_token_format".to_string(),
                    message: "Token must be in Bearer format".to_string(),
                }),
            )
        })?;

    let _user_id = jwt::extract_user_id(token, &state.config.jwt_secret)
        .map_err(|e| {
            error!("Token verification failed: {}", e);
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "invalid_token".to_string(),
                    message: "Invalid or expired token".to_string(),
                }),
            )
        })?;

    Ok(next.run(request).await)
}