import React, { useState } from 'react';
import { Calendar, Check, Plus, X } from 'lucide-react';
import type { DeadlineItem } from '../types/idea';
import {
  formatShortDate,
  getDeadlineStatus,
  sortDeadlines,
  type DeadlineTone,
} from '../lib/deadlineUtils';

interface DeadlinesStripProps {
  deadlines: DeadlineItem[];
  onDeadlinesChange: (deadlines: DeadlineItem[]) => void;
}

const TONE_CLASS: Record<DeadlineTone, string> = {
  done: 'text-[#636D80]',
  overdue: 'text-rose-400',
  soon: 'text-[#E5A93C]',
  upcoming: 'text-[#8C96AA]',
};

export const DeadlinesStrip: React.FC<DeadlinesStripProps> = ({
  deadlines,
  onDeadlinesChange,
}) => {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState('');

  const sorted = sortDeadlines(deadlines);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Specify what this deadline is for.');
      return;
    }
    if (!dueDate) {
      setError('Select a due date.');
      return;
    }
    const nextItem: DeadlineItem = {
      id: `dl-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
      label: label.trim(),
      dueDate,
      done: false,
    };
    onDeadlinesChange([...deadlines, nextItem]);
    setLabel('');
    setError('');
    setAdding(false);
  };

  const toggleDone = (id: string) => {
    onDeadlinesChange(
      deadlines.map((d) => (d.id === id ? { ...d, done: !d.done } : d)),
    );
  };

  const removeItem = (id: string) => {
    onDeadlinesChange(deadlines.filter((d) => d.id !== id));
  };

  return (
    <section
      aria-label="Specific target deadlines"
      className="border-b border-[#1D222D] bg-[#0C0F14] px-4 py-2.5 sm:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#7D879B] shrink-0">
          <Calendar className="h-3.5 w-3.5 text-[#8E98AB]" aria-hidden="true" />
          <span>Deadlines</span>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
          {sorted.length === 0 && !adding && (
            <span className="text-xs text-[#5E687C]">
              No specific milestones scheduled
            </span>
          )}

          {sorted.map((item) => {
            const status = getDeadlineStatus(item.dueDate, item.done);
            return (
              <div
                key={item.id}
                className="group inline-flex items-center gap-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleDone(item.id)}
                  aria-label={
                    item.done
                      ? `Reopen deadline '${item.label}'`
                      : `Mark deadline '${item.label}' complete`
                  }
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.done
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                      : 'border-[#323A4B] bg-transparent text-transparent hover:border-[#E5A93C]'
                  }`}
                >
                  <Check className="h-2.5 w-2.5" />
                </button>

                <span
                  className={
                    item.done
                      ? 'text-[#636D80] line-through'
                      : 'text-[#DDE3ED]'
                  }
                >
                  {item.label}
                </span>

                <span className="text-[#566074]" aria-hidden="true">
                  ·
                </span>

                <span
                  className={`font-mono text-[11px] tabular-nums ${TONE_CLASS[status.tone]}`}
                >
                  {formatShortDate(item.dueDate)} ({status.label})
                </span>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove deadline '${item.label}'`}
                  className="rounded p-0.5 text-[#5E687C] opacity-70 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#E5A93C] transition-colors hover:bg-[#171B24] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add deadline</span>
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="mx-auto mt-2.5 flex max-w-3xl flex-wrap items-center gap-2 border-t border-[#1A1F29] pt-2.5"
        >
          <label htmlFor="deadline-label-input" className="sr-only">
            Deliverable or milestone
          </label>
          <input
            id="deadline-label-input"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (error) setError('');
            }}
            placeholder="Specific item (e.g. Core prototype)"
            autoFocus
            className="min-w-[180px] flex-1 rounded-md border border-[#252C3A] bg-[#0B0D10] px-2.5 py-1.5 text-xs text-[#E6E9EF] placeholder-[#566074] focus:border-[#E5A93C] focus:outline-none"
          />

          <label htmlFor="deadline-date-input" className="sr-only">
            Due date
          </label>
          <input
            id="deadline-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-[#252C3A] bg-[#0B0D10] px-2.5 py-1.5 font-mono text-xs text-[#D5DCE6] focus:border-[#E5A93C] focus:outline-none"
          />

          <button
            type="submit"
            className="rounded-md bg-[#E5A93C] px-3 py-1.5 text-xs font-semibold text-[#0B0D10] hover:bg-[#EEB955] whitespace-nowrap"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setError('');
            }}
            className="rounded-md px-2.5 py-1.5 text-xs text-[#8E98AB] hover:text-[#E6E9EF] whitespace-nowrap"
          >
            Cancel
          </button>

          {error && (
            <p className="w-full text-xs text-rose-400" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
};
