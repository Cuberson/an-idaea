import React from 'react';
import { Lightbulb, PanelLeftClose, Plus, Search, X } from 'lucide-react';
import type { IdeaRecord, IdeaStage } from '../types/idea';
import { getTaskProgress } from '../lib/taskUtils';

interface IdeaSidebarProps {
  ideas: IdeaRecord[];
  activeIdeaId: string | null;
  searchQuery: string;
  stageFilter: IdeaStage | 'all';
  desktopOpen: boolean;
  mobileOpen: boolean;
  onCloseDesktop: () => void;
  onCloseMobile: () => void;
  onSelectIdea: (id: string) => void;
  onSearchChange: (q: string) => void;
  onStageFilterChange: (stage: IdeaStage | 'all') => void;
  onOpenNewIdea: () => void;
}

const STAGE_LABEL: Record<IdeaStage, string> = {
  spark: 'Spark',
  planning: 'Planning',
  building: 'Building',
  shipped: 'Shipped',
};

const STAGE_TEXT_COLOR: Record<IdeaStage, string> = {
  spark: 'text-[#A4AEBF]',
  planning: 'text-[#E5A93C]',
  building: 'text-sky-400',
  shipped: 'text-emerald-400',
};

export const IdeaSidebar: React.FC<IdeaSidebarProps> = ({
  ideas,
  activeIdeaId,
  searchQuery,
  stageFilter,
  desktopOpen,
  mobileOpen,
  onCloseDesktop,
  onCloseMobile,
  onSelectIdea,
  onSearchChange,
  onStageFilterChange,
  onOpenNewIdea,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' && index < ideas.length - 1) {
      e.preventDefault();
      onSelectIdea(ideas[index + 1].id);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onSelectIdea(ideas[index - 1].id);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#101319] text-[#E6E9EF]">
      {/* Brand + New Idea + Close Left Panel */}
      <div className="flex items-center justify-between gap-1.5 border-b border-[#212632] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-[#E5A93C]" aria-hidden="true" />
          <span className="font-display truncate text-base font-semibold tracking-tight text-[#F4F6FA]">
            an idea
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenNewIdea}
            aria-label="New Idea"
            title="New Idea"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-[#E5A93C] px-2 text-xs font-semibold text-[#0B0D10] transition-colors hover:bg-[#EEB955] focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={onCloseDesktop}
            aria-label="Close left panel"
            title="Close left panel"
            className="hidden h-7 w-7 items-center justify-center rounded-md text-[#8E98AB] transition-colors hover:bg-[#1B202A] hover:text-[#E6E9EF] md:inline-flex"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close ideas sidebar"
            className="rounded-md p-1.5 text-[#8E98AB] hover:bg-[#1B202A] hover:text-[#E6E9EF] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search & Stage Filter */}
      <div className="space-y-2 border-b border-[#212632] p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#697489]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter ideas..."
            aria-label="Filter ideas"
            className="w-full rounded-md border border-[#232834] bg-[#0B0D10] py-1.5 pr-2.5 pl-8 text-xs text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="sidebar-stage-filter" className="sr-only">
            Filter by stage
          </label>
          <select
            id="sidebar-stage-filter"
            value={stageFilter}
            onChange={(e) =>
              onStageFilterChange(e.target.value as IdeaStage | 'all')
            }
            className="w-full rounded-md border border-[#232834] bg-[#0B0D10] px-2.5 py-1 text-xs text-[#A4AEBF] focus:border-[#E5A93C] focus:outline-none"
          >
            <option value="all">All Stages ({ideas.length})</option>
            <option value="spark">Spark</option>
            <option value="planning">Planning</option>
            <option value="building">Building</option>
            <option value="shipped">Shipped</option>
          </select>
        </div>
      </div>

      {/* Scrollable Idea List */}
      <nav
        aria-label="Stored ideas"
        className="flex-1 space-y-1 overflow-y-auto p-2"
      >
        {ideas.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-xs text-[#7D879B]">No matching ideas.</p>
            <button
              type="button"
              onClick={onOpenNewIdea}
              className="mt-3 rounded-md border border-[#272D3A] px-3 py-1.5 text-xs font-medium text-[#E5A93C] hover:bg-[#191E28]"
            >
              Create First Idea
            </button>
          </div>
        ) : (
          ideas.map((idea, index) => {
            const isActive = idea.id === activeIdeaId;
            const progress = getTaskProgress(idea.tasks);
            return (
              <button
                key={idea.id}
                type="button"
                onClick={() => {
                  onSelectIdea(idea.id);
                  onCloseMobile();
                }}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-current={isActive ? 'page' : undefined}
                className={`group w-full rounded-lg px-2.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#E5A93C] ${
                  isActive
                    ? 'bg-[#1A1F29] text-[#F5F7FA] ring-1 ring-[#E5A93C]/45'
                    : 'text-[#B8C0CE] hover:bg-[#151922] hover:text-[#E6E9EF]'
                }`}
              >
                <div className="truncate text-[13px] font-medium leading-snug">
                  {idea.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#788296] tabular-nums">
                  <span className={STAGE_TEXT_COLOR[idea.stage]}>
                    {STAGE_LABEL[idea.stage]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {progress.done}/{progress.total}
                  </span>
                  {idea.embedding && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#8E98AB]" title="Embedded locally">
                        vec
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })
        )}
      </nav>

      {/* Quiet local storage indicator */}
      <div className="border-t border-[#212632] px-3.5 py-2.5 text-[11px] text-[#6B7487]">
        <span className="font-mono tabular-nums">
          {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'} · local store
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop 15% collapsible left rail */}
      {desktopOpen && (
        <aside
          aria-label="Ideas navigation"
          data-testid="desktop-ideas-sidebar"
          className="hidden h-full shrink-0 border-r border-[#212632] md:block md:w-[22%] lg:w-[15%] lg:min-w-[205px]"
        >
          {sidebarContent}
        </aside>
      )}

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseMobile();
          }}
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
          <aside
            aria-label="Mobile ideas navigation"
            className="relative z-10 h-full w-72 max-w-[82vw] border-r border-[#212632] shadow-2xl"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
