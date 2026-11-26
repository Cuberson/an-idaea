import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  FileCode2,
  FilePlus2,
  GripHorizontal,
  HelpCircle,
  Layers,
  ListPlus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  GeneratedFile,
  IdeaRecord,
  OllamaConfig,
  OllamaStatusResponse,
  SemanticMatch,
  SuggestedTaskDraft,
} from '../types/idea';
import type { CloudAnchor } from '../lib/cloudPosition';
import {
  buildIdeaEmbeddingText,
  cosineSimilarity,
  findRelatedIdeas,
} from '../lib/vectors';
import { parseSuggestedTasksFromResponse } from '../lib/taskUtils';
import {
  STE_DEFAULT_INSTRUCTION,
  formatQuestionAnswersPrompt,
  parseAiQuestions,
  parseGeneratedFiles,
  stripStructuredToolBlocks,
  type ParsedFileDraft,
} from '../lib/aiProtocol';
import {
  generateEmbedding,
  runOllamaPlanningChat,
} from '../lib/ollamaClient';
import { QuestionWizardCard } from './QuestionWizardCard';
import { splitFileBaseAndExt } from './CuratedFilesStrip';

interface OllamaCloudProps {
  open: boolean;
  anchor: CloudAnchor;
  activeIdea: IdeaRecord;
  allIdeas: IdeaRecord[];
  config: OllamaConfig;
  status: OllamaStatusResponse | null;
  checkingStatus: boolean;
  onClose: () => void;
  onConfigChange: (config: OllamaConfig) => void;
  onRefreshStatus: () => void;
  onSaveEmbeddings: (
    updates: Array<{
      ideaId: string;
      embedding: number[];
      model: string;
    }>,
  ) => void;
  onAppendMessages: (messages: ChatMessage[]) => void;
  onSaveGeneratedFiles: (drafts: ParsedFileDraft[]) => GeneratedFile[];
  onImportTasks: (drafts: SuggestedTaskDraft[]) => void;
  onAppendToDocument: (snippet: string) => void;
  onOpenFilePreview: (file: GeneratedFile) => void;
  onJumpToIdea: (ideaId: string) => void;
}

