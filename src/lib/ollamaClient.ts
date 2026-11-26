import { invoke } from '@tauri-apps/api/core';
import type {
  IdeaRecord,
  OllamaConfig,
  OllamaModelInfo,
  OllamaStatusResponse,
  SemanticMatch,
} from '../types/idea';
import { isTauriRuntime } from './storage';
import { buildIdeaEmbeddingText, isLikelyEmbeddingModelName } from './vectors';

export async function checkOllamaStatus(
  endpoint: string,
): Promise<OllamaStatusResponse> {
  const cleanEndpoint = endpoint.trim().replace(/\/+$/, '');

  if (isTauriRuntime()) {
    return invoke<OllamaStatusResponse>('check_ollama_status', {
      endpoint: cleanEndpoint,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${cleanEndpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        connected: false,
        endpoint: cleanEndpoint,
        models: [],
        error: `Ollama returned HTTP ${resp.status}`,
      };
    }

    const data = await resp.json();
    const rawModels = Array.isArray(data?.models) ? data.models : [];
    const models: OllamaModelInfo[] = rawModels.map(
      (m: {
        name: string;
        size?: number;
        modified_at?: string;
        details?: { family?: string; parameter_size?: string };
      }) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
        isEmbeddingModel: isLikelyEmbeddingModelName(
          m.name,
          m.details?.family,
        ),
      }),
    );

    return {
      connected: true,
      endpoint: cleanEndpoint,
      models,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unable to reach local Ollama';
    return {
      connected: false,
      endpoint: cleanEndpoint,
      models: [],
      error: message.includes('abort')
        ? 'Connection timed out reaching local Ollama'
        : message,
    };
  }
}

export async function generateEmbedding(
  endpoint: string,
  model: string,
  input: string,
): Promise<number[]> {
  const cleanEndpoint = endpoint.trim().replace(/\/+$/, '');

  if (isTauriRuntime()) {
    return invoke<number[]>('generate_ollama_embedding', {
      endpoint: cleanEndpoint,
      model,
      input,
    });
  }

  // Modern Ollama /api/embed
  const resp = await fetch(`${cleanEndpoint}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (Array.isArray(data?.embeddings) && Array.isArray(data.embeddings[0])) {
      return data.embeddings[0];
    }
  }

  // Legacy Ollama /api/embeddings fallback
  const legacyResp = await fetch(`${cleanEndpoint}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: input }),
  });

  if (!legacyResp.ok) {
    throw new Error(`Ollama embedding failed (HTTP ${legacyResp.status})`);
  }

  const legacyData = await legacyResp.json();
  if (!Array.isArray(legacyData?.embedding)) {
    throw new Error('Ollama returned an empty embedding vector.');
  }
  return legacyData.embedding;
}

export async function runOllamaPlanningChat(params: {
  config: OllamaConfig;
  activeIdea: IdeaRecord;
  relatedIdeas: SemanticMatch[];
  allIdeas: IdeaRecord[];
  userPrompt: string;
}): Promise<{ content: string; model: string; durationMs?: number }> {
  const { config, activeIdea, relatedIdeas, allIdeas, userPrompt } = params;
  const cleanEndpoint = config.endpoint.trim().replace(/\/+$/, '');

  const relatedContextBlocks = config.useRagContext
    ? relatedIdeas
        .map((match) => {
          const full = allIdeas.find((i) => i.id === match.ideaId);
          if (!full) return null;
          return `### Related Idea (${Math.round(match.similarity * 100)}% ${match.source} match): ${full.title} [${full.stage}]\nStack: ${full.stack || 'Unspecified'}\nSummary: ${full.summary}\nNotes: ${full.architectureNotes.slice(0, 350)}`;
        })
        .filter(Boolean)
        .join('\n\n')
    : '';

  const steBlock = config.useSteInstruction
    ? `STYLE & LANGUAGE INSTRUCTION (MANDATORY):\n${config.customInstruction.trim()}`
    : config.customInstruction.trim()
      ? `CUSTOM INSTRUCTION:\n${config.customInstruction.trim()}`
      : '';

  const systemPrompt = [
    'You are a pragmatic local software & product engineering partner inside "an idea", a completely local Rust + Tauri 2 workbench.',
    'Help the user research, ideate, refine requirements, and build real files and tasks.',
    steBlock,
    'TOOLS & STRUCTURED OUTPUTS:',
    '1. ASKING QUESTIONS: When you need clarification to curate a better build or file set, ask 2-4 concise questions inside a fenced ```json block: {"questions": [{"question": "...", "options": ["Option A", "Option B", "Option C"]}]}.',
    '2. FILE GENERATION TOOL: When generating starter files, scripts, or specs, include them inside a fenced ```json block: {"files": [{"filename": "main.py", "content": "..."}]}. Support any extension such as .py, .rs, .md, .ts, .toml.',
    '3. TASK BREAKDOWN: When proposing tasks, include a "tasks" array with objects containing "title", "notes", and "priority" ("low" | "medium" | "high").',
    '',
    'ACTIVE IDEA CONTEXT:',
    buildIdeaEmbeddingText(activeIdea),
    relatedContextBlocks
      ? `\nSEMANTICALLY RELATED IDEAS FROM USER'S LOCAL LIBRARY:\n${relatedContextBlocks}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const history = activeIdea.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userPrompt },
  ];

  if (isTauriRuntime()) {
    const res = await invoke<{
      content: string;
      model: string;
      totalDurationMs?: number;
    }>('chat_with_ollama', {
      req: {
        endpoint: cleanEndpoint,
        model: config.chatModel,
        messages,
      },
    });
    return {
      content: res.content,
      model: res.model,
      durationMs: res.totalDurationMs,
    };
  }

  const resp = await fetch(`${cleanEndpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.chatModel,
      messages,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(
      `Ollama chat error (HTTP ${resp.status})${errText ? `: ${errText}` : ''}`,
    );
  }

  const data = await resp.json();
  return {
    content: data?.message?.content ?? '',
    model: data?.model ?? config.chatModel,
    durationMs:
      typeof data?.total_duration === 'number'
        ? Math.round(data.total_duration / 1_000_000)
        : undefined,
  };
}
