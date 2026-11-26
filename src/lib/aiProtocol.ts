import type { AiQuestion } from '../types/idea';

export const STE_DEFAULT_INSTRUCTION =
  'Use Simplified Technical English (STE): write short, direct sentences in active voice; give one instruction per sentence; use consistent technical words; avoid idioms, filler, and vague phrasing.';

export interface ParsedFileDraft {
  filename: string;
  extension: string;
  content: string;
}

export function normalizeExtension(filename: string, fallbackExt?: string): string {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot > 0 && lastDot < trimmed.length - 1) {
    return trimmed.slice(lastDot).toLowerCase();
  }
  if (fallbackExt) {
    const clean = fallbackExt.trim().toLowerCase();
    return clean.startsWith('.') ? clean : `.${clean}`;
  }
  return '.txt';
}

export function parseAiQuestions(rawText: string): AiQuestion[] {
  const results: AiQuestion[] = [];

  // 1. Check fenced JSON blocks for { "questions": [...] } or array of question objects
  const jsonBlocks = [...rawText.matchAll(/```json\s*([\s\S]*?)```/gi)];
  for (const match of jsonBlocks) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const qText =
          typeof item === 'string'
            ? item
            : typeof item?.question === 'string'
              ? item.question
              : typeof item?.prompt === 'string'
                ? item.prompt
                : '';
        if (!qText.trim()) continue;
        const options = Array.isArray(item?.options)
          ? item.options
              .filter((o: unknown): o is string => typeof o === 'string' && o.trim().length > 0)
              .map((o: string) => o.trim())
              .slice(0, 5)
          : [];
        results.push({
          id: `q-${i + 1}`,
          question: qText.trim(),
          options,
        });
      }
      if (results.length > 0) {
        return results.slice(0, 8);
      }
    } catch {
      // Fall through to line-based parsing
    }
  }

  // 2. Fallback: numbered lines ending with '?'
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(?:\d+[.)]\s*|[-*]\s+)(.+\?)$/);
    if (m && m[1].trim().length > 6) {
      results.push({
        id: `q-${results.length + 1}`,
        question: m[1].replace(/\*\*/g, '').trim(),
        options: [],
      });
    }
  }

  return results.slice(0, 8);
}

export function parseGeneratedFiles(rawText: string): ParsedFileDraft[] {
  const files: ParsedFileDraft[] = [];
  const seenNames = new Set<string>();

  const pushFile = (filename: string, content: string, fallbackExt?: string) => {
    const cleanName = filename.trim().replace(/^['"`]|['"`]$/g, '');
    if (!cleanName || !content.trim()) return;
    const ext = normalizeExtension(cleanName, fallbackExt);
    const finalName = cleanName.includes('.') ? cleanName : `${cleanName}${ext}`;
    if (seenNames.has(finalName)) return;
    seenNames.add(finalName);
    files.push({
      filename: finalName,
      extension: ext,
      content: content.replace(/^\n+|\n+$/g, ''),
    });
  };

  // 1. Structured JSON { "files": [ { "filename": "...", "content": "..." } ] }
  const jsonBlocks = [...rawText.matchAll(/```json\s*([\s\S]*?)```/gi)];
  for (const match of jsonBlocks) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const arr = Array.isArray(parsed?.files)
        ? parsed.files
        : Array.isArray(parsed) && parsed.some((x) => x?.filename && x?.content)
          ? parsed
          : [];
      for (const item of arr) {
        if (
          item &&
          typeof item.filename === 'string' &&
          typeof item.content === 'string'
        ) {
          pushFile(
            item.filename,
            item.content,
            typeof item.extension === 'string' ? item.extension : undefined,
          );
        }
      }
    } catch {
      // Ignore invalid JSON blocks
    }
  }

  // 2. XML-like <file name="app.py">...</file> blocks
  const xmlFiles = [
    ...rawText.matchAll(/<file\s+(?:name|path)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi),
  ];
  for (const match of xmlFiles) {
    pushFile(match[1], match[2]);
  }

  // 3. Named fenced code blocks like ```python:main.py or ```rust main.rs
  const namedFences = [
    ...rawText.matchAll(/```([a-zA-Z0-9_-]+)[:\s]+([^\s`]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g),
  ];
  for (const match of namedFences) {
    pushFile(match[2], match[3], match[1]);
  }

  return files;
}

export function formatQuestionAnswersPrompt(
  qaPairs: Array<{ question: string; answer: string }>,
): string {
  const lines = qaPairs
    .filter((p) => p.answer.trim().length > 0)
    .map((p, idx) => `${idx + 1}. Q: ${p.question}\n   A: ${p.answer.trim()}`);

  return [
    'Here are my answers to your questions:',
    lines.join('\n'),
    '',
    'Now curate the build plan and generate the starter files I need. Return the files inside a fenced ```json block with { "files": [ { "filename": "example.rs", "content": "..." } ] } and any suggested tasks in a "tasks" array.',
  ].join('\n');
}

export function stripStructuredToolBlocks(rawText: string): string {
  const stripped = rawText
    .replace(/```json\s*[\s\S]*?```/gi, (block) => {
      try {
        const inner = block.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(inner);
        if (
          parsed &&
          (Array.isArray(parsed.questions) ||
            Array.isArray(parsed.files) ||
            Array.isArray(parsed.tasks))
        ) {
          return '';
        }
      } catch {
        // Keep non-tool JSON blocks intact
      }
      return block;
    })
    .replace(/<file\s+(?:name|path)=["'][^"']+["'][^>]*>[\s\S]*?<\/file>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return stripped;
}

