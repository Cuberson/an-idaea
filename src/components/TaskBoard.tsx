import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Kanban,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';
import type { TaskItem, TaskPriority, TaskStatus } from '../types/idea';
import {
  TASK_STATUS_COLUMNS,
  getTaskProgress,
  moveOrReorderTask,
  reorderTasksInFlatList,
} from '../lib/taskUtils';

interface TaskBoardProps {
  ideaId: string;
  tasks: TaskItem[];
  viewMode: 'board' | 'list';
  onViewModeChange: (mode: 'board' | 'list') => void;
  onTasksChange: (tasks: TaskItem[]) => void;
}

const PRIORITY_STYLE: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: 'High', color: 'text-rose-400' },
  medium: { label: 'Medium', color: 'text-[#E5A93C]' },
  low: { label: 'Low', color: 'text-[#7F899D]' },
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  backlog: 'in_progress',
  in_progress: 'review',
  review: 'done',
  done: 'backlog',
};

const PREV_STATUS: Record<TaskStatus, TaskStatus> = {
  backlog: 'backlog',
  in_progress: 'backlog',
  review: 'in_progress',
  done: 'review',
};

export const TaskBoard: React.FC<TaskBoardProps> = ({
  ideaId,
  tasks,
  viewMode,
  onViewModeChange,
  onTasksChange,
}) => {
  const progress = getTaskProgress(tasks);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newStatus, setNewStatus] = useState<TaskStatus>('backlog');
  const [titleError, setTitleError] = useState('');

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setTitleError('Enter a task title before adding.');
      return;
    }

    const colTasks = tasks.filter((t) => t.status === newStatus);
    const created: TaskItem = {
      id: `task-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
      ideaId,
      title: newTitle.trim(),
      notes: newNotes.trim(),
      status: newStatus,
      priority: newPriority,
      position: colTasks.length,
      createdAt: new Date().toISOString(),
    };

    onTasksChange([...tasks, created]);
    setNewTitle('');
    setNewNotes('');
    setTitleError('');
  };

  const handleDeleteTask = (taskId: string) => {
    onTasksChange(tasks.filter((t) => t.id !== taskId));
  };

  const handleStartEdit = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes);
  };

  const handleSaveEdit = (taskId: string) => {
    if (!editTitle.trim()) return;
    onTasksChange(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, title: editTitle.trim(), notes: editNotes.trim() }
          : t,
      ),
    );
    setEditingTaskId(null);
  };

  const handleDragStart = (
    e: React.DragEvent,
    taskId: string,
  ) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    setDragOverTaskId(null);
  };

  const handleColumnDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const id = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!id) return;
    onTasksChange(moveOrReorderTask(tasks, id, targetStatus));
    handleDragEnd();
  };

  const handleCardDrop = (
    e: React.DragEvent,
    targetTask: TaskItem,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const id = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!id || id === targetTask.id) {
      handleDragEnd();
      return;
    }

    if (viewMode === 'list') {
      onTasksChange(reorderTasksInFlatList(tasks, id, targetTask.id));
    } else {
      const colTasks = tasks
        .filter((t) => t.status === targetTask.status && t.id !== id)
        .sort((a, b) => a.position - b.position);
      const targetIndex = colTasks.findIndex((t) => t.id === targetTask.id);
      onTasksChange(
        moveOrReorderTask(
          tasks,
          id,
          targetTask.status,
          targetIndex >= 0 ? targetIndex : undefined,
        ),
      );
    }
    handleDragEnd();
  };

  return (
    <section
      aria-label="Build tasks organizer"
      className="flex-1 overflow-y-auto p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-[#F3F5F8]">
            Build Tasks
          </h2>
          <span className="font-mono text-xs text-[#8993A6] tabular-nums">
            {progress.done}/{progress.total} completed · {progress.percent}%
          </span>
        </div>

        <div
          className="inline-flex items-center rounded-lg border border-[#232834] bg-[#12161E] p-0.5"
          role="group"
          aria-label="Task view mode"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('board')}
            aria-pressed={viewMode === 'board'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'board'
                ? 'bg-[#212734] text-[#F3F5F8]'
                : 'text-[#8993A6] hover:text-[#D5DCE6]'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Board</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            aria-pressed={viewMode === 'list'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'list'
                ? 'bg-[#212734] text-[#F3F5F8]'
                : 'text-[#8993A6] hover:text-[#D5DCE6]'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* Inline Add Task Bar */}
      <form
        onSubmit={handleAddTask}
        className="mb-4 rounded-xl border border-[#222734] bg-[#11151C] p-3"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="new-task-title" className="sr-only">
              New task title
            </label>
            <input
              id="new-task-title"
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="Add a concrete build task..."
              className="w-full rounded-lg border border-[#242A37] bg-[#0B0D10] px-3 py-2 text-sm text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label htmlFor="new-task-status" className="sr-only">
              Initial column
            </label>
            <select
              id="new-task-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
              className="rounded-lg border border-[#242A37] bg-[#0B0D10] px-2.5 py-2 text-xs text-[#C4CCD9] focus:border-[#E5A93C] focus:outline-none"
            >
              {TASK_STATUS_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>

            <label htmlFor="new-task-priority" className="sr-only">
              Task priority
            </label>
            <select
              id="new-task-priority"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="rounded-lg border border-[#242A37] bg-[#0B0D10] px-2.5 py-2 text-xs text-[#C4CCD9] focus:border-[#E5A93C] focus:outline-none"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E5A93C] px-3.5 py-2 text-xs font-semibold text-[#0B0D10] transition-colors hover:bg-[#EEB955] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {newTitle.trim().length > 0 && (
          <div className="mt-2">
            <label htmlFor="new-task-notes" className="sr-only">
              Task implementation notes
            </label>
            <input
              id="new-task-notes"
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional implementation notes or acceptance criteria..."
              className="w-full rounded-lg border border-[#212632] bg-[#0B0D10] px-3 py-1.5 text-xs text-[#C4CCD9] placeholder-[#556074] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>
        )}

        {titleError && (
          <p className="mt-2 text-xs text-rose-400" role="alert">
            {titleError}
          </p>
        )}
      </form>

      {/* Drag-and-Drop Board View */}
      {viewMode === 'board' ? (
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
          data-testid="task-kanban-board"
        >
          {TASK_STATUS_COLUMNS.map((col) => {
            const colTasks = tasks
              .filter((t) => t.status === col.id)
              .sort((a, b) => a.position - b.position);
            const isDropTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                data-testid={`column-${col.id}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColumn !== col.id) setDragOverColumn(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColumn(null);
                  }
                }}
                onDrop={(e) => handleColumnDrop(e, col.id)}
                className={`flex min-h-[280px] flex-col rounded-xl border p-3 transition-colors ${
                  isDropTarget
                    ? 'border-[#E5A93C]/70 bg-[#E5A93C]/6'
                    : 'border-[#212632] bg-[#10141B]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between border-b border-[#1E232E] pb-2.5">
                  <div>
                    <h3 className="text-xs font-semibold text-[#E6E9EF]">
                      {col.label}
                    </h3>
                    <p className="text-[11px] text-[#6D778B]">
                      {col.description}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#8E98AB] tabular-nums">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#232834] px-3 py-8 text-center text-xs text-[#5E687C]">
                      Drop tasks here
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isDragging = draggedTaskId === task.id;
                      const isOver = dragOverTaskId === task.id;
                      const prio = PRIORITY_STYLE[task.priority];
                      const isEditing = editingTaskId === task.id;

                      return (
                        <article
                          key={task.id}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverTaskId !== task.id) {
                              setDragOverTaskId(task.id);
                            }
                          }}
                          onDrop={(e) => handleCardDrop(e, task)}
                          className={`group rounded-lg border bg-[#161B24] p-3 transition-all ${
                            isDragging
                              ? 'opacity-45 border-[#E5A93C]'
                              : isOver
                                ? 'border-[#E5A93C] ring-1 ring-[#E5A93C]/40'
                                : 'border-[#252B38] hover:border-[#343C4F]'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                aria-label="Edit task title"
                                className="w-full rounded border border-[#343C4F] bg-[#0B0D10] px-2 py-1 text-xs text-[#F3F5F8] focus:border-[#E5A93C] focus:outline-none"
                              />
                              <textarea
                                rows={2}
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                aria-label="Edit task notes"
                                placeholder="Notes..."
                                className="w-full resize-none rounded border border-[#343C4F] bg-[#0B0D10] px-2 py-1 text-xs text-[#C5CDDA] focus:border-[#E5A93C] focus:outline-none"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskId(null)}
                                  className="rounded px-2 py-1 text-[11px] text-[#8E98AB] hover:text-[#F3F5F8]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(task.id)}
                                  className="rounded bg-[#E5A93C] px-2.5 py-1 text-[11px] font-semibold text-[#0B0D10]"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-2">
                                <span
                                  className="mt-0.5 cursor-grab text-[#5D677A] group-hover:text-[#98A2B5]"
                                  aria-hidden="true"
                                  title="Drag to reorder or move column"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(task)}
                                  className="min-w-0 flex-1 text-left text-[13px] font-medium leading-snug text-[#ECEFF5] hover:text-[#E5A93C]"
                                >
                                  {task.title}
                                </button>
                              </div>

                              {task.notes && (
                                <p className="mt-1.5 pl-5 text-xs leading-relaxed text-[#8D97AA]">
                                  {task.notes}
                                </p>
                              )}

                              <div className="mt-3 flex items-center justify-between border-t border-[#212734] pt-2 pl-5">
                                <span className={`text-[11px] font-medium ${prio.color}`}>
                                  {prio.label}
                                </span>

                                <div className="flex items-center gap-1">
                                  {task.status !== 'backlog' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onTasksChange(
                                          moveOrReorderTask(
                                            tasks,
                                            task.id,
                                            PREV_STATUS[task.status],
                                          ),
                                        )
                                      }
                                      aria-label={`Move '${task.title}' back`}
                                      title="Move left"
                                      className="rounded p-1 text-[#7D879B] hover:bg-[#222836] hover:text-[#E6E9EF]"
                                    >
                                      <ArrowLeft className="h-3 w-3" />
                                    </button>
                                  )}
                                  {task.status !== 'done' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onTasksChange(
                                          moveOrReorderTask(
                                            tasks,
                                            task.id,
                                            NEXT_STATUS[task.status],
                                          ),
                                        )
                                      }
                                      aria-label={`Advance '${task.title}'`}
                                      title="Move right"
                                      className="rounded p-1 text-[#7D879B] hover:bg-[#222836] hover:text-[#E5A93C]"
                                    >
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTask(task.id)}
                                    aria-label={`Delete '${task.title}'`}
                                    title="Delete task"
                                    className="rounded p-1 text-[#7D879B] hover:bg-rose-500/10 hover:text-rose-400"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Drag-and-Drop Priority List View */
        <div
          className="rounded-xl border border-[#212632] bg-[#10141B]"
          data-testid="task-priority-list"
        >
          {tasks.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#7D879B]">
              No tasks yet. Add your first build task above or generate a breakdown with Ollama.
            </div>
          ) : (
            <ul className="divide-y divide-[#1E232E]">
              {[...tasks]
                .sort((a, b) => a.position - b.position)
                .map((task) => {
                  const prio = PRIORITY_STYLE[task.priority];
                  const colLabel =
                    TASK_STATUS_COLUMNS.find((c) => c.id === task.status)
                      ?.label ?? 'Backlog';

                  return (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverTaskId !== task.id) {
                          setDragOverTaskId(task.id);
                        }
                      }}
                      onDrop={(e) => handleCardDrop(e, task)}
                      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors ${
                        dragOverTaskId === task.id
                          ? 'bg-[#E5A93C]/8'
                          : 'hover:bg-[#151A23]'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className="cursor-grab text-[#5D677A]"
                          aria-hidden="true"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            onTasksChange(
                              moveOrReorderTask(
                                tasks,
                                task.id,
                                task.status === 'done' ? 'backlog' : 'done',
                              ),
                            )
                          }
                          aria-label={
                            task.status === 'done'
                              ? `Reopen '${task.title}'`
                              : `Mark '${task.title}' done`
                          }
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            task.status === 'done'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                              : 'border-[#333B4D] bg-[#0B0D10] text-transparent hover:border-[#E5A93C]'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-sm font-medium ${
                              task.status === 'done'
                                ? 'text-[#6D778B] line-through'
                                : 'text-[#ECEFF5]'
                            }`}
                          >
                            {task.title}
                          </div>
                          {task.notes && (
                            <p className="truncate text-xs text-[#808A9E]">
                              {task.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-4 text-xs">
                        <span className={prio.color}>{prio.label}</span>
                        <select
                          aria-label={`Change status for '${task.title}'`}
                          value={task.status}
                          onChange={(e) =>
                            onTasksChange(
                              moveOrReorderTask(
                                tasks,
                                task.id,
                                e.target.value as TaskStatus,
                              ),
                            )
                          }
                          className="rounded-md border border-[#252B38] bg-[#0B0D10] px-2 py-1 text-xs text-[#C5CDDA] focus:border-[#E5A93C] focus:outline-none"
                        >
                          {TASK_STATUS_COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <span className="hidden font-mono text-[11px] text-[#6D778B] sm:inline">
                          {colLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          aria-label={`Delete '${task.title}'`}
                          className="rounded p-1.5 text-[#7D879B] hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
