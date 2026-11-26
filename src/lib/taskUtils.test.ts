import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskProgress,
  moveOrReorderTask,
  parseSuggestedTasksFromResponse,
  reorderTasksInFlatList,
} from './taskUtils';
import type { TaskItem } from '../types/idea';

const mkTask = (
  id: string,
  status: TaskItem['status'],
  position: number,
): TaskItem => ({
  id,
  ideaId: 'idea-1',
  title: `Task ${id}`,
  notes: '',
  status,
  priority: 'medium',
  position,
  createdAt: '2026-01-01T00:00:00Z',
});

test('moveOrReorderTask moves a task across Kanban columns and reindexes', () => {
  const tasks = [
    mkTask('t1', 'backlog', 0),
    mkTask('t2', 'backlog', 1),
    mkTask('t3', 'in_progress', 0),
  ];

  const updated = moveOrReorderTask(tasks, 't1', 'in_progress', 0);
  const inProgress = updated
    .filter((t) => t.status === 'in_progress')
    .sort((a, b) => a.position - b.position);

  assert.deepEqual(
    inProgress.map((t) => t.id),
    ['t1', 't3'],
  );
  assert.deepEqual(
    inProgress.map((t) => t.position),
    [0, 1],
  );

  const backlog = updated.filter((t) => t.status === 'backlog');
  assert.equal(backlog.length, 1);
  assert.equal(backlog[0].id, 't2');
  assert.equal(backlog[0].position, 0);
});

test('reorderTasksInFlatList swaps positions accurately', () => {
  const tasks = [
    mkTask('a', 'backlog', 0),
    mkTask('b', 'backlog', 1),
    mkTask('c', 'in_progress', 2),
  ];
  const reordered = reorderTasksInFlatList(tasks, 'c', 'a');
  assert.deepEqual(
    reordered.map((t) => t.id),
    ['c', 'a', 'b'],
  );
  assert.equal(reordered[0].status, 'backlog');
});

test('getTaskProgress computes accurate completion percentage', () => {
  const tasks = [
    mkTask('1', 'done', 0),
    mkTask('2', 'done', 1),
    mkTask('3', 'in_progress', 0),
    mkTask('4', 'backlog', 0),
  ];
  const stats = getTaskProgress(tasks);
  assert.equal(stats.total, 4);
  assert.equal(stats.done, 2);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.percent, 50);
});

test('parseSuggestedTasksFromResponse extracts JSON block tasks and markdown tasks', () => {
  const jsonResponse = `Here is a build plan:
\`\`\`json
[
  {"title": "Initialize Cargo workspace", "notes": "Add rusqlite and reqwest", "priority": "high"},
  {"title": "Wire drag-and-drop columns", "notes": "Persist positions locally", "priority": "medium"}
]
\`\`\``;
  const fromJson = parseSuggestedTasksFromResponse(jsonResponse);
  assert.equal(fromJson.length, 2);
  assert.equal(fromJson[0].title, 'Initialize Cargo workspace');
  assert.equal(fromJson[0].priority, 'high');

  const mdResponse = `
1. **Set up SQLite schema** [high]: Create ideas and tasks tables
2. Add Ollama /api/embed indexing [medium]
- Wire Tauri IPC commands
`;
  const fromMd = parseSuggestedTasksFromResponse(mdResponse);
  assert.equal(fromMd.length, 3);
  assert.equal(fromMd[0].title, 'Set up SQLite schema');
  assert.equal(fromMd[0].priority, 'high');
  assert.equal(fromMd[1].title, 'Add Ollama /api/embed indexing');
});
