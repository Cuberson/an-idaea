import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { IdeaStage } from '../types/idea';

interface NewIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: {
    title: string;
    summary: string;
    stack: string;
    stage: IdeaStage;
  }) => void;
}

export const NewIdeaModal: React.FC<NewIdeaModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [stack, setStack] = useState('Rust, Tauri 2, Ollama');
  const [stage, setStage] = useState<IdeaStage>('spark');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setSummary('');
      setStack('Rust, Tauri 2, Ollama');
      setStage('spark');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give your idea a clear working title.');
      return;
    }
    onCreate({
      title: title.trim(),
      summary: summary.trim(),
      stack: stack.trim(),
      stage,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-labelledby="new-idea-heading"
        className="relative w-full max-w-lg rounded-xl border border-[#2A303E] bg-[#12151B] p-6 text-[#E6E9EF] shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#232834] pb-4">
          <h2
            id="new-idea-heading"
            className="font-display text-lg font-semibold tracking-tight text-[#F3F5F8]"
          >
            Capture New Idea
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new idea dialog"
            className="rounded-lg p-1.5 text-[#8E98AB] transition-colors hover:bg-[#1C212B] hover:text-[#E6E9EF] focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="idea-title-input"
              className="mb-1.5 block text-xs font-medium text-[#A4AEBF]"
            >
              Idea Title
            </label>
            <input
              ref={inputRef}
              id="idea-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Local SQLite Log Analyzer"
              className="w-full rounded-lg border border-[#272D3A] bg-[#0B0D10] px-3.5 py-2.5 text-sm text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
            />
            {error && (
              <p className="mt-1.5 text-xs text-rose-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="idea-summary-input"
              className="mb-1.5 block text-xs font-medium text-[#A4AEBF]"
            >
              Problem &amp; Core Concept
            </label>
            <textarea
              id="idea-summary-input"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What does this build solve and why does it matter?"
              className="w-full resize-none rounded-lg border border-[#272D3A] bg-[#0B0D10] px-3.5 py-2.5 text-sm text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="idea-stack-input"
                className="mb-1.5 block text-xs font-medium text-[#A4AEBF]"
              >
                Target Stack
              </label>
              <input
                id="idea-stack-input"
                type="text"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="Rust, Tauri 2, SQLite"
                className="w-full rounded-lg border border-[#272D3A] bg-[#0B0D10] px-3.5 py-2 text-sm text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="idea-stage-select"
                className="mb-1.5 block text-xs font-medium text-[#A4AEBF]"
              >
                Starting Stage
              </label>
              <select
                id="idea-stage-select"
                value={stage}
                onChange={(e) => setStage(e.target.value as IdeaStage)}
                className="w-full rounded-lg border border-[#272D3A] bg-[#0B0D10] px-3.5 py-2 text-sm text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
              >
                <option value="spark">Spark</option>
                <option value="planning">Planning</option>
                <option value="building">Building</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#232834] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#272D3A] px-4 py-2 text-xs font-medium text-[#A4AEBF] transition-colors hover:bg-[#1C212B] hover:text-[#E6E9EF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0B0D10] transition-colors hover:bg-[#EEB955]"
            >
              Create Idea
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
