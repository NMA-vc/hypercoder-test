use surrealdb::{Surreal, engine::remote::ws::{Client, Ws}, opt::auth::Root};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, error};

pub mod schema;

use schema::*;

#[derive(Debug, Clone)]
pub struct Database {
    pub client: Arc<Surreal<Client>>,
}

impl Database {
    pub async fn new(url: &str, namespace: &str, database: &str, username: &str, password: &str) -> Result<Self, Box<dyn std::error::Error>> {
        info!("Connecting to SurrealDB at {}", url);
        
        let client = Surreal::new::<Ws>(url).await?;
        
        client.signin(Root {
            username,
            password,
        }).await?;
        
        client.use_ns(namespace).use_db(database).await?;
        
        let db = Self {
            client: Arc::new(client),
        };
        
        db.migrate().await?;
        
        info!("Successfully connected to SurrealDB");
        Ok(db)
    }
    
    async fn migrate(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Running database migrations");
        
        // Define User table with schema
        self.client.query(
            "DEFINE TABLE User SCHEMAFULL;
             DEFINE FIELD id ON TABLE User TYPE record(User);
             DEFINE FIELD email ON TABLE User TYPE string ASSERT string::is::email($value);
             DEFINE FIELD password_hash ON TABLE User TYPE string;
             DEFINE FIELD created_at ON TABLE User TYPE datetime DEFAULT time::now();
             DEFINE INDEX unique_email ON TABLE User COLUMNS email UNIQUE;"
        ).await?;
        
        // Define Session table with schema
        self.client.query(
            "DEFINE TABLE Session SCHEMAFULL;
             DEFINE FIELD id ON TABLE Session TYPE record(Session);
             DEFINE FIELD user_id ON TABLE Session TYPE record(User);
             DEFINE FIELD token ON TABLE Session TYPE string;
             DEFINE FIELD expires_at ON TABLE Session TYPE datetime;
             DEFINE INDEX idx_user_id ON TABLE Session COLUMNS user_id;
             DEFINE INDEX idx_token ON TABLE Session COLUMNS token UNIQUE;"
        ).await?;
        
        // Define Widget table with schema
        self.client.query(
            "DEFINE TABLE Widget SCHEMAFULL;
             DEFINE FIELD id ON TABLE Widget TYPE record(Widget);
             DEFINE FIELD user_id ON TABLE Widget TYPE record(User);
             DEFINE FIELD type ON TABLE Widget TYPE string;
             DEFINE FIELD title ON TABLE Widget TYPE string;
             DEFINE FIELD config ON TABLE Widget TYPE object;
             DEFINE FIELD position ON TABLE Widget TYPE object;
             DEFINE FIELD updated_at ON TABLE Widget TYPE datetime DEFAULT time::now();
             DEFINE INDEX idx_user_id ON TABLE Widget COLUMNS user_id;"
        ).await?;
        
        // Define Dashboard table with schema
        self.client.query(
            "DEFINE TABLE Dashboard SCHEMAFULL;
             DEFINE FIELD id ON TABLE Dashboard TYPE record(Dashboard);
             DEFINE FIELD user_id ON TABLE Dashboard TYPE record(User);
             DEFINE FIELD name ON TABLE Dashboard TYPE string;
             DEFINE FIELD layout ON TABLE Dashboard TYPE object;
             DEFINE FIELD created_at ON TABLE Dashboard TYPE datetime DEFAULT time::now();
             DEFINE INDEX idx_user_id ON TABLE Dashboard COLUMNS user_id;"
        ).await?;
        
        info!("Database migrations completed successfully");
        Ok(())
    }
    
    pub async fn create_user(&self, email: &str, password_hash: &str) -> Result<User, surrealdb::Error> {
        let mut result = self.client
            .create(("User", surrealdb::sql::Uuid::new_v4()))
            .content(CreateUser {
                email: email.to_string(),
                password_hash: password_hash.to_string(),
            })
            .await?;
        
        result.take(0)
    }
    
    pub async fn find_user_by_email(&self, email: &str) -> Result<Option<User>, surrealdb::Error> {
        let mut result = self.client
            .query("SELECT * FROM User WHERE email = $email")
            .bind(("email", email))
            .await?;
        
        Ok(result.take(0).ok())
    }
    
