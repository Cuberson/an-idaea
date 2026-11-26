import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';
import type {
  ChatMessage,
  GeneratedFile,
  IdeaRecord,
  IdeaStage,
  OllamaConfig,
  OllamaStatusResponse,
  SuggestedTaskDraft,
  TaskItem,
} from './types/idea';
import {
  loadIdeas,
  loadOllamaConfig,
  persistAllIdeas,
  persistIdea,
  removeIdea,
  saveOllamaConfig,
} from './lib/storage';
import { checkOllamaStatus } from './lib/ollamaClient';
import { computeCloudAnchor, type CloudAnchor } from './lib/cloudPosition';
import type { ParsedFileDraft } from './lib/aiProtocol';
import { IdeaSidebar } from './components/IdeaSidebar';
import { IdeaHeader } from './components/IdeaHeader';
import { DeadlinesStrip } from './components/DeadlinesStrip';
import { CuratedFilesStrip } from './components/CuratedFilesStrip';
import { IdeaDocument } from './components/IdeaDocument';
import { TaskBoard } from './components/TaskBoard';
import { OllamaCloud } from './components/OllamaCloud';
import { FilePreviewModal } from './components/FilePreviewModal';
import { NewIdeaModal } from './components/NewIdeaModal';

export default function App() {
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<IdeaStage | 'all'>('all');
  const [workspaceTab, setWorkspaceTab] = useState<'document' | 'tasks'>(
    'document',
  );
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [aiCloudOpen, setAiCloudOpen] = useState(false);
  const [cloudAnchor, setCloudAnchor] = useState<CloudAnchor>(() =>
    computeCloudAnchor({
      viewportW: typeof window !== 'undefined' ? window.innerWidth : 1440,
      viewportH: typeof window !== 'undefined' ? window.innerHeight : 900,
    }),
  );
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>(() =>
    loadOllamaConfig(),
  );
  const [ollamaStatus, setOllamaStatus] =
    useState<OllamaStatusResponse | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadIdeas().then((data) => {
      if (cancelled) return;
      setIdeas(data);
      setActiveIdeaId((prev) => prev ?? data[0]?.id ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshOllama = useCallback(async (endpoint: string) => {
    setCheckingOllama(true);
    const status = await checkOllamaStatus(endpoint);
    setOllamaStatus(status);
    setCheckingOllama(false);

    if (status.connected && status.models.length > 0) {
      setOllamaConfig((prev) => {
        const hasChat = status.models.some(
          (m) => m.name === prev.chatModel && !m.isEmbeddingModel,
        );
        const hasEmbed = status.models.some(
          (m) => m.name === prev.embeddingModel && m.isEmbeddingModel,
        );
        const firstChat = status.models.find((m) => !m.isEmbeddingModel)?.name;
        const firstEmbed = status.models.find((m) => m.isEmbeddingModel)?.name;
        const next: OllamaConfig = {
          ...prev,
          chatModel: hasChat ? prev.chatModel : firstChat || prev.chatModel,
          embeddingModel: hasEmbed
            ? prev.embeddingModel
            : firstEmbed || prev.embeddingModel,
        };
        saveOllamaConfig(next);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    refreshOllama(ollamaConfig.endpoint);
  }, [ollamaConfig.endpoint, refreshOllama]);

  const filteredIdeas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (stageFilter !== 'all' && idea.stage !== stageFilter) {
        return false;
      }
      if (!q) return true;
      return (
        idea.title.toLowerCase().includes(q) ||
        idea.documentContent.toLowerCase().includes(q) ||
        idea.stack.toLowerCase().includes(q)
      );
    });
  }, [ideas, searchQuery, stageFilter]);

  const activeIdea = useMemo(
    () => ideas.find((i) => i.id === activeIdeaId) ?? null,
    [ideas, activeIdeaId],
  );

  const previewFile = useMemo(
    () =>
      activeIdea?.files.find((f) => f.id === previewFileId) ?? null,
    [activeIdea, previewFileId],
  );

  const updateActiveIdea = useCallback(
    (updater: (current: IdeaRecord) => IdeaRecord) => {
      if (!activeIdeaId) return;
      setIdeas((prev) => {
        const next = prev.map((idea) =>
          idea.id === activeIdeaId
            ? {
                ...updater(idea),
                updatedAt: new Date().toISOString(),
              }
            : idea,
        );
        const updated = next.find((i) => i.id === activeIdeaId);
        if (updated) {
          void persistIdea(updated, next);
        }
        return next;
      });
    },
    [activeIdeaId],
  );

  const handleCreateIdea = (draft: {
    title: string;
    summary: string;
    stack: string;
    stage: IdeaStage;
  }) => {
    const now = new Date().toISOString();
    const id = `idea-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const newIdea: IdeaRecord = {
      id,
      title: draft.title,
      summary: draft.summary,
      architectureNotes: '',
      documentContent: draft.summary,
      stack: draft.stack,
      stage: draft.stage,
      position: 0,
      createdAt: now,
      updatedAt: now,
      deadlines: [],
      files: [],
      tasks: [],
      messages: [],
    };

    setIdeas((prev) => {
      const next = [
        newIdea,
        ...prev.map((i, idx) => ({ ...i, position: idx + 1 })),
      ];
      void persistIdea(newIdea, next);
      return next;
    });
    setActiveIdeaId(id);
    setWorkspaceTab('document');
    setSearchQuery('');
    setStageFilter('all');
  };

  const handleDeleteActiveIdea = () => {
    if (!activeIdeaId) return;
    setIdeas((prev) => {
      const remaining = prev.filter((i) => i.id !== activeIdeaId);
      void removeIdea(activeIdeaId, remaining);
      setActiveIdeaId(remaining[0]?.id ?? null);
      return remaining;
    });
  };

  const handleSaveEmbeddings = (
    updates: Array<{ ideaId: string; embedding: number[]; model: string }>,
  ) => {
    const map = new Map(updates.map((u) => [u.ideaId, u]));
    const now = new Date().toISOString();
    setIdeas((prev) => {
      const next = prev.map((idea) => {
        const match = map.get(idea.id);
        if (!match) return idea;
        return {
          ...idea,
          embedding: match.embedding,
          embeddingModel: match.model,
          embeddedAt: now,
        };
      });
      void persistAllIdeas(next);
      return next;
    });
  };

  const handleAppendMessages = (newMessages: ChatMessage[]) => {
    updateActiveIdea((current) => ({
      ...current,
      messages: [...current.messages, ...newMessages],
    }));
  };

  const handleSaveGeneratedFiles = (
    drafts: ParsedFileDraft[],
  ): GeneratedFile[] => {
    const now = new Date().toISOString();
    const created: GeneratedFile[] = drafts.map((d, idx) => ({
      id: `file-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now() + idx}`,
      filename: d.filename,
      extension: d.extension,
      content: d.content,
      updatedAt: now,
    }));

    updateActiveIdea((current) => {
      const existingByName = new Map(
        current.files.map((f) => [f.filename, f]),
      );
      for (const file of created) {
        existingByName.set(file.filename, file);
      }
      return {
        ...current,
        files: Array.from(existingByName.values()),
      };
    });

    return created;
  };

  const handleUpdateFile = (updated: GeneratedFile) => {
    updateActiveIdea((current) => ({
      ...current,
      files: current.files.map((f) => (f.id === updated.id ? updated : f)),
    }));
  };

  const handleDeleteFile = (fileId: string) => {
    updateActiveIdea((current) => ({
      ...current,
      files: current.files.filter((f) => f.id !== fileId),
    }));
  };

  const handleImportTasks = (drafts: SuggestedTaskDraft[]) => {
    updateActiveIdea((current) => {
      const backlogCount = current.tasks.filter(
        (t) => t.status === 'backlog',
      ).length;
      const now = new Date().toISOString();
      const added: TaskItem[] = drafts.map((draft, idx) => ({
        id: `task-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now() + idx}`,
        ideaId: current.id,
        title: draft.title,
        notes: draft.notes,
        status: 'backlog',
        priority: draft.priority,
        position: backlogCount + idx,
        createdAt: now,
      }));
      return {
        ...current,
        tasks: [...current.tasks, ...added],
      };
    });
  };

  const handleAppendToDocument = (snippet: string) => {
    updateActiveIdea((current) => {
      const existing = current.documentContent.trimEnd();
      const separator = existing.length > 0 ? '\n\n---\n\n' : '';
      return {
        ...current,
        documentContent: `${existing}${separator}${snippet.trim()}`,
      };
    });
  };

  const handleConfigChange = (nextConfig: OllamaConfig) => {
    setOllamaConfig(nextConfig);
    saveOllamaConfig(nextConfig);
  };

  const handlePanelContextMenu = (e: React.MouseEvent) => {
    if (!activeIdea) return;
    e.preventDefault();
    setCloudAnchor(
      computeCloudAnchor({
        clickX: e.clientX,
        clickY: e.clientY,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      }),
    );
    setAiCloudOpen(true);
  };

  const handleToggleCloudFromHeader = () => {
    if (aiCloudOpen) {
      setAiCloudOpen(false);
      return;
    }
    setCloudAnchor(
      computeCloudAnchor({
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      }),
    );
    setAiCloudOpen(true);
  };

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0D10] text-sm text-[#8E98AB]">
        Loading local workspace...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0D10] text-[#E6E9EF]">
      {/* 15% Left Ideas Rail (collapsible on desktop) */}
      <IdeaSidebar
        ideas={filteredIdeas}
        activeIdeaId={activeIdeaId}
        searchQuery={searchQuery}
        stageFilter={stageFilter}
        desktopOpen={desktopSidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onCloseDesktop={() => setDesktopSidebarOpen(false)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectIdea={(id) => setActiveIdeaId(id)}
        onSearchChange={setSearchQuery}
        onStageFilterChange={setStageFilter}
        onOpenNewIdea={() => setNewIdeaOpen(true)}
      />

      {/* Right Idea Panel (85% or 100% when left panel is closed) */}
      <main
        className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0B0D10]"
        onContextMenu={handlePanelContextMenu}
      >
        {activeIdea ? (
          <>
            <IdeaHeader
              idea={activeIdea}
              workspaceTab={workspaceTab}
              aiPanelOpen={aiCloudOpen}
              desktopSidebarOpen={desktopSidebarOpen}
              onOpenDesktopSidebar={() => setDesktopSidebarOpen(true)}
              onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              onUpdateStage={(stage) =>
                updateActiveIdea((curr) => ({ ...curr, stage }))
              }
              onWorkspaceTabChange={setWorkspaceTab}
              onToggleAiPanel={handleToggleCloudFromHeader}
              onDeleteIdea={handleDeleteActiveIdea}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DeadlinesStrip
                deadlines={activeIdea.deadlines}
                onDeadlinesChange={(deadlines) =>
                  updateActiveIdea((curr) => ({ ...curr, deadlines }))
                }
              />

              <CuratedFilesStrip
                files={activeIdea.files}
                onSelectFile={(file) => setPreviewFileId(file.id)}
              />

              {workspaceTab === 'document' ? (
                <IdeaDocument
                  idea={activeIdea}
                  onUpdateTitle={(title) =>
                    updateActiveIdea((curr) => ({ ...curr, title }))
                  }
                  onUpdateStack={(stack) =>
                    updateActiveIdea((curr) => ({ ...curr, stack }))
                  }
                  onUpdateDocument={(documentContent) =>
                    updateActiveIdea((curr) => ({
                      ...curr,
                      documentContent,
                    }))
                  }
                />
              ) : (
                <TaskBoard
                  ideaId={activeIdea.id}
                  tasks={activeIdea.tasks}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onTasksChange={(tasks) =>
                    updateActiveIdea((curr) => ({ ...curr, tasks }))
                  }
                />
              )}
            </div>

            {/* Compact Floating AI Cloud activated by right-click or top button */}
            <OllamaCloud
              open={aiCloudOpen}
              anchor={cloudAnchor}
              activeIdea={activeIdea}
              allIdeas={ideas}
              config={ollamaConfig}
              status={ollamaStatus}
              checkingStatus={checkingOllama}
              onClose={() => setAiCloudOpen(false)}
              onConfigChange={handleConfigChange}
              onRefreshStatus={() => refreshOllama(ollamaConfig.endpoint)}
              onSaveEmbeddings={handleSaveEmbeddings}
              onAppendMessages={handleAppendMessages}
              onSaveGeneratedFiles={handleSaveGeneratedFiles}
              onImportTasks={handleImportTasks}
              onAppendToDocument={handleAppendToDocument}
              onOpenFilePreview={(file) => setPreviewFileId(file.id)}
              onJumpToIdea={(id) => setActiveIdeaId(id)}
            />

            <FilePreviewModal
              file={previewFile}
              onClose={() => setPreviewFileId(null)}
              onUpdateFile={handleUpdateFile}
              onDeleteFile={handleDeleteFile}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#232834] bg-[#12161E] text-[#E5A93C]">
              <Lightbulb className="h-6 w-6" />
            </div>
            <h1 className="font-display text-xl font-semibold text-[#F3F5F8]">
              Start your first local idea
            </h1>
            <p className="mt-2 max-w-md text-sm text-[#8993A6]">
              Write out ideas in a clean document workspace, track specific deadlines, organize tasks with drag-and-drop, and right-click anytime for local Ollama AI.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {!desktopSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setDesktopSidebarOpen(true)}
                  className="hidden rounded-lg border border-[#272D3A] px-4 py-2 text-xs font-medium text-[#C4CCD9] hover:text-[#F3F5F8] md:inline-flex"
                >
                  Open Left Panel
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg border border-[#272D3A] px-4 py-2 text-xs font-medium text-[#C4CCD9] hover:text-[#F3F5F8] md:hidden"
              >
                Open Ideas List
              </button>
              <button
                type="button"
                onClick={() => setNewIdeaOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0B0D10] hover:bg-[#EEB955]"
              >
                <Plus className="h-4 w-4" />
                <span>New Idea</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <NewIdeaModal
        open={newIdeaOpen}
        onClose={() => setNewIdeaOpen(false)}
        onCreate={handleCreateIdea}
      />
    </div>
  );
}
