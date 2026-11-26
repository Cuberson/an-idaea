mod db;
mod models;
mod ollama;

use db::LocalDatabase;
use models::{
    ChatCompletionRequest, ChatCompletionResponse, IdeaRecord, OllamaStatusResponse, SemanticMatch,
};
use std::sync::Arc;
use tauri::Manager;

struct AppState {
    db: Arc<LocalDatabase>,
}

#[tauri::command]
fn list_ideas(state: tauri::State<'_, AppState>) -> Result<Vec<IdeaRecord>, String> {
    state.db.list_ideas()
}

#[tauri::command]
fn save_idea(state: tauri::State<'_, AppState>, idea: IdeaRecord) -> Result<(), String> {
    state.db.save_idea(&idea)
}

#[tauri::command]
fn delete_idea(state: tauri::State<'_, AppState>, idea_id: String) -> Result<(), String> {
    state.db.delete_idea(&idea_id)
}

#[tauri::command]
async fn check_ollama_status(endpoint: String) -> Result<OllamaStatusResponse, String> {
    Ok(ollama::check_status(&endpoint).await)
}

#[tauri::command]
async fn generate_ollama_embedding(
    endpoint: String,
    model: String,
    input: String,
) -> Result<Vec<f32>, String> {
    ollama::generate_embedding(&endpoint, &model, &input).await
}

#[tauri::command]
fn semantic_search_ideas(
    state: tauri::State<'_, AppState>,
    query_vector: Vec<f32>,
    exclude_idea_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SemanticMatch>, String> {
    state
        .db
        .semantic_search(&query_vector, exclude_idea_id.as_deref(), limit.unwrap_or(5))
}

#[tauri::command]
async fn chat_with_ollama(req: ChatCompletionRequest) -> Result<ChatCompletionResponse, String> {
    ollama::chat_completion(req).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve local Tauri app data directory");
            let db_path = app_data_dir.join("an_idea_local.sqlite3");
            let database =
                LocalDatabase::open(&db_path).expect("Failed to open local SQLite database");

            app.manage(AppState {
                db: Arc::new(database),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_ideas,
            save_idea,
            delete_idea,
            check_ollama_status,
            generate_ollama_embedding,
            semantic_search_ideas,
            chat_with_ollama,
        ])
        .run(tauri::generate_context!())
        .expect("error while running an idea tauri application");
}
