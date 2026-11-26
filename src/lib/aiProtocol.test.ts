import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatQuestionAnswersPrompt,
  normalizeExtension,
  parseAiQuestions,
  parseGeneratedFiles,
  stripStructuredToolBlocks,
} from './aiProtocol';

test('normalizeExtension extracts lowercase extensions and handles missing dots', () => {
  assert.equal(normalizeExtension('main.rs'), '.rs');
  assert.equal(normalizeExtension('script.PY'), '.py');
  assert.equal(normalizeExtension('README.md'), '.md');
  assert.equal(normalizeExtension('notes', 'md'), '.md');
});

test('parseAiQuestions extracts structured JSON questions with options', () => {
  const raw = `I need 2 quick answers first:
\`\`\`json
{
  "questions": [
    {
      "question": "Which database engine do you want?",
      "options": ["SQLite", "DuckDB", "JSON files"]
    },
    {
      "question": "Which target OS runs first?",
      "options": ["macOS", "Linux", "Windows"]
    }
  ]
}
\`\`\``;
  const qs = parseAiQuestions(raw);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].question, 'Which database engine do you want?');
  assert.deepEqual(qs[0].options, ['SQLite', 'DuckDB', 'JSON files']);
  assert.equal(qs[1].id, 'q-2');
});

test('parseAiQuestions falls back to numbered question lines', () => {
  const raw = `1. What is the maximum file size?
2. Do you want CLI flags or a GUI form?`;
  const qs = parseAiQuestions(raw);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].question, 'What is the maximum file size?');
});

test('parseGeneratedFiles extracts JSON files, XML file tags, and named fenced blocks', () => {
  const rawJson = `Here are your curated files:
\`\`\`json
{
  "files": [
    {"filename": "main.py", "content": "print('hello')"},
    {"filename": "README.md", "content": "# Local Tool"}
  ]
}
\`\`\``;
  const fromJson = parseGeneratedFiles(rawJson);
  assert.equal(fromJson.length, 2);
  assert.equal(fromJson[0].filename, 'main.py');
  assert.equal(fromJson[0].extension, '.py');

  const rawNamed = `\`\`\`rust src/lib.rs
pub fn ping() -> &'static str { "ok" }
\`\`\``;
  const fromNamed = parseGeneratedFiles(rawNamed);
  assert.equal(fromNamed.length, 1);
  assert.equal(fromNamed[0].filename, 'src/lib.rs');
  assert.equal(fromNamed[0].extension, '.rs');
});

test('formatQuestionAnswersPrompt builds clean follow-up prompt', () => {
  const prompt = formatQuestionAnswersPrompt([
    { question: 'Storage?', answer: 'SQLite' },
    { question: 'Language?', answer: 'Rust' },
  ]);
  assert.match(prompt, /1\. Q: Storage\?/);
  assert.match(prompt, /A: SQLite/);
  assert.match(prompt, /"files"/);
});

test('stripStructuredToolBlocks hides tool JSON payloads while keeping STE prose', () => {
  const raw = `I will ask two short questions.\n\`\`\`json\n{"questions": [{"question": "Target?", "options": ["CLI"]}]}\n\`\`\``;
  assert.equal(stripStructuredToolBlocks(raw), 'I will ask two short questions.');
});
