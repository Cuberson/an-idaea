use crate::models::{
    ChatCompletionRequest, ChatCompletionResponse, OllamaModelInfo, OllamaStatusResponse,
};
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct OllamaTagsPayload {
    models: Vec<OllamaTagEntry>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagEntry {
    name: String,
    size: Option<u64>,
    modified_at: Option<String>,
    details: Option<OllamaTagDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagDetails {
    family: Option<String>,
    parameter_size: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaEmbedPayload {
    embeddings: Option<Vec<Vec<f32>>>,
}

#[derive(Debug, Deserialize)]
struct OllamaLegacyEmbeddingsPayload {
    embedding: Option<Vec<f32>>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponsePayload {
    message: Option<OllamaChatMsgOut>,
    model: Option<String>,
    total_duration: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatMsgOut {
    content: String,
}

pub fn is_likely_embedding_model(name: &str, family: Option<&str>) -> bool {
    let lower = name.to_lowercase();
    let fam = family.unwrap_or("").to_lowercase();
    lower.contains("embed")
        || lower.contains("minilm")
        || lower.contains("bge")
        || lower.contains("e5-")
        || fam.contains("bert")
        || fam.contains("nomic-bert")
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())
}

pub async fn check_status(endpoint: &str) -> OllamaStatusResponse {
    let base = endpoint.trim_end_matches('/').to_string();
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return OllamaStatusResponse {
                connected: false,
                endpoint: base,
                models: Vec::new(),
                error: Some(e.to_string()),
            }
        }
    };

    match client.get(format!("{base}/api/tags")).send().await {
        Ok(resp) if resp.status().is_success() => match resp.json::<OllamaTagsPayload>().await {
            Ok(payload) => {
                let models = payload
                    .models
                    .into_iter()
                    .map(|m| {
                        let family = m.details.as_ref().and_then(|d| d.family.clone());
                        let param = m.details.as_ref().and_then(|d| d.parameter_size.clone());
                        let is_emb = is_likely_embedding_model(&m.name, family.as_deref());
                        OllamaModelInfo {
                            name: m.name,
                            size: m.size,
                            modified_at: m.modified_at,
                            family,
                            parameter_size: param,
                            is_embedding_model: is_emb,
                        }
                    })
                    .collect();
                OllamaStatusResponse {
                    connected: true,
                    endpoint: base,
                    models,
                    error: None,
                }
            }
            Err(e) => OllamaStatusResponse {
                connected: false,
                endpoint: base,
                models: Vec::new(),
                error: Some(format!("Invalid Ollama response: {e}")),
            },
        },
        Ok(resp) => OllamaStatusResponse {
            connected: false,
            endpoint: base,
            models: Vec::new(),
            error: Some(format!("Ollama returned HTTP {}", resp.status())),
        },
        Err(e) => OllamaStatusResponse {
            connected: false,
            endpoint: base,
            models: Vec::new(),
            error: Some(format!("Could not reach local Ollama: {e}")),
        },
    }
}

pub async fn generate_embedding(
    endpoint: &str,
    model: &str,
    input: &str,
) -> Result<Vec<f32>, String> {
    let base = endpoint.trim_end_matches('/');
    let client = build_client()?;

    // Modern Ollama /api/embed endpoint
    let resp = client
        .post(format!("{base}/api/embed"))
        .json(&serde_json::json!({
            "model": model,
            "input": input
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama embed request failed: {e}"))?;

    if resp.status().is_success() {
        let payload: OllamaEmbedPayload = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(mut list) = payload.embeddings {
            if let Some(first) = list.drain(..).next() {
                return Ok(first);
            }
        }
    }

    // Fallback for older Ollama /api/embeddings endpoint
    let legacy_resp = client
        .post(format!("{base}/api/embeddings"))
        .json(&serde_json::json!({
            "model": model,
            "prompt": input
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama legacy embedding request failed: {e}"))?;

    if !legacy_resp.status().is_success() {
        return Err(format!(
            "Ollama embedding failed with HTTP {}",
            legacy_resp.status()
        ));
    }

    let legacy_payload: OllamaLegacyEmbeddingsPayload =
        legacy_resp.json().await.map_err(|e| e.to_string())?;
    legacy_payload
        .embedding
        .ok_or_else(|| "Ollama returned an empty embedding vector".to_string())
}

pub async fn chat_completion(
    req: ChatCompletionRequest,
) -> Result<ChatCompletionResponse, String> {
    let base = req.endpoint.trim_end_matches('/');
    let client = build_client()?;

    let resp = client
        .post(format!("{base}/api/chat"))
        .json(&serde_json::json!({
            "model": req.model,
            "messages": req.messages,
            "stream": false
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama chat request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama chat returned HTTP {status}: {body}"));
    }

    let payload: OllamaChatResponsePayload = resp.json().await.map_err(|e| e.to_string())?;
    let content = payload
        .message
        .map(|m| m.content)
        .unwrap_or_default();

    Ok(ChatCompletionResponse {
        content,
        model: payload.model.unwrap_or(req.model),
        total_duration_ms: payload.total_duration.map(|ns| ns / 1_000_000),
    })
}
