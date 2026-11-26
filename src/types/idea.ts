export type IdeaStage = 'spark' | 'planning' | 'building' | 'shipped';

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface DeadlineItem {
  id: string;
  label: string;
  dueDate: string; // YYYY-MM-DD
  done: boolean;
}

export interface GeneratedFile {
  id: string;
  filename: string;  // e.g. "main.rs" or "README.md"
  extension: string; // e.g. ".rs", ".py", ".md"
  content: string;
  updatedAt: string;
}

export interface AiQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface TaskItem {
  id: string;
  ideaId: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
  contextIds?: string[];
  questions?: AiQuestion[];
  generatedFileIds?: string[];
}

export interface IdeaRecord {
  id: string;
  title: string;
  summary: string;
  architectureNotes: string;
  documentContent: string;
  stack: string;
  stage: IdeaStage;
  position: number;
  createdAt: string;
  updatedAt: string;
  deadlines: DeadlineItem[];
  files: GeneratedFile[];
  tasks: TaskItem[];
  messages: ChatMessage[];
  embedding?: number[];
  embeddingModel?: string;
  embeddedAt?: string;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
  family?: string;
  parameterSize?: string;
  isEmbeddingModel: boolean;
}

export interface OllamaStatusResponse {
  connected: boolean;
  endpoint: string;
  models: OllamaModelInfo[];
  error?: string;
}

export interface OllamaConfig {
  endpoint: string;
  chatModel: string;
  embeddingModel: string;
  useRagContext: boolean;
  useSteInstruction: boolean;
  customInstruction: string;
}

export interface SemanticMatch {
  ideaId: string;
  title: string;
  stage: IdeaStage;
  summary: string;
  similarity: number;
  source: 'embedding' | 'lexical';
}

export interface SuggestedTaskDraft {
  title: string;
  notes: string;
  priority: TaskPriority;
  status: TaskStatus;
}
