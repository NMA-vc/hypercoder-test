use axum::{
    extract::{State, Request},
    http::{StatusCode, HeaderMap},
    response::Json,
    middleware::Next,
};
use serde::{Deserialize, Serialize};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use chrono::{Utc, Duration};
use validator::Validate;
use uuid::Uuid;
use anyhow::Result;
use tracing::{info, warn, error};
use std::sync::Arc;

use crate::AppState;
use crate::db::schema::User;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub token: Option<String>,
    pub user: Option<UserResponse>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
    iat: usize,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    if let Err(_) = payload.validate() {
        return Ok(Json(AuthResponse {
            success: false,
            message: "Invalid input".to_string(),
            token: None,
            user: None,
        }));
    }

    // Check if user already exists
    match state.db.find_user_by_email(&payload.email).await {
        Ok(Some(_)) => {
            return Ok(Json(AuthResponse {
                success: false,
                message: "User already exists".to_string(),
                token: None,
                user: None,
            }));
        },
        Ok(None) => {},
        Err(e) => {
            error!("Database error checking user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = match argon2.hash_password(payload.password.as_bytes(), &salt) {
        Ok(hash) => hash.to_string(),
        Err(e) => {
            error!("Password hashing error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create user
    let user = match state.db.create_user(&payload.email, &password_hash).await {
        Ok(user) => user,
        Err(e) => {
            error!("Database error creating user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Generate JWT token
    let user_id = user.id.id.to_string();
    let token = match generate_token(&user_id, &state.config.jwt_secret) {
        Ok(token) => token,
        Err(e) => {
            error!("Token generation error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create session
    let session_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(30);
    
    if let Err(e) = state.db.create_session(&user_id, &session_token, expires_at).await {
        error!("Session creation error: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("User registered: {}", payload.email);

    Ok(Json(AuthResponse {
        success: true,
        message: "Registration successful".to_string(),
        token: Some(token),
        user: Some(UserResponse {
            id: user_id,
            email: user.email,
            created_at: user.created_at,
        }),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    if let Err(_) = payload.validate() {
        return Ok(Json(AuthResponse {
            success: false,
            message: "Invalid input".to_string(),
            token: None,
            user: None,
        }));
    }

    // Find user by email
    let user = match state.db.find_user_by_email(&payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            warn!("Login attempt for non-existent user: {}", payload.email);
            return Ok(Json(AuthResponse {
                success: false,
                message: "Invalid credentials".to_string(),
                token: None,
                user: None,
            }));
        },
        Err(e) => {
            error!("Database error finding user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Verify password
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(hash) => hash,
        Err(e) => {
            error!("Password hash parsing error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let argon2 = Argon2::default();
    if argon2.verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
        warn!("Invalid password for user: {}", payload.email);
        return Ok(Json(AuthResponse {
            success: false,
            message: "Invalid credentials".to_string(),
            token: None,
            user: None,
        }));
    }

    // Generate JWT token
    let user_id = user.id.id.to_string();
    let token = match generate_token(&user_id, &state.config.jwt_secret) {
        Ok(token) => token,
        Err(e) => {
            error!("Token generation error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create session
    let session_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(30);
    
    if let Err(e) = state.db.create_session(&user_id, &session_token, expires_at).await {
        error!("Session creation error: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("User logged in: {}", payload.email);

    Ok(Json(AuthResponse {
        success: true,
        message: "Login successful".to_string(),
        token: Some(token),
        user: Some(UserResponse {
            id: user_id,
            email: user.email,
            created_at: user.created_at,
        }),
    }))
}

pub async fn logout(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Result<Json<AuthResponse>, StatusCode> {
    if let Some(auth_header) = headers.get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                // Delete session from database
                if let Err(e) = state.db.delete_session(token).await {
                    error!("Session deletion error: {}", e);
                }
            }
        }
    }

    Ok(Json(AuthResponse {
        success: true,
        message: "Logout successful".to_string(),
        token: None,
        user: None,
    }))
}

pub async fn me(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let token = match extract_token(&headers) {
        Some(token) => token,
        None => {
            return Ok(Json(AuthResponse {
                success: false,
                message: "No token provided".to_string(),
                token: None,
                user: None,
            }));
        }
    };

    // Validate token and get user ID
    let user_id = match validate_token(&token, &state.config.jwt_secret) {
        Ok(user_id) => user_id,
        Err(_) => {
            return Ok(Json(AuthResponse {
                success: false,
                message: "Invalid token".to_string(),
                token: None,
                user: None,
            }));
        }
    };

    // Get user from database
    let user = match state.db.find_user_by_id(&user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(Json(AuthResponse {
                success: false,
                message: "User not found".to_string(),
                token: None,
                user: None,
            }));
        },
        Err(e) => {
            error!("Database error finding user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(AuthResponse {
        success: true,
        message: "User found".to_string(),
        token: Some(token),
        user: Some(UserResponse {
            id: user.id.id.to_string(),
            email: user.email,
            created_at: user.created_at,
        }),
    }))
}

pub async fn auth_middleware(
    headers: HeaderMap,
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<axum::response::Response, StatusCode> {
    let token = match extract_token(&headers) {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let user_id = match validate_token(&token, &state.config.jwt_secret) {
        Ok(user_id) => user_id,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    // Add user_id to request extensions for use in handlers
    request.extensions_mut().insert(user_id);
    
    Ok(next.run(request).await)
}

fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn generate_token(user_id: &str, secret: &str) -> Result<String> {
    let now = Utc::now();
    let exp = (now + Duration::hours(24)).timestamp() as usize;
    let iat = now.timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp,
        iat,
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )?;

    Ok(token)
}

fn validate_token(token: &str, secret: &str) -> Result<String> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )?;

    Ok(token_data.claims.sub)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation_and_validation() {
        let secret = "test_secret";
        let user_id = "test_user";
        
        let token = generate_token(user_id, secret).unwrap();
        let validated_user_id = validate_token(&token, secret).unwrap();
        
        assert_eq!(user_id, validated_user_id);
    }

    #[test]
    fn test_invalid_token() {
        let secret = "test_secret";
        let invalid_token = "invalid.token.here";
        
        assert!(validate_token(invalid_token, secret).is_err());
    }
}