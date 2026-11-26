use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub id: String,
    pub idea_id: String,
    pub title: String,
    pub notes: String,
    pub status: String,   // "backlog" | "in_progress" | "review" | "done"
    pub priority: String, // "low" | "medium" | "high"
    pub position: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub created_at: String,
    pub model: Option<String>,
    pub context_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadlineItem {
    pub id: String,
    pub label: String,
    pub due_date: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedFile {
    pub id: String,
    pub filename: String,
    pub extension: String,
    pub content: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeaRecord {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub architecture_notes: String,
    pub document_content: String,
    pub stack: String,
    pub stage: String, // "spark" | "planning" | "building" | "shipped"
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deadlines: Vec<DeadlineItem>,
    pub files: Vec<GeneratedFile>,
    pub tasks: Vec<TaskItem>,
    pub messages: Vec<ChatMessage>,
    pub embedding: Option<Vec<f32>>,
    pub embedding_model: Option<String>,
    pub embedded_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModelInfo {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub is_embedding_model: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatusResponse {
    pub connected: bool,
    pub endpoint: String,
    pub models: Vec<OllamaModelInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticMatch {
    pub idea_id: String,
    pub title: String,
    pub stage: String,
    pub summary: String,
    pub similarity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompletionRequest {
    pub endpoint: String,
    pub model: String,
    pub messages: Vec<OllamaChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompletionResponse {
    pub content: String,
    pub model: String,
    pub total_duration_ms: Option<u64>,
}
