import { invoke } from '@tauri-apps/api/core';
import type { IdeaRecord, OllamaConfig } from '../types/idea';
import { resolveDocumentContent } from './deadlineUtils';
import { STE_DEFAULT_INSTRUCTION } from './aiProtocol';

const IDEAS_STORAGE_KEY = 'an_idea_local_workspace_v1';
const OLLAMA_CONFIG_KEY = 'an_idea_ollama_config_v1';

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)
  );
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  endpoint: 'http://127.0.0.1:11434',
  chatModel: 'llama3.2',
  embeddingModel: 'nomic-embed-text',
  useRagContext: true,
  useSteInstruction: true,
  customInstruction: STE_DEFAULT_INSTRUCTION,
};

function normalizeIdeaRecord(raw: Partial<IdeaRecord> & { id: string; title: string }): IdeaRecord {
  const summary = raw.summary ?? '';
  const architectureNotes = raw.architectureNotes ?? '';
  return {
    id: raw.id,
    title: raw.title,
    summary,
    architectureNotes,
    documentContent: resolveDocumentContent({
      documentContent: raw.documentContent ?? '',
      summary,
      architectureNotes,
    }),
    stack: raw.stack ?? '',
    stage: raw.stage ?? 'spark',
    position: raw.position ?? 0,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    deadlines: Array.isArray(raw.deadlines) ? raw.deadlines : [],
    files: Array.isArray(raw.files) ? raw.files : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    embedding: raw.embedding,
    embeddingModel: raw.embeddingModel,
    embeddedAt: raw.embeddedAt,
  };
}

