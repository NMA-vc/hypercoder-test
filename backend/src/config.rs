use std::env;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expires_in: u64,
    pub frontend_url: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let config = Config {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidPort)?,
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "surreal://localhost:8000/bentoboard/main".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::MissingJwtSecret)?
                .trim()
                .to_string(),
            jwt_expires_in: env::var("JWT_EXPIRES_IN")
                .unwrap_or_else(|_| "900".to_string()) // 15 minutes in seconds
                .parse()
                .map_err(|_| ConfigError::InvalidJwtExpiry)?,
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            log_level: env::var("LOG_LEVEL")
                .unwrap_or_else(|_| "info".to_string()),
        };

        // Validate JWT secret minimum length (256 bits = 32 bytes)
        if config.jwt_secret.len() < 32 {
            return Err(ConfigError::WeakJwtSecret);
        }

        Ok(config)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Invalid port number")]
    InvalidPort,
    #[error("JWT_SECRET environment variable is required")]
    MissingJwtSecret,
    #[error("JWT secret must be at least 32 characters (256 bits)")]
    WeakJwtSecret,
    #[error("Invalid JWT expiry time")]
    InvalidJwtExpiry,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_weak_jwt_secret() {
        std::env::set_var("JWT_SECRET", "short");
        let result = Config::from_env();
        assert!(matches!(result, Err(ConfigError::WeakJwtSecret)));
    }
    
    #[test]
    fn test_valid_config() {
        std::env::set_var("JWT_SECRET", "a_very_strong_secret_key_with_32_chars_minimum");
        let config = Config::from_env().expect("Config should be valid");
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 8080);
        assert!(config.jwt_secret.len() >= 32);
    }
}