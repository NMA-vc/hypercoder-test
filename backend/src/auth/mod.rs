use axum::{routing::post, Router};
use crate::AppState;

pub mod handlers;
pub mod jwt;
pub mod password;

use handlers::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/refresh", post(refresh_token))
        .route("/me", axum::routing::get(get_current_user))
}

pub mod jwt {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
    use serde::{Deserialize, Serialize};
    use std::fmt;

    #[derive(Debug, Serialize, Deserialize)]
    pub struct Claims {
        pub sub: String, // user_id
        pub exp: usize,  // expiration timestamp
        pub iat: usize,  // issued at timestamp
    }

    #[derive(Debug)]
    pub enum JwtError {
        InvalidToken,
        ExpiredToken,
        EncodingError,
    }

    impl fmt::Display for JwtError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            match self {
                JwtError::InvalidToken => write!(f, "Invalid token"),
                JwtError::ExpiredToken => write!(f, "Token expired"),
                JwtError::EncodingError => write!(f, "Token encoding error"),
            }
        }
    }

    impl std::error::Error for JwtError {}

    pub fn create_token(user_id: &str, secret: &str, duration_hours: i64) -> Result<String, JwtError> {
        let now = Utc::now();
        let exp = (now + Duration::hours(duration_hours))
            .timestamp() as usize;
        
        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now.timestamp() as usize,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_ref()),
        )
        .map_err(|_| JwtError::EncodingError)
    }

    pub fn verify_token(token: &str, secret: &str) -> Result<Claims, JwtError> {
        let validation = Validation::new(Algorithm::HS256);
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_ref()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|err| {
            match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => JwtError::ExpiredToken,
                _ => JwtError::InvalidToken,
            }
        })
    }

    pub fn extract_user_id(token: &str, secret: &str) -> Result<String, JwtError> {
        let claims = verify_token(token, secret)?;
        Ok(claims.sub)
    }
}

pub mod password {
    use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
    use argon2::password_hash::{rand_core::OsRng, SaltString};
    use std::fmt;

    #[derive(Debug)]
    pub enum PasswordError {
        HashingError,
        VerificationError,
    }

    impl fmt::Display for PasswordError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            match self {
                PasswordError::HashingError => write!(f, "Password hashing failed"),
                PasswordError::VerificationError => write!(f, "Password verification failed"),
            }
        }
    }

    impl std::error::Error for PasswordError {}

    pub fn hash_password(password: &str) -> Result<String, PasswordError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|_| PasswordError::HashingError)
    }

    pub fn verify_password(password: &str, hash: &str) -> Result<bool, PasswordError> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|_| PasswordError::VerificationError)?;
        
        let argon2 = Argon2::default();
        
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}