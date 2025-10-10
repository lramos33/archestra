"use client";

import type {
  Chat,
  ChatWithMessages,
  CreateChatRequest,
  UpdateChatRequest,
} from "@shared/types/chat.types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

// ============================================
// Mock Data
// ============================================

const MOCK_CHATS: Chat[] = [
  {
    id: "chat-1",
    agentId: "agent-1",
    sessionId: "session-1",
    title: "Project Architecture Discussion",
    selectedTools: null,
    totalPromptTokens: 1250,
    totalCompletionTokens: 890,
    totalTokens: 2140,
    lastModel: "gpt-4",
    lastContextWindow: 8192,
    createdAt: new Date("2025-10-09T14:30:00Z"),
    updatedAt: new Date("2025-10-09T15:45:00Z"),
  },
  {
    id: "chat-2",
    agentId: "agent-1",
    sessionId: "session-2",
    title: "Code Review for PR #123",
    selectedTools: ["code-analysis", "git-tools"],
    totalPromptTokens: 890,
    totalCompletionTokens: 670,
    totalTokens: 1560,
    lastModel: "gpt-4",
    lastContextWindow: 8192,
    createdAt: new Date("2025-10-08T10:15:00Z"),
    updatedAt: new Date("2025-10-08T10:30:00Z"),
  },
  {
    id: "chat-3",
    agentId: "agent-1",
    sessionId: "session-3",
    title: null,
    selectedTools: null,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    lastModel: null,
    lastContextWindow: null,
    createdAt: new Date("2025-10-10T09:00:00Z"),
    updatedAt: new Date("2025-10-10T09:00:00Z"),
  },
];

// In-memory storage for mock data
let mockChatsStorage = [...MOCK_CHATS];

// ============================================
// Query Keys
// ============================================

export const chatKeys = {
  all: ["chats"] as const,
  lists: () => [...chatKeys.all, "list"] as const,
  list: () => [...chatKeys.lists()] as const,
  details: () => [...chatKeys.all, "detail"] as const,
  detail: (id: string) => [...chatKeys.details(), id] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Get all chats
 * Uses Suspense - wrap in Suspense boundary
 */
export function useChats() {
  return useSuspenseQuery({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockChatsStorage as Chat[];
    },
  });
}

/**
 * Get single chat with messages
 * Uses Suspense - wrap in Suspense boundary
 */
export function useChat(chatId: string) {
  return useSuspenseQuery({
    queryKey: chatKeys.detail(chatId),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const chat = mockChatsStorage.find((c) => c.id === chatId);
      if (!chat) {
        throw new Error("Chat not found");
      }

      // Mock chat with empty messages for now
      const chatWithMessages: ChatWithMessages = {
        ...chat,
        messages: [],
      };

      return chatWithMessages;
    },
  });
}

/**
 * Get all chats without Suspense (for optional data)
 */
export function useChatsOptional() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockChatsStorage as Chat[];
    },
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create new chat
 */
export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChatRequest) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newChat: Chat = {
        id: `chat-${Date.now()}`,
        agentId: data.agentId,
        sessionId: `session-${Date.now()}`,
        title: null,
        selectedTools: null,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        lastModel: null,
        lastContextWindow: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockChatsStorage = [newChat, ...mockChatsStorage];
      return newChat;
    },
    onSuccess: () => {
      // Invalidate chat list to refetch
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/**
 * Update chat (title, etc.)
 */
export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateChatRequest;
    }) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const chatIndex = mockChatsStorage.findIndex((c) => c.id === id);
      if (chatIndex === -1) {
        throw new Error("Chat not found");
      }

      const updatedChat: Chat = {
        ...mockChatsStorage[chatIndex],
        ...data,
        updatedAt: new Date(),
      };

      mockChatsStorage[chatIndex] = updatedChat;
      return updatedChat;
    },
    onSuccess: (_, { id }) => {
      // Invalidate both list and detail
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(id) });
    },
  });
}

/**
 * Delete chat
 */
export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const chatIndex = mockChatsStorage.findIndex((c) => c.id === id);
      if (chatIndex === -1) {
        throw new Error("Chat not found");
      }

      mockChatsStorage = mockChatsStorage.filter((c) => c.id !== id);
    },
    onSuccess: () => {
      // Invalidate chat list to refetch
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/**
 * Update selected tools
 */
export function useUpdateChatTools() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatId,
      toolIds,
    }: {
      chatId: string;
      toolIds: string[] | null;
    }) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const chatIndex = mockChatsStorage.findIndex((c) => c.id === chatId);
      if (chatIndex === -1) {
        throw new Error("Chat not found");
      }

      mockChatsStorage[chatIndex] = {
        ...mockChatsStorage[chatIndex],
        selectedTools: toolIds,
        updatedAt: new Date(),
      };

      return { selectedTools: toolIds };
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}
