import type { IdeaRecord, SemanticMatch } from '../types/idea';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }
  return dot / denom;
}

export function buildIdeaEmbeddingText(idea: IdeaRecord): string {
  const taskLines = idea.tasks
    .map((t) => `- [${t.status}] ${t.title}${t.notes ? `: ${t.notes}` : ''}`)
    .join('\n');
  const deadlineLines = (idea.deadlines ?? [])
    .map((d) => `- ${d.label} (${d.dueDate}${d.done ? ', done' : ''})`)
    .join('\n');
  const docBody =
    idea.documentContent?.trim() ||
    [idea.summary, idea.architectureNotes].filter(Boolean).join('\n\n');

  return [
    `Title: ${idea.title}`,
    `Stage: ${idea.stage}`,
    idea.stack ? `Stack: ${idea.stack}` : '',
    docBody ? `Document:\n${docBody}` : '',
    deadlineLines ? `Deadlines:\n${deadlineLines}` : '',
    taskLines ? `Tasks:\n${taskLines}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
  'will', 'are', 'was', 'were', 'has', 'had', 'not', 'but', 'can', 'use',
  'using', 'local', 'app', 'application', 'idea', 'build', 'plan',
]);

export function tokenizeForSimilarity(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function lexicalSimilarity(aText: string, bText: string): number {
  const tokensA = new Set(tokenizeForSimilarity(aText));
  const tokensB = new Set(tokenizeForSimilarity(bText));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) {
      intersection += 1;
    }
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function findRelatedIdeas(
  targetIdea: IdeaRecord,
  allIdeas: IdeaRecord[],
  limit = 4,
): SemanticMatch[] {
  const targetText = buildIdeaEmbeddingText(targetIdea);
  const hasTargetEmbedding =
    Array.isArray(targetIdea.embedding) && targetIdea.embedding.length > 0;

  const matches: SemanticMatch[] = [];

  for (const candidate of allIdeas) {
    if (candidate.id === targetIdea.id) continue;

    if (
      hasTargetEmbedding &&
      Array.isArray(candidate.embedding) &&
      candidate.embedding.length === targetIdea.embedding!.length
    ) {
      const sim = cosineSimilarity(targetIdea.embedding!, candidate.embedding);
      matches.push({
        ideaId: candidate.id,
        title: candidate.title,
        stage: candidate.stage,
        summary: candidate.summary,
        similarity: Math.max(0, Math.min(1, sim)),
        source: 'embedding',
      });
    } else {
      const sim = lexicalSimilarity(targetText, buildIdeaEmbeddingText(candidate));
      if (sim > 0) {
        matches.push({
          ideaId: candidate.id,
          title: candidate.title,
          stage: candidate.stage,
          summary: candidate.summary,
          similarity: sim,
          source: 'lexical',
        });
      }
    }
  }

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export function isLikelyEmbeddingModelName(name: string, family?: string): boolean {
  const lower = name.toLowerCase();
  const fam = (family ?? '').toLowerCase();
  return (
    lower.includes('embed') ||
    lower.includes('minilm') ||
    lower.includes('bge') ||
    lower.includes('e5-') ||
    fam.includes('bert')
  );
}
