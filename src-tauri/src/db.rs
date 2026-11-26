use crate::models::{ChatMessage, IdeaRecord, SemanticMatch, TaskItem};
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;

pub struct LocalDatabase {
    conn: Mutex<Connection>,
}

impl LocalDatabase {
    pub fn open(db_path: &Path) -> SqlResult<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS ideas (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                summary TEXT NOT NULL DEFAULT '',
                architecture_notes TEXT NOT NULL DEFAULT '',
                document_content TEXT NOT NULL DEFAULT '',
                stack TEXT NOT NULL DEFAULT '',
                stage TEXT NOT NULL DEFAULT 'spark',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deadlines_json TEXT NOT NULL DEFAULT '[]',
                files_json TEXT NOT NULL DEFAULT '[]',
                embedding_json TEXT,
                embedding_model TEXT,
                embedded_at TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                idea_id TEXT NOT NULL,
                title TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'backlog',
                priority TEXT NOT NULL DEFAULT 'medium',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                idea_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                context_ids_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
            );
            ",
        )?;

        let _ = conn.execute(
            "ALTER TABLE ideas ADD COLUMN document_content TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE ideas ADD COLUMN deadlines_json TEXT NOT NULL DEFAULT '[]'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE ideas ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]'",
            [],
        );

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn list_ideas(&self) -> Result<Vec<IdeaRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, summary, architecture_notes, document_content, stack, stage,
                        position, created_at, updated_at, deadlines_json, files_json,
                        embedding_json, embedding_model, embedded_at
                 FROM ideas
                 ORDER BY position ASC, updated_at DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let dl_json: String = row.get(10)?;
                let deadlines = serde_json::from_str(&dl_json).unwrap_or_default();
                let files_raw: String = row.get(11)?;
                let files = serde_json::from_str(&files_raw).unwrap_or_default();
                let emb_json: Option<String> = row.get(12)?;
                let embedding: Option<Vec<f32>> =
                    emb_json.and_then(|raw| serde_json::from_str(&raw).ok());
                Ok(IdeaRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    architecture_notes: row.get(3)?,
                    document_content: row.get(4)?,
                    stack: row.get(5)?,
                    stage: row.get(6)?,
                    position: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    deadlines,
                    files,
                    tasks: Vec::new(),
                    messages: Vec::new(),
                    embedding,
                    embedding_model: row.get(13)?,
                    embedded_at: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut ideas: Vec<IdeaRecord> = Vec::new();
        for row in rows {
            let mut idea = row.map_err(|e| e.to_string())?;
            idea.tasks = Self::load_tasks(&conn, &idea.id).map_err(|e| e.to_string())?;
            idea.messages = Self::load_messages(&conn, &idea.id).map_err(|e| e.to_string())?;
            ideas.push(idea);
        }

        Ok(ideas)
    }

    fn load_tasks(conn: &Connection, idea_id: &str) -> SqlResult<Vec<TaskItem>> {
        let mut stmt = conn.prepare(
            "SELECT id, idea_id, title, notes, status, priority, position, created_at
             FROM tasks WHERE idea_id = ?1 ORDER BY position ASC",
        )?;
        let rows = stmt.query_map(params![idea_id], |row| {
            Ok(TaskItem {
                id: row.get(0)?,
                idea_id: row.get(1)?,
                title: row.get(2)?,
                notes: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                position: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    fn load_messages(conn: &Connection, idea_id: &str) -> SqlResult<Vec<ChatMessage>> {
        let mut stmt = conn.prepare(
            "SELECT id, role, content, model, context_ids_json, created_at
             FROM messages WHERE idea_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![idea_id], |row| {
            let ctx_json: Option<String> = row.get(4)?;
            let context_ids: Option<Vec<String>> =
                ctx_json.and_then(|raw| serde_json::from_str(&raw).ok());
            Ok(ChatMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                model: row.get(3)?,
                context_ids,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_idea(&self, idea: &IdeaRecord) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        let dl_json = serde_json::to_string(&idea.deadlines).unwrap_or_else(|_| "[]".to_string());
        let files_json = serde_json::to_string(&idea.files).unwrap_or_else(|_| "[]".to_string());
        let emb_json = idea
            .embedding
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());

        tx.execute(
            "INSERT INTO ideas (id, title, summary, architecture_notes, document_content, stack, stage,
                                position, created_at, updated_at, deadlines_json, files_json,
                                embedding_json, embedding_model, embedded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                architecture_notes = excluded.architecture_notes,
                document_content = excluded.document_content,
                stack = excluded.stack,
                stage = excluded.stage,
                position = excluded.position,
                updated_at = excluded.updated_at,
                deadlines_json = excluded.deadlines_json,
                files_json = excluded.files_json,
                embedding_json = excluded.embedding_json,
                embedding_model = excluded.embedding_model,
                embedded_at = excluded.embedded_at",
            params![
                idea.id,
                idea.title,
                idea.summary,
                idea.architecture_notes,
                idea.document_content,
                idea.stack,
                idea.stage,
                idea.position,
                idea.created_at,
                idea.updated_at,
                dl_json,
                files_json,
                emb_json,
                idea.embedding_model,
                idea.embedded_at
            ],
        )
        .map_err(|e| e.to_string())?;

        tx.execute("DELETE FROM tasks WHERE idea_id = ?1", params![idea.id])
            .map_err(|e| e.to_string())?;
        for task in &idea.tasks {
            tx.execute(
                "INSERT INTO tasks (id, idea_id, title, notes, status, priority, position, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    task.id,
                    idea.id,
                    task.title,
                    task.notes,
                    task.status,
                    task.priority,
                    task.position,
                    task.created_at
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        tx.execute("DELETE FROM messages WHERE idea_id = ?1", params![idea.id])
            .map_err(|e| e.to_string())?;
        for msg in &idea.messages {
            let ctx_json = msg
                .context_ids
                .as_ref()
                .and_then(|c| serde_json::to_string(c).ok());
            tx.execute(
                "INSERT INTO messages (id, idea_id, role, content, model, context_ids_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    msg.id,
                    idea.id,
                    msg.role,
                    msg.content,
                    msg.model,
                    ctx_json,
                    msg.created_at
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        tx.commit().map_err(|e| e.to_string())
    }

    pub fn delete_idea(&self, idea_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ideas WHERE id = ?1", params![idea_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn semantic_search(
        &self,
        query_vector: &[f32],
        exclude_idea_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<SemanticMatch>, String> {
        let ideas = self.list_ideas()?;
        let mut scored: Vec<SemanticMatch> = ideas
            .into_iter()
            .filter(|idea| exclude_idea_id.map_or(true, |ex| ex != idea.id))
            .filter_map(|idea| {
                let emb = idea.embedding.as_ref()?;
                let sim = cosine_similarity(query_vector, emb);
                Some(SemanticMatch {
                    idea_id: idea.id,
                    title: idea.title,
                    stage: idea.stage,
                    summary: idea.summary,
                    similarity: sim,
                })
            })
            .collect();

        scored.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        scored.truncate(limit);
        Ok(scored)
    }
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0_f32;
    let mut norm_a = 0.0_f32;
    let mut norm_b = 0.0_f32;
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}