export function createSeedIdeas(): IdeaRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'idea-local-search-daemon',
      title: 'Local Markdown Vector Index',
      summary:
        'A lightweight Rust background daemon that watches local project folders, chunks markdown specs, and stores embeddings in SQLite for instant offline semantic search.',
      architectureNotes: '',
      documentContent:
        'A lightweight Rust background daemon that watches local project folders, chunks markdown specs, and stores embeddings in SQLite for instant offline semantic search.\n\n## Core Architecture\n1. Watch workspace folder with the notify crate and debounce rapid saves.\n2. Chunk markdown headings at 400-token boundaries with 60-token overlap.\n3. Embed chunks locally via Ollama nomic-embed-text (/api/embed).\n4. Persist Float32 blobs inside SQLite WAL and compute cosine similarity in-memory on startup.\n\n## Open Questions\n- Should we expose a local Unix socket or only Tauri IPC commands?\n- Benchmark startup load time at 25,000 indexed chunks.',
      stack: 'Rust, Tauri 2, SQLite, Ollama (nomic-embed-text)',
      stage: 'building',
      position: 0,
      createdAt: now,
      updatedAt: now,
      deadlines: [
        {
          id: 'dl-101',
          label: 'Ollama batch embedder',
          dueDate: '2026-11-29',
          done: false,
        },
        {
          id: 'dl-102',
          label: 'SQLite vector benchmark',
          dueDate: '2026-12-08',
          done: false,
        },
      ],
      files: [
        {
          id: 'file-101',
          filename: 'embedder.rs',
          extension: '.rs',
          content: `use serde::{Deserialize, Serialize};\n\n#[derive(Serialize)]\npub struct EmbedRequest<'a> {\n    pub model: &'a str,\n    pub input: &'a str,\n}\n\n#[derive(Deserialize)]\npub struct EmbedResponse {\n    pub embeddings: Vec<Vec<f32>>,\n}\n\npub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {\n    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();\n    let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();\n    let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();\n    if na == 0.0 || nb == 0.0 { 0.0 } else { dot / (na * nb) }\n}\n`,
          updatedAt: now,
        },
        {
          id: 'file-102',
          filename: 'README.md',
          extension: '.md',
          content: `# Local Markdown Vector Index\n\n1. Start Ollama locally with \`nomic-embed-text\`.\n2. Run the Rust watcher to index local markdown files.\n3. Search chunks offline with cosine similarity.\n`,
          updatedAt: now,
        },
      ],
      tasks: [
        {
          id: 'task-101',
          ideaId: 'idea-local-search-daemon',
          title: 'Set up SQLite WAL database & chunk schema',
          notes: 'Include file hash column to skip re-embedding unchanged files.',
          status: 'done',
          priority: 'high',
          position: 0,
          createdAt: now,
        },
        {
          id: 'task-102',
          ideaId: 'idea-local-search-daemon',
          title: 'Implement Ollama /api/embed batch client',
          notes: 'Fallback cleanly to /api/embeddings for older local Ollama builds.',
          status: 'in_progress',
          priority: 'high',
          position: 0,
          createdAt: now,
        },
        {
          id: 'task-103',
          ideaId: 'idea-local-search-daemon',
          title: 'Build cosine similarity ranker with top-k snippet preview',
          notes: 'Return source path, section heading, and similarity score.',
          status: 'backlog',
          priority: 'medium',
          position: 0,
          createdAt: now,
        },
        {
          id: 'task-104',
          ideaId: 'idea-local-search-daemon',
          title: 'Add keyboard command palette shortcut (Cmd+K)',
          notes: 'Instant search across indexed ideas and code notes.',
          status: 'review',
          priority: 'low',
          position: 0,
          createdAt: now,
        },
      ],
      messages: [],
    },
    {
      id: 'idea-offline-voice-scratchpad',
      title: 'Offline Voice-to-Task Scratchpad',
      summary:
        'Capture raw spoken product thoughts while walking, transcribe locally, and extract actionable build steps using a quantized local LLM.',
      architectureNotes: '',
      documentContent:
        'Capture raw spoken product thoughts while walking, transcribe locally, and extract actionable build steps using a quantized local LLM.\n\n## Pipeline\nLocal audio capture -> Whisper.cpp bindings -> structured JSON task extraction via Ollama llama3.2 -> push confirmed tasks directly into the active project board.',
      stack: 'Rust, whisper-rs, Ollama, React',
      stage: 'planning',
      position: 1,
      createdAt: now,
      updatedAt: now,
      deadlines: [
        {
          id: 'dl-201',
          label: 'Whisper tiny latency test',
          dueDate: '2026-12-03',
          done: false,
        },
      ],
      files: [],
      tasks: [
        {
          id: 'task-201',
          ideaId: 'idea-offline-voice-scratchpad',
          title: 'Benchmark whisper-rs tiny vs base model latency',
          notes: 'Target < 1.5s transcription for 30s voice memos.',
          status: 'backlog',
          priority: 'high',
          position: 0,
          createdAt: now,
        },
        {
          id: 'task-202',
          ideaId: 'idea-offline-voice-scratchpad',
          title: 'Design prompt template for structured task extraction',
          notes: 'Output strict JSON array with title, notes, and priority.',
          status: 'in_progress',
          priority: 'medium',
          position: 0,
          createdAt: now,
        },
      ],
      messages: [],
    },
    {
      id: 'idea-local-git-release-notes',
      title: 'Offline Git Changelog Studio',
      summary:
        'Inspect local git commit diffs between tags and draft clean, human-readable release notes without sending proprietary code to external APIs.',
      architectureNotes: '',
      documentContent:
        'Inspect local git commit diffs between tags and draft clean, human-readable release notes without sending proprietary code to external APIs.\n\n## Notes\nRead git log via the git2 crate, group commits by subsystem using embeddings, and summarize changes with local Ollama qwen2.5-coder.',
      stack: 'Rust, git2, Tauri 2, Ollama',
      stage: 'spark',
      position: 2,
      createdAt: now,
      updatedAt: now,
      deadlines: [],
      files: [],
      tasks: [
        {
          id: 'task-301',
          ideaId: 'idea-local-git-release-notes',
          title: 'Parse tag-to-HEAD commit diffs with git2',
          notes: 'Exclude lockfiles and generated build artifacts.',
          status: 'backlog',
          priority: 'medium',
          position: 0,
          createdAt: now,
        },
      ],
      messages: [],
    },
    {
      id: 'idea-cli-snippet-vault',
      title: 'Terminal Snippet & Runbook Vault',
      summary:
        'A local encrypted snippet library where shell one-liners and debugging runbooks are indexed semantically by symptom rather than exact command name.',
      architectureNotes: '',
      documentContent:
        'A local encrypted snippet library where shell one-liners and debugging runbooks are indexed semantically by symptom rather than exact command name.\n\n## Design\nEmbed problem descriptions using nomic-embed-text so searching "port already in use" retrieves lsof/kill recipes immediately.',
      stack: 'Rust, SQLite, Ollama Embeddings',
      stage: 'shipped',
      position: 3,
      createdAt: now,
      updatedAt: now,
      deadlines: [
        {
          id: 'dl-401',
          label: 'JSON backup export',
          dueDate: '2026-11-20',
          done: true,
        },
      ],
      files: [],
      tasks: [
        {
          id: 'task-401',
          ideaId: 'idea-cli-snippet-vault',
          title: 'Implement SQLite persistence & export to JSON',
          notes: 'Zero-dependency local backup file.',
          status: 'done',
          priority: 'high',
          position: 0,
          createdAt: now,
        },
      ],
      messages: [],
    },
  ];
}

