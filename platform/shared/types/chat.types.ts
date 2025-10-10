import type { UIMessage } from 'ai';

/**
 * Core chat entity
 */
export interface Chat {
  id: string;
  agentId: string;
  sessionId: string;
  title?: string | null;
  selectedTools?: string[] | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  lastModel?: string | null;
  lastContextWindow?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message entity
 */
export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: UIMessage;
  createdAt: Date;
}

/**
 * Chat with all messages
 */
export interface ChatWithMessages extends Chat {
  messages: Message[];
}

/**
 * Create chat request
 */
export interface CreateChatRequest {
  agentId: string;
}

/**
 * Update chat request
 */
export interface UpdateChatRequest {
  title?: string | null;
}

/**
 * Tool selection update request
 */
export interface UpdateToolsRequest {
  toolIds: string[] | null;
}

/**
 * Token usage data
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  contextWindow?: number;
}