export const OllamaCloud: React.FC<OllamaCloudProps> = ({
  open,
  anchor,
  activeIdea,
  allIdeas,
  config,
  status,
  checkingStatus,
  onClose,
  onConfigChange,
  onRefreshStatus,
  onSaveEmbeddings,
  onAppendMessages,
  onSaveGeneratedFiles,
  onImportTasks,
  onAppendToDocument,
  onOpenFilePreview,
  onJumpToIdea,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [importedMsgIds, setImportedMsgIds] = useState<Record<string, boolean>>(
    {},
  );
  const [appendedMsgIds, setAppendedMsgIds] = useState<Record<string, boolean>>(
    {},
  );

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [anchor.left, anchor.top, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [open, activeIdea.messages.length, isGenerating]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      setDragOffset({
        x: dragStartRef.current.origX + (e.clientX - dragStartRef.current.startX),
        y: dragStartRef.current.origY + (e.clientY - dragStartRef.current.startY),
      });
    };
    const onMouseUp = () => {
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const connected = status?.connected ?? false;
  const models = status?.models ?? [];
  const embeddingModels = models.filter((m) => m.isEmbeddingModel);
  const chatModels = models.filter((m) => !m.isEmbeddingModel);

  const relatedIdeas: SemanticMatch[] = useMemo(
    () => findRelatedIdeas(activeIdea, allIdeas, 3),
    [activeIdea, allIdeas],
  );

  const indexedCount = allIdeas.filter(
    (i) => Array.isArray(i.embedding) && i.embedding.length > 0,
  ).length;

  if (!open) return null;

  const handleIndexAllIdeas = async () => {
    setAiError(null);
    setIsIndexing(true);
    try {
      const updates: Array<{
        ideaId: string;
        embedding: number[];
        model: string;
      }> = [];
      for (const idea of allIdeas) {
        const vector = await generateEmbedding(
          config.endpoint,
          config.embeddingModel,
          buildIdeaEmbeddingText(idea),
        );
        updates.push({
          ideaId: idea.id,
          embedding: vector,
          model: config.embeddingModel,
        });
      }
      onSaveEmbeddings(updates);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Failed to generate embeddings from local Ollama.',
      );
    } finally {
      setIsIndexing(false);
    }
  };

  const submitPrompt = async (text: string, displayLabel?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;

    setAiError(null);
    setIsGenerating(true);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: (displayLabel ?? trimmed).trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      let currentIdea = activeIdea;
      let queryMatches = relatedIdeas;

      if (connected && config.embeddingModel.trim()) {
        try {
          const [ideaVec, queryVec] = await Promise.all([
            generateEmbedding(
              config.endpoint,
              config.embeddingModel,
              buildIdeaEmbeddingText(activeIdea),
            ),
            generateEmbedding(
              config.endpoint,
              config.embeddingModel,
              `${activeIdea.title}\n${trimmed}`,
            ),
          ]);

          onSaveEmbeddings([
            {
              ideaId: activeIdea.id,
              embedding: ideaVec,
              model: config.embeddingModel,
            },
          ]);

          currentIdea = {
            ...activeIdea,
            embedding: ideaVec,
            embeddingModel: config.embeddingModel,
          };

          const embeddedCandidates = allIdeas
            .filter(
              (item) =>
                item.id !== activeIdea.id &&
                Array.isArray(item.embedding) &&
                item.embedding.length === queryVec.length,
            )
            .map((item) => ({
              ideaId: item.id,
              title: item.title,
              stage: item.stage,
              summary: item.summary || item.documentContent.slice(0, 140),
              similarity: Math.max(0, cosineSimilarity(queryVec, item.embedding!)),
              source: 'embedding' as const,
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3);

          queryMatches =
            embeddedCandidates.length > 0
              ? embeddedCandidates
              : findRelatedIdeas(currentIdea, allIdeas, 3);
        } catch {
          // Proceed with reasoning model even if embedding model is unavailable
        }
      }

      const result = await runOllamaPlanningChat({
        config,
        activeIdea: currentIdea,
        relatedIdeas: queryMatches,
        allIdeas,
        userPrompt: trimmed,
      });

      const parsedQuestions = parseAiQuestions(result.content);
      const parsedFiles = parseGeneratedFiles(result.content);
      const savedFiles =
        parsedFiles.length > 0 ? onSaveGeneratedFiles(parsedFiles) : [];

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: result.content,
        createdAt: new Date().toISOString(),
        model: result.model,
        contextIds: config.useRagContext
          ? queryMatches.map((r) => r.ideaId)
          : undefined,
        questions: parsedQuestions.length > 0 ? parsedQuestions : undefined,
        generatedFileIds:
          savedFiles.length > 0 ? savedFiles.map((f) => f.id) : undefined,
      };

      onAppendMessages([userMessage, assistantMessage]);
      setPromptInput('');
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Ollama request failed. Verify your local Ollama server is running.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Local AI Cloud using Ollama"
      data-testid="ollama-ai-cloud"
      style={{
        left: `${anchor.left + dragOffset.x}px`,
        top: `${anchor.top + dragOffset.y}px`,
        width: `${anchor.width}px`,
        maxHeight: `${anchor.maxHeight}px`,
      }}
      className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-[#2B3344] bg-[#12161F]/96 text-[#E6E9EF] shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-md"
    >
      {/* Compact Draggable Cloud Header */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: dragOffset.x,
            origY: dragOffset.y,
          };
        }}
        className="flex cursor-grab items-center justify-between border-b border-[#222836] bg-[#151A24] px-3.5 py-2.5 active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Cloud className="h-4 w-4 shrink-0 text-[#E5A93C]" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-display text-xs font-semibold text-[#F4F6FA]">
                AI Assistant
              </span>
              <span
                className={`font-mono text-[10px] ${
                  connected ? 'text-emerald-400' : 'text-[#8993A6]'
                }`}
              >
                · {connected ? `${models.length} models` : 'offline'}
              </span>
              {config.useSteInstruction && (
                <span className="font-mono text-[10px] text-[#E5A93C]">
                  · STE
                </span>
              )}
            </div>
            <div className="truncate font-mono text-[10px] text-[#7D879B]">
              {config.chatModel} + {config.embeddingModel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <GripHorizontal
            className="mr-0.5 hidden h-3.5 w-3.5 text-[#545E73] sm:block"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onRefreshStatus}
            disabled={checkingStatus}
            aria-label="Refresh Ollama models"
            title="Detect installed Ollama models"
            className="rounded-md p-1 text-[#8E98AB] hover:bg-[#1E2432] hover:text-[#F3F5F8] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${checkingStatus ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-expanded={showSettings}
            aria-label="Configure Ollama models and STE instructions"
            title="Models & STE instructions"
            className={`rounded-md p-1 transition-colors ${
              showSettings
                ? 'bg-[#E5A93C]/15 text-[#E5A93C]'
                : 'text-[#8E98AB] hover:bg-[#1E2432] hover:text-[#F3F5F8]'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI cloud"
            title="Close (Esc)"
            className="rounded-md p-1 text-[#8E98AB] hover:bg-[#1E2432] hover:text-[#F3F5F8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible Dual-Model Detection, Embeddings & STE Custom Instructions */}
      {showSettings && (
        <div className="max-h-[250px] space-y-2.5 overflow-y-auto border-b border-[#222836] bg-[#10141C] p-3 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="cloud-ollama-endpoint" className="text-[#8E98AB] shrink-0">
              Endpoint
            </label>
            <input
              id="cloud-ollama-endpoint"
              type="url"
              value={config.endpoint}
              onChange={(e) =>
                onConfigChange({ ...config, endpoint: e.target.value })
              }
              className="flex-1 rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1 font-mono text-[11px] text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="cloud-chat-model"
                className="mb-1 block text-[#8E98AB]"
              >
                Reasoning Model ({chatModels.length})
              </label>
              {models.length > 0 ? (
                <select
                  id="cloud-chat-model"
                  value={config.chatModel}
                  onChange={(e) =>
                    onConfigChange({ ...config, chatModel: e.target.value })
                  }
                  className="w-full rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1 font-mono text-[11px] text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
                >
                  {(chatModels.length > 0 ? chatModels : models).map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                      {m.parameterSize ? ` (${m.parameterSize})` : ''}
                    </option>
                  ))}
                  {!models.some((m) => m.name === config.chatModel) && (
                    <option value={config.chatModel}>{config.chatModel}</option>
                  )}
                </select>
              ) : (
                <input
                  id="cloud-chat-model"
                  type="text"
                  value={config.chatModel}
                  onChange={(e) =>
                    onConfigChange({ ...config, chatModel: e.target.value })
                  }
                  className="w-full rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1 font-mono text-[11px] text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="cloud-embed-model"
                className="mb-1 block text-[#8E98AB]"
              >
                Embedding Model ({embeddingModels.length})
              </label>
              {models.length > 0 ? (
                <select
                  id="cloud-embed-model"
                  value={config.embeddingModel}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      embeddingModel: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1 font-mono text-[11px] text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
                >
                  {(embeddingModels.length > 0 ? embeddingModels : models).map(
                    (m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ),
                  )}
                  {!models.some((m) => m.name === config.embeddingModel) && (
                    <option value={config.embeddingModel}>
                      {config.embeddingModel}
                    </option>
                  )}
                </select>
              ) : (
                <input
                  id="cloud-embed-model"
                  type="text"
                  value={config.embeddingModel}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      embeddingModel: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1 font-mono text-[11px] text-[#E6E9EF] focus:border-[#E5A93C] focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* STE Custom Instruction */}
          <div className="space-y-1.5 border-t border-[#1D222E] pt-2">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-1.5 text-[#D5DCE6]">
                <input
                  type="checkbox"
                  checked={config.useSteInstruction}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      useSteInstruction: e.target.checked,
                    })
                  }
                  className="rounded border-[#343C4F] bg-[#0B0D10] accent-[#E5A93C]"
                />
                <span>STE (Simplified Technical English)</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    useSteInstruction: true,
                    customInstruction: STE_DEFAULT_INSTRUCTION,
                  })
                }
                className="text-[10px] text-[#8E98AB] hover:text-[#E5A93C]"
              >
                Reset STE
              </button>
            </div>

            <label htmlFor="cloud-custom-instruction" className="sr-only">
              Custom AI instruction
            </label>
            <textarea
              id="cloud-custom-instruction"
              rows={2}
              value={config.customInstruction}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  customInstruction: e.target.value,
                })
              }
              className="w-full resize-none rounded-md border border-[#262C3A] bg-[#0B0D10] px-2 py-1.5 text-[11px] leading-snug text-[#C8D0DE] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex cursor-pointer items-center gap-1.5 text-[#C4CCD9]">
              <input
                type="checkbox"
                checked={config.useRagContext}
                onChange={(e) =>
                  onConfigChange({ ...config, useRagContext: e.target.checked })
                }
                className="rounded border-[#343C4F] bg-[#0B0D10] accent-[#E5A93C]"
              />
              <span>Embedding RAG ({indexedCount}/{allIdeas.length})</span>
            </label>

            <button
              type="button"
              onClick={handleIndexAllIdeas}
              disabled={isIndexing || !connected}
              className="inline-flex items-center gap-1 rounded border border-[#2A3140] bg-[#161B25] px-2 py-1 text-[10px] font-medium text-[#E5A93C] hover:border-[#E5A93C]/60 disabled:opacity-45"
            >
              <Layers className="h-3 w-3" />
              <span>{isIndexing ? 'Indexing...' : 'Index Ideas'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Embedding Research Strip */}
      {relatedIdeas.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#1E2330] bg-[#0F131B] px-3 py-1.5 text-[11px]">
          <span className="shrink-0 text-[#6D778B]">Research:</span>
          {relatedIdeas.map((match) => (
            <button
              key={match.ideaId}
              type="button"
              onClick={() => onJumpToIdea(match.ideaId)}
              title={`Open related idea (${Math.round(match.similarity * 100)}% ${match.source} match)`}
              className="inline-flex max-w-[136px] shrink-0 items-center gap-1 truncate rounded-md bg-[#181D27] px-2 py-0.5 text-[#B8C1D1] hover:bg-[#202634] hover:text-[#F3F5F8]"
            >
              <span className="truncate">{match.title}</span>
              <span className="font-mono text-[10px] text-[#E5A93C] tabular-nums">
                {Math.round(match.similarity * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation, Questions Callout & File Generation */}
      <div className="min-h-[180px] flex-1 space-y-2.5 overflow-y-auto p-3">
        {!connected && activeIdea.messages.length === 0 && (
          <div className="rounded-xl border border-[#222836] bg-[#0D1017] p-2.5 text-[11px] text-[#98A2B5]">
            <p className="font-medium text-[#DCE2EC]">
              Start local Ollama to detect models
            </p>
            <pre className="mt-1.5 overflow-x-auto rounded bg-[#080A0D] p-1.5 font-mono text-[10px] text-[#C8D0DE]">
              {`ollama pull ${config.chatModel}\nollama pull ${config.embeddingModel}\nollama serve`}
            </pre>
          </div>
        )}

        {activeIdea.messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-[#8892A6]">
              Talk in STE, answer clarifying questions, research indexed ideas, or generate editable starter files for{' '}
              <span className="text-[#E6E9EF]">{activeIdea.title}</span>.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!connected || isGenerating}
                onClick={() =>
                  submitPrompt(
                    'Ask me 3 clarifying questions about this idea so you can curate the right architecture and files. Return them inside a fenced ```json {"questions": [{"question": "...", "options": ["...", "..."]}]} block.',
                    'Ask clarifying questions for this idea.',
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5A93C]/40 bg-[#E5A93C]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#F5C66D] hover:bg-[#E5A93C]/18 disabled:opacity-45"
              >
                <HelpCircle className="h-3 w-3" />
                <span>Ask Questions</span>
              </button>
              <button
                type="button"
                disabled={!connected || isGenerating}
                onClick={() =>
                  submitPrompt(
                    'Generate the starter code and markdown files needed for this idea. Return them inside a fenced ```json {"files": [{"filename": "example.rs", "content": "..."}]} block.',
                    'Generate starter files for this idea.',
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#262C3B] bg-[#161B24] px-2.5 py-1.5 text-[11px] text-[#D5DCE6] hover:border-[#E5A93C]/50 hover:text-[#F5C66D] disabled:opacity-45"
              >
                <FileCode2 className="h-3 w-3 text-[#E5A93C]" />
                <span>Generate Files</span>
              </button>
              <button
                type="button"
                disabled={!connected || isGenerating}
                onClick={() =>
                  submitPrompt(
                    'Research how this idea relates to my stored ideas and outline the clearest architecture.',
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#262C3B] bg-[#161B24] px-2.5 py-1.5 text-[11px] text-[#D5DCE6] hover:border-[#E5A93C]/50 hover:text-[#F5C66D] disabled:opacity-45"
              >
                <Sparkles className="h-3 w-3 text-[#E5A93C]" />
                <span>Research</span>
              </button>
            </div>
          </div>
        ) : (
          activeIdea.messages.map((msg) => {
            const suggestedTasks =
              msg.role === 'assistant'
                ? parseSuggestedTasksFromResponse(msg.content)
                : [];
            const msgFiles = (msg.generatedFileIds ?? [])
              .map((fid) => activeIdea.files.find((f) => f.id === fid))
              .filter((f): f is GeneratedFile => Boolean(f));
            const tasksImported = importedMsgIds[msg.id];
            const docAppended = appendedMsgIds[msg.id];

            return (
              <div key={msg.id} className="space-y-2">
                <div
                  className={`rounded-xl border p-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-5 border-[#2B3345] bg-[#181E29] text-[#F1F4F8]'
                      : 'mr-2 border-[#212634] bg-[#0D1118] text-[#D3DAE6]'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-[10px] text-[#788296]">
                    <span>
                      {msg.role === 'user' ? 'You' : msg.model || 'Ollama'}
                    </span>
                    {msg.contextIds && msg.contextIds.length > 0 && (
                      <span className="font-mono">
                        +{msg.contextIds.length} embedded refs
                      </span>
                    )}
                  </div>

                  <div className="whitespace-pre-wrap break-words">
                    {msg.role === 'assistant' &&
                    ((msg.questions && msg.questions.length > 0) ||
                      msgFiles.length > 0)
                      ? stripStructuredToolBlocks(msg.content) ||
                        (msgFiles.length > 0
                          ? `Created ${msgFiles.length} editable file${msgFiles.length > 1 ? 's' : ''}.`
                          : 'Answer the questions below.')
                      : msg.content}
                  </div>

                  {/* Tiny generated file boxes inside message */}
                  {msgFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#1D222E] pt-2">
                      {msgFiles.map((file) => {
                        const { base, ext } = splitFileBaseAndExt(file);
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => onOpenFilePreview(file)}
                            title={`View & edit ${file.filename}`}
                            className="inline-flex items-center gap-1 rounded-md border border-[#2A3242] bg-[#141923] px-2 py-1 text-[11px] text-[#E6E9EF] hover:border-[#E5A93C]"
                          >
                            <span className="max-w-[95px] truncate font-mono">
                              {base}
                            </span>
                            <span className="rounded bg-[#E5A93C]/15 px-1 font-mono text-[10px] font-semibold text-[#F5C66D]">
                              {ext}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#1D222E] pt-2">
                      <button
                        type="button"
                        disabled={docAppended}
                        onClick={() => {
                          onAppendToDocument(msg.content);
                          setAppendedMsgIds((prev) => ({
                            ...prev,
                            [msg.id]: true,
                          }));
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#293040] bg-[#151A24] px-2 py-1 text-[10px] font-medium text-[#D5DCE6] hover:border-[#E5A93C]/50 hover:text-[#F5C66D] disabled:text-emerald-400"
                      >
                        <FilePlus2 className="h-3 w-3" />
                        <span>
                          {docAppended ? 'Added to Doc' : 'Append to Doc'}
                        </span>
                      </button>

                      {suggestedTasks.length > 0 && (
                        <button
                          type="button"
                          disabled={tasksImported}
                          onClick={() => {
                            onImportTasks(suggestedTasks);
                            setImportedMsgIds((prev) => ({
                              ...prev,
                              [msg.id]: true,
                            }));
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[#E5A93C] px-2 py-1 text-[10px] font-semibold text-[#0B0D10] hover:bg-[#EEB955] disabled:bg-emerald-500/20 disabled:text-emerald-300"
                        >
                          <ListPlus className="h-3 w-3" />
                          <span>
                            {tasksImported
                              ? `Added ${suggestedTasks.length}`
                              : `Add ${suggestedTasks.length} Tasks`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Question Callout Wizard */}
                {msg.questions && msg.questions.length > 0 && (
                  <QuestionWizardCard
                    questions={msg.questions}
                    disabled={!connected || isGenerating}
                    onSubmitAll={(qaPairs) =>
                      submitPrompt(
                        formatQuestionAnswersPrompt(qaPairs),
                        qaPairs
                          .map((p, idx) => `${idx + 1}. ${p.answer}`)
                          .join('\n'),
                      )
                    }
                  />
                )}
              </div>
            );
          })
        )}

        {isGenerating && (
          <div className="rounded-lg border border-[#222836] bg-[#0D1118] p-2.5 text-[11px] text-[#9BA4B5]">
            Thinking in STE with{' '}
            <span className="font-mono">{config.chatModel}</span> +{' '}
            <span className="font-mono">{config.embeddingModel}</span>...
          </div>
        )}

        {aiError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300"
          >
            {aiError}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact Prompt Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitPrompt(promptInput);
        }}
        className="border-t border-[#222836] bg-[#0F131B] p-2.5"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!connected || isGenerating}
            onClick={() =>
              submitPrompt(
                'Ask me 3 clarifying questions about this idea so you can curate the right architecture and files. Return them inside a fenced ```json {"questions": [{"question": "...", "options": ["...", "..."]}]} block.',
                'Ask clarifying questions for this idea.',
              )
            }
            className="rounded px-1.5 py-0.5 text-[10px] text-[#9BA4B5] hover:bg-[#191F2B] hover:text-[#E5A93C] disabled:opacity-40"
          >
            + Ask Questions
          </button>
          <button
            type="button"
            disabled={!connected || isGenerating}
            onClick={() =>
              submitPrompt(
                'Generate the starter code and markdown files needed for this idea. Return them inside a fenced ```json {"files": [{"filename": "example.rs", "content": "..."}]} block.',
                'Generate starter files for this idea.',
              )
            }
            className="rounded px-1.5 py-0.5 text-[10px] text-[#9BA4B5] hover:bg-[#191F2B] hover:text-[#E5A93C] disabled:opacity-40"
          >
            + Generate Files
          </button>
        </div>

        <div className="flex items-end gap-1.5">
          <label htmlFor="cloud-prompt-input" className="sr-only">
            Ask AI assistant
          </label>
          <textarea
            ref={inputRef}
            id="cloud-prompt-input"
            rows={2}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitPrompt(promptInput);
              }
            }}
            placeholder={
              connected
                ? 'Ask, answer, or request files...'
                : 'Start Ollama to talk to local AI...'
            }
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#252C3A] bg-[#0A0C10] px-2.5 py-2 text-xs text-[#E6E9EF] placeholder-[#5A6478] focus:border-[#E5A93C] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!connected || isGenerating || !promptInput.trim()}
            aria-label="Send prompt to Ollama"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5A93C] text-[#0B0D10] transition-colors hover:bg-[#EEB955] disabled:cursor-not-allowed disabled:bg-[#232834] disabled:text-[#667085]"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