    pub async fn find_user_by_id(&self, user_id: &str) -> Result<Option<User>, surrealdb::Error> {
        self.client.select(("User", user_id)).await
    }
    
    pub async fn create_session(&self, user_id: &str, token: &str, expires_at: chrono::DateTime<chrono::Utc>) -> Result<Session, surrealdb::Error> {
        let mut result = self.client
            .create(("Session", surrealdb::sql::Uuid::new_v4()))
            .content(CreateSession {
                user_id: format!("User:{}", user_id),
                token: token.to_string(),
                expires_at,
            })
            .await?;
        
        result.take(0)
    }
    
    pub async fn find_session_by_token(&self, token: &str) -> Result<Option<Session>, surrealdb::Error> {
        let mut result = self.client
            .query("SELECT * FROM Session WHERE token = $token AND expires_at > time::now()")
            .bind(("token", token))
            .await?;
        
        Ok(result.take(0).ok())
    }
    
    pub async fn delete_session(&self, token: &str) -> Result<(), surrealdb::Error> {
        self.client
            .query("DELETE FROM Session WHERE token = $token")
            .bind(("token", token))
            .await?;
        
        Ok(())
    }
    
    pub async fn cleanup_expired_sessions(&self) -> Result<(), surrealdb::Error> {
        self.client
            .query("DELETE FROM Session WHERE expires_at <= time::now()")
            .await?;
        
        Ok(())
    }
    
    pub async fn get_widgets_by_user(&self, user_id: &str) -> Result<Vec<Widget>, surrealdb::Error> {
        let mut result = self.client
            .query("SELECT * FROM Widget WHERE user_id = $user_id ORDER BY updated_at DESC")
            .bind(("user_id", format!("User:{}", user_id)))
            .await?;
        
        Ok(result.take(0).unwrap_or_default())
    }
    
    pub async fn create_widget(&self, user_id: &str, widget_type: &str, title: &str, config: serde_json::Value, position: serde_json::Value) -> Result<Widget, surrealdb::Error> {
        let mut result = self.client
            .create(("Widget", surrealdb::sql::Uuid::new_v4()))
            .content(CreateWidget {
                user_id: format!("User:{}", user_id),
                widget_type: widget_type.to_string(),
                title: title.to_string(),
                config,
                position,
            })
            .await?;
        
        result.take(0)
    }
    
    pub async fn update_widget(&self, widget_id: &str, title: Option<&str>, config: Option<serde_json::Value>, position: Option<serde_json::Value>) -> Result<Option<Widget>, surrealdb::Error> {
        let mut query = "UPDATE Widget:".to_string() + widget_id + " SET updated_at = time::now()";
        let mut bindings = Vec::new();
        
        if let Some(title) = title {
            query.push_str(", title = $title");
            bindings.push(("title", title));
        }
        
        if let Some(config) = config {
            query.push_str(", config = $config");
            bindings.push(("config", config));
        }
        
        if let Some(position) = position {
            query.push_str(", position = $position");
            bindings.push(("position", position));
        }
        
        let mut db_query = self.client.query(&query);
        for (key, value) in bindings {
            db_query = db_query.bind((key, value));
        }
        
        let mut result = db_query.await?;
        Ok(result.take(0).ok())
    }
    
    pub async fn delete_widget(&self, widget_id: &str) -> Result<(), surrealdb::Error> {
        self.client.delete(("Widget", widget_id)).await?;
        Ok(())
    }
    
    pub async fn find_widget_by_id(&self, widget_id: &str) -> Result<Option<Widget>, surrealdb::Error> {
        self.client.select(("Widget", widget_id)).await
    }
    
    pub async fn get_dashboards_by_user(&self, user_id: &str) -> Result<Vec<Dashboard>, surrealdb::Error> {
        let mut result = self.client
            .query("SELECT * FROM Dashboard WHERE user_id = $user_id ORDER BY created_at DESC")
            .bind(("user_id", format!("User:{}", user_id)))
            .await?;
        
        Ok(result.take(0).unwrap_or_default())
    }
}