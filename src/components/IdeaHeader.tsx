import React, { useState } from 'react';
import {
  Bot,
  FileText,
  Kanban,
  Menu,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import type { IdeaRecord, IdeaStage } from '../types/idea';
import { getTaskProgress } from '../lib/taskUtils';

interface IdeaHeaderProps {
  idea: IdeaRecord;
  workspaceTab: 'document' | 'tasks';
  aiPanelOpen: boolean;
  desktopSidebarOpen: boolean;
  onOpenDesktopSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onUpdateStage: (stage: IdeaStage) => void;
  onWorkspaceTabChange: (tab: 'document' | 'tasks') => void;
  onToggleAiPanel: () => void;
  onDeleteIdea: () => void;
}

export const IdeaHeader: React.FC<IdeaHeaderProps> = ({
  idea,
  workspaceTab,
  aiPanelOpen,
  desktopSidebarOpen,
  onOpenDesktopSidebar,
  onOpenMobileSidebar,
  onUpdateStage,
  onWorkspaceTabChange,
  onToggleAiPanel,
  onDeleteIdea,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = getTaskProgress(idea.tasks);

  return (
    <header className="flex flex-col gap-2.5 border-b border-[#1D222D] bg-[#0B0D10] px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 sm:px-6">
      {/* Left: Open Sidebar (when collapsed / mobile) + Breadcrumb + Stage */}
      <div className="flex w-full min-w-0 items-center gap-3 md:w-auto md:flex-1">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open ideas list"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#222834] bg-[#12161E] text-[#B8C0CE] hover:text-[#F3F5F8] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {!desktopSidebarOpen && (
          <button
            type="button"
            onClick={onOpenDesktopSidebar}
            aria-label="Open left panel"
            title="Open ideas panel"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#222834] bg-[#12161E] text-[#B8C0CE] transition-colors hover:border-[#343C4E] hover:text-[#F3F5F8] md:inline-flex"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <span className="min-w-0 truncate text-sm font-medium text-[#9DA6B8]">
          {idea.title || 'Untitled idea'}
        </span>

        <div className="shrink-0">
          <label htmlFor="active-idea-stage" className="sr-only">
            Idea stage
          </label>
          <select
            id="active-idea-stage"
            value={idea.stage}
            onChange={(e) => onUpdateStage(e.target.value as IdeaStage)}
            className="rounded-md border border-[#222834] bg-[#12161E] px-2.5 py-1 text-xs font-medium text-[#D5DCE6] focus:border-[#E5A93C] focus:outline-none"
          >
            <option value="spark">Spark</option>
            <option value="planning">Planning</option>
            <option value="building">Building</option>
            <option value="shipped">Shipped</option>
          </select>
        </div>
      </div>

      {/* Right: Document / Tasks button on top + Ollama AI + Delete */}
      <div className="flex shrink-0 items-center justify-between gap-2 md:justify-end">
        <div className="flex items-center gap-2">
          {workspaceTab === 'tasks' ? (
            <button
              type="button"
              onClick={() => onWorkspaceTabChange('document')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#252B38] bg-[#141821] px-3 py-1.5 text-xs font-medium text-[#E6E9EF] transition-colors hover:border-[#343C4E] whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5 text-[#E5A93C]" aria-hidden="true" />
              <span>Document</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              onWorkspaceTabChange(
                workspaceTab === 'tasks' ? 'document' : 'tasks',
              )
            }
            aria-pressed={workspaceTab === 'tasks'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              workspaceTab === 'tasks'
                ? 'border-[#E5A93C]/60 bg-[#E5A93C]/12 text-[#F5C66D]'
                : 'border-[#252B38] bg-[#141821] text-[#D5DCE6] hover:border-[#343C4E] hover:text-[#F3F5F8]'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tasks</span>
            <span className="font-mono text-[11px] text-[#8E98AB] tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleAiPanel}
            aria-pressed={aiPanelOpen}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              aiPanelOpen
                ? 'border-[#E5A93C]/60 bg-[#E5A93C]/12 text-[#F5C66D]'
                : 'border-[#252B38] bg-[#141821] text-[#C5CDDA] hover:border-[#343C4E] hover:text-[#F3F5F8]'
            }`}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ollama AI</span>
          </button>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                onDeleteIdea();
              }}
              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap shrink-0"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-[#252B38] px-2.5 py-1.5 text-xs text-[#A4AEBF] hover:text-[#F3F5F8] whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete idea ${idea.title}`}
            title="Delete idea"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#6E788C] transition-colors hover:border-rose-500/30 hover:bg-[#141821] hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
