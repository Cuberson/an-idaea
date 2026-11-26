import type {
  SuggestedTaskDraft,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../types/idea';

export const TASK_STATUS_COLUMNS: Array<{
  id: TaskStatus;
  label: string;
  description: string;
}> = [
  { id: 'backlog', label: 'Backlog', description: 'Captured build steps' },
  { id: 'in_progress', label: 'In Progress', description: 'Active implementation' },
  { id: 'review', label: 'Review', description: 'Verify & refine' },
  { id: 'done', label: 'Done', description: 'Shipped locally' },
];

export function normalizeTaskPositions(tasks: TaskItem[]): TaskItem[] {
  const byStatus = new Map<TaskStatus, TaskItem[]>();
  for (const col of TASK_STATUS_COLUMNS) {
    byStatus.set(col.id, []);
  }
  for (const task of tasks) {
    const list = byStatus.get(task.status) ?? byStatus.get('backlog')!;
    list.push(task);
  }
  const normalized: TaskItem[] = [];
  for (const col of TASK_STATUS_COLUMNS) {
    const list = byStatus.get(col.id)!;
    list.sort((a, b) => a.position - b.position);
    list.forEach((task, idx) => {
      normalized.push({
        ...task,
        position: idx,
      });
    });
  }
  return normalized;
}

export function moveOrReorderTask(
  tasks: TaskItem[],
  taskId: string,
  targetStatus: TaskStatus,
  targetIndex?: number,
): TaskItem[] {
  const sourceTask = tasks.find((t) => t.id === taskId);
  if (!sourceTask) return tasks;

  const remaining = tasks.filter((t) => t.id !== taskId);
  const targetColumnTasks = remaining
    .filter((t) => t.status === targetStatus)
    .sort((a, b) => a.position - b.position);

  const insertAt =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, targetColumnTasks.length))
      : targetColumnTasks.length;

  const updatedTask: TaskItem = {
    ...sourceTask,
    status: targetStatus,
  };

  targetColumnTasks.splice(insertAt, 0, updatedTask);

  const otherTasks = remaining.filter((t) => t.status !== targetStatus);
  const reindexedTarget = targetColumnTasks.map((t, idx) => ({
    ...t,
    position: idx,
  }));

  return normalizeTaskPositions([...otherTasks, ...reindexedTarget]);
}

export function reorderTasksInFlatList(
  tasks: TaskItem[],
  draggedTaskId: string,
  targetTaskId: string,
): TaskItem[] {
  if (draggedTaskId === targetTaskId) return tasks;

  const ordered = [...tasks].sort((a, b) => a.position - b.position);
  const fromIdx = ordered.findIndex((t) => t.id === draggedTaskId);
  const toIdx = ordered.findIndex((t) => t.id === targetTaskId);
  if (fromIdx === -1 || toIdx === -1) return tasks;

  const [moved] = ordered.splice(fromIdx, 1);
  const target = ordered[toIdx] ?? moved;
  const updatedMoved: TaskItem = {
    ...moved,
    status: target.status,
  };
  ordered.splice(toIdx, 0, updatedMoved);

  return ordered.map((t, idx) => ({ ...t, position: idx }));
}

export function getTaskProgress(tasks: TaskItem[]): {
  total: number;
  done: number;
  inProgress: number;
  percent: number;
} {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, inProgress, percent };
}

export function parseSuggestedTasksFromResponse(
  rawText: string,
): SuggestedTaskDraft[] {
  const drafts: SuggestedTaskDraft[] = [];

  // 1. Try extracting a fenced JSON block or raw JSON array
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
  const candidateJson = jsonMatch ? jsonMatch[1].trim() : null;
  if (candidateJson) {
    try {
      const parsed = JSON.parse(candidateJson);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.tasks)
          ? parsed.tasks
          : [];
      for (const item of arr) {
        if (item && typeof item.title === 'string' && item.title.trim()) {
          const priority = normalizePriority(item.priority);
          drafts.push({
            title: item.title.trim().slice(0, 140),
            notes: typeof item.notes === 'string' ? item.notes.trim() : '',
            priority,
            status: 'backlog',
          });
        }
      }
      if (drafts.length > 0) return drafts;
    } catch {
      // Fall through to markdown line parsing
    }
  }

  // 2. Fallback: Parse markdown bullet / numbered / checkbox task lines
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(
      /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)(.+)$/,
    );
    if (!match) continue;

    let body = match[1].trim();
    // Strip markdown bold wrappers
    body = body.replace(/\*\*(.*?)\*\*/g, '$1').trim();
    if (body.length < 4 || body.length > 180) continue;
    // Skip lines that look like section headers ending with ":"
    if (body.endsWith(':')) continue;

    let priority: TaskPriority = 'medium';
    const prioMatch = body.match(/\[(high|medium|low)\]/i);
    if (prioMatch) {
      priority = normalizePriority(prioMatch[1]);
      body = body.replace(/\[(high|medium|low)\]/gi, '').trim();
    }

    const colonIdx = body.indexOf(': ');
    if (colonIdx > 3 && colonIdx < 65) {
      drafts.push({
        title: body.slice(0, colonIdx).trim(),
        notes: body.slice(colonIdx + 2).trim(),
        priority,
        status: 'backlog',
      });
    } else {
      drafts.push({
        title: body,
        notes: '',
        priority,
        status: 'backlog',
      });
    }
  }

  return drafts.slice(0, 12);
}

function normalizePriority(val: unknown): TaskPriority {
  if (typeof val !== 'string') return 'medium';
  const lower = val.toLowerCase();
  if (lower === 'high' || lower === 'low' || lower === 'medium') {
    return lower;
  }
  return 'medium';
}
