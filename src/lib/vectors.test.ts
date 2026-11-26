import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdeaEmbeddingText,
  cosineSimilarity,
  findRelatedIdeas,
  isLikelyEmbeddingModelName,
} from './vectors';
import type { IdeaRecord } from '../types/idea';

const baseIdea = (overrides: Partial<IdeaRecord>): IdeaRecord => ({
  id: 'id-1',
  title: 'Sample',
  summary: '',
  architectureNotes: '',
  documentContent: '',
  stack: '',
  stage: 'spark',
  position: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deadlines: [],
  files: [],
  tasks: [],
  messages: [],
  ...overrides,
});

test('cosineSimilarity handles identical, orthogonal, and mismatched vectors', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-6);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
  assert.equal(cosineSimilarity([], []), 0);
});

test('findRelatedIdeas ranks embedding vectors accurately', () => {
  const target = baseIdea({
    id: 'target',
    title: 'Local Voice Journal',
    embedding: [1, 0, 0],
  });
  const close = baseIdea({
    id: 'close',
    title: 'Whisper Audio Notes',
    embedding: [0.9, 0.1, 0],
  });
  const far = baseIdea({
    id: 'far',
    title: '3D Shader Playground',
    embedding: [0, 0.2, 0.98],
  });

  const related = findRelatedIdeas(target, [target, far, close], 2);
  assert.equal(related.length, 2);
  assert.equal(related[0].ideaId, 'close');
  assert.equal(related[0].source, 'embedding');
  assert.ok(related[0].similarity > related[1].similarity);
});

test('findRelatedIdeas falls back to lexical similarity when embeddings are absent', () => {
  const target = baseIdea({
    id: 'a',
    title: 'Rust SQLite Vector Index',
    summary: 'Store markdown chunks with cosine search in SQLite',
  });
  const match = baseIdea({
    id: 'b',
    title: 'SQLite Markdown Search',
    summary: 'Full-text and vector search over local markdown files',
  });
  const unrelated = baseIdea({
    id: 'c',
    title: 'Sourdough Hydration Calculator',
    summary: 'Bakers percentages for kitchen loaves',
  });

  const related = findRelatedIdeas(target, [target, unrelated, match], 2);
  assert.equal(related[0].ideaId, 'b');
  assert.equal(related[0].source, 'lexical');
});

test('buildIdeaEmbeddingText includes title, stack, and tasks', () => {
  const idea = baseIdea({
    title: 'Mesh Chat',
    stack: 'Rust, Tauri 2',
    summary: 'Offline LAN chat',
    tasks: [
      {
        id: 't1',
        ideaId: 'id-1',
        title: 'Implement mDNS discovery',
        notes: 'Broadcast peer port',
        status: 'backlog',
        priority: 'high',
        position: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  });
  const text = buildIdeaEmbeddingText(idea);
  assert.match(text, /Mesh Chat/);
  assert.match(text, /Rust, Tauri 2/);
  assert.match(text, /Implement mDNS discovery/);
});

test('isLikelyEmbeddingModelName detects common Ollama embedding models', () => {
  assert.equal(isLikelyEmbeddingModelName('nomic-embed-text:latest'), true);
  assert.equal(isLikelyEmbeddingModelName('mxbai-embed-large'), true);
  assert.equal(isLikelyEmbeddingModelName('all-minilm:l6-v2'), true);
  assert.equal(isLikelyEmbeddingModelName('llama3.2:latest'), false);
});
