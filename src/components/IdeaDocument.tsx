import React, { useEffect, useRef } from 'react';
import type { IdeaRecord } from '../types/idea';

interface IdeaDocumentProps {
  idea: IdeaRecord;
  onUpdateTitle: (title: string) => void;
  onUpdateStack: (stack: string) => void;
  onUpdateDocument: (content: string) => void;
}

export const IdeaDocument: React.FC<IdeaDocumentProps> = ({
  idea,
  onUpdateTitle,
  onUpdateStack,
  onUpdateDocument,
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(460, el.scrollHeight + 16)}px`;
  }, [idea.id, idea.documentContent]);

  const wordCount = idea.documentContent.trim()
    ? idea.documentContent.trim().split(/\s+/).length
    : 0;

  return (
    <article
      aria-label="Idea document editor"
      className="flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-10"
    >
      <div className="mx-auto w-full max-w-3xl">
        {/* Document Title */}
        <label htmlFor="doc-title-input" className="sr-only">
          Idea document title
        </label>
        <input
          id="doc-title-input"
          type="text"
          value={idea.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Untitled idea"
          className="font-display w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-[#F5F7FA] placeholder-[#4B5568] focus:outline-none sm:text-3xl"
        />

        {/* Quiet inline metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#7D879B]">
          <div className="flex min-w-0 items-center gap-1.5">
            <label htmlFor="doc-stack-input" className="text-[#697387] shrink-0">
              Stack:
            </label>
            <input
              id="doc-stack-input"
              type="text"
              size={Math.max(20, Math.min(54, idea.stack.length + 1))}
              value={idea.stack}
              onChange={(e) => onUpdateStack(e.target.value)}
              placeholder="Rust, Tauri 2, Ollama..."
              className="max-w-full min-w-0 border-none bg-transparent font-mono text-xs text-[#AEB7C7] placeholder-[#4F596B] focus:text-[#E6E9EF] focus:outline-none"
            />
          </div>

          <span aria-hidden="true" className="text-[#3A4252]">
            ·
          </span>

          <span className="font-mono tabular-nums">{wordCount} words</span>

          <span aria-hidden="true" className="text-[#3A4252]">
            ·
          </span>

          <span className="text-[#697387]">Right-click anywhere for AI</span>
        </div>

        <hr className="my-6 border-t border-[#1D222D]" />

        {/* Distraction-free Document Prose Surface */}
        <label htmlFor="doc-body-editor" className="sr-only">
          Idea document notes and plan
        </label>
        <textarea
          ref={editorRef}
          id="doc-body-editor"
          value={idea.documentContent}
          onChange={(e) => onUpdateDocument(e.target.value)}
          placeholder="Start typing your idea, architecture, open questions, and build plan..."
          className="min-h-[460px] w-full resize-none border-none bg-transparent text-[15px] leading-[1.75] text-[#DCE1EB] placeholder-[#4D576A] focus:outline-none sm:text-base"
        />
      </div>
    </article>
  );
};
