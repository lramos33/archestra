"use client";

import * as api from "@shared/api-client/sdk.gen";
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
// Query Keys
// ============================================

// Import and re-export chatKeys from separate file so it can be used in Server Components
import { chatKeys } from "./chat.keys";
export { chatKeys };

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
      const response = await api.getChats();
      if (response.error) {
        throw new Error("Failed to fetch chats");
      }
      return response.data as unknown as Chat[];
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
      const response = await api.getChatById({ path: { id: chatId } });
      if (response.error) {
        throw new Error("Failed to fetch chat");
      }
      return response.data as unknown as ChatWithMessages;
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
      const response = await api.getChats();
      if (response.error) {
        throw new Error("Failed to fetch chats");
      }
      return response.data as unknown as Chat[];
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
      const response = await api.createChat({ body: data });
      if (response.error) {
        throw new Error("Failed to create chat");
      }
      return response.data as unknown as Chat;
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
      const response = await api.updateChat({
        path: { id },
        body: data,
      });
      if (response.error) {
        throw new Error("Failed to update chat");
      }
      return response.data as unknown as Chat;
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
      const response = await api.deleteChat({ path: { id } });
      if (response.error) {
        throw new Error("Failed to delete chat");
      }
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
      const response = await api.updateChatTools({
        path: { id: chatId },
        body: { toolIds },
      });
      if (response.error) {
        throw new Error("Failed to update tools");
      }
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}