export async function loadIdeas(): Promise<IdeaRecord[]> {
  if (isTauriRuntime()) {
    try {
      const ideas = await invoke<IdeaRecord[]>('list_ideas');
      if (ideas.length > 0) {
        return ideas.map(normalizeIdeaRecord);
      }
      const seeds = createSeedIdeas();
      for (const seed of seeds) {
        await invoke('save_idea', { idea: seed });
      }
      return seeds;
    } catch {
      // Fallback safely to browser localStorage if Tauri state unavailable
    }
  }

  try {
    const raw = localStorage.getItem(IDEAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeIdeaRecord);
      }
    }
  } catch {
    // Corrupted local storage falls back to clean seeds
  }

  const seeds = createSeedIdeas();
  saveIdeasToLocalStorage(seeds);
  return seeds;
}

function saveIdeasToLocalStorage(ideas: IdeaRecord[]): void {
  try {
    localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
  } catch {
    // Ignore quota errors cleanly
  }
}

export async function persistIdea(
  idea: IdeaRecord,
  allIdeas: IdeaRecord[],
): Promise<void> {
  saveIdeasToLocalStorage(allIdeas);
  if (isTauriRuntime()) {
    try {
      await invoke('save_idea', { idea });
    } catch {
      // LocalStorage copy remains persisted
    }
  }
}

export async function persistAllIdeas(ideas: IdeaRecord[]): Promise<void> {
  saveIdeasToLocalStorage(ideas);
  if (isTauriRuntime()) {
    for (const idea of ideas) {
      try {
        await invoke('save_idea', { idea });
      } catch {
        // Continue saving remaining records
      }
    }
  }
}

export async function removeIdea(
  ideaId: string,
  remainingIdeas: IdeaRecord[],
): Promise<void> {
  saveIdeasToLocalStorage(remainingIdeas);
  if (isTauriRuntime()) {
    try {
      await invoke('delete_idea', { ideaId });
    } catch {
      // LocalStorage updated
    }
  }
}

export function loadOllamaConfig(): OllamaConfig {
  try {
    const raw = localStorage.getItem(OLLAMA_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_OLLAMA_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // Ignore parse error
  }
  return DEFAULT_OLLAMA_CONFIG;
}

export function saveOllamaConfig(config: OllamaConfig): void {
  try {
    localStorage.setItem(OLLAMA_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage error
  }
}
