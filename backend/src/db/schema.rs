use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use surrealdb::sql::{Thing, Uuid};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Thing,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUser {
    pub email: String,
    pub password_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Thing,
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSession {
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Widget {
    pub id: Thing,
    pub user_id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub position: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWidget {
    pub user_id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub position: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: Thing,
    pub user_id: String,
    pub name: String,
    pub layout: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDashboard {
    pub user_id: String,
    pub name: String,
    pub layout: serde_json::Value,
}