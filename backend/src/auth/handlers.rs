use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, EncodingKey, Header};
use chrono::{Duration, Utc};
use uuid::Uuid;
use validator::Validate;
use crate::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id
    pub exp: usize,  // expiration time
    pub iat: usize,  // issued at
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if let Err(_) = req.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid email or password (minimum 6 characters)".to_string(),
            }),
        ));
    }

    // Check if user already exists
    match state.db.find_user_by_email(&req.email).await {
        Ok(Some(_)) => {
            return Err((
                StatusCode::CONFLICT,
                Json(ErrorResponse {
                    error: "User with this email already exists".to_string(),
                }),
            ));
        }
        Ok(None) => {}
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Database error".to_string(),
                }),
            ));
        }
    }

    // Hash password
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    let password_hash = match argon2.hash_password(req.password.as_bytes(), &salt) {
        Ok(hash) => hash.to_string(),
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to hash password".to_string(),
                }),
            ));
        }
    };

    // Create user
    let user = match state.db.create_user(&req.email, &password_hash).await {
        Ok(user) => user,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create user".to_string(),
                }),
            ));
        }
    };

    // Generate JWT token
    let user_id = user.id.id.to_string();
    let token = generate_token(&user_id, &state.config.jwt_secret)?;

    // Create session
    let expires_at = Utc::now() + Duration::days(7);
    if let Err(_) = state.db.create_session(&user_id, &token, expires_at).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create session".to_string(),
            }),
        ));
    }

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: UserInfo {
                id: user_id,
                email: user.email,
                created_at: user.created_at,
            },
        }),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if let Err(_) = req.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid email format".to_string(),
            }),
        ));
    }

    // Find user by email
    let user = match state.db.find_user_by_email(&req.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Invalid credentials".to_string(),
                }),
            ));
        }
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Database error".to_string(),
                }),
            ));
        }
    };

    // Verify password
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(hash) => hash,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Invalid password hash".to_string(),
                }),
            ));
        }
    };

    let argon2 = Argon2::default();
    if let Err(_) = argon2.verify_password(req.password.as_bytes(), &parsed_hash) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Invalid credentials".to_string(),
            }),
        ));
    }

    // Generate JWT token
    let user_id = user.id.id.to_string();
    let token = generate_token(&user_id, &state.config.jwt_secret)?;

    // Create session
    let expires_at = Utc::now() + Duration::days(7);
    if let Err(_) = state.db.create_session(&user_id, &token, expires_at).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create session".to_string(),
            }),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            token,
            user: UserInfo {
                id: user_id,
                email: user.email,
                created_at: user.created_at,
            },
        }),
    ))
}

pub async fn logout(
    State(state): State<AppState>,
    // TODO: Extract JWT token from Authorization header
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // For now, just return success since we don't have middleware to extract the token yet
    // In a complete implementation, we would:
    // 1. Extract the JWT token from the Authorization header
    // 2. Delete the session from the database
    Ok(StatusCode::OK)
}

fn generate_token(
    user_id: &str,
    secret: &str,
) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        exp: (now + Duration::days(7)).timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    ) {
        Ok(token) => Ok(token),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to generate token".to_string(),
            }),
        )),
    }
}
