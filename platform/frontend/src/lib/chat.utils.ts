import type { Chat } from "@shared/types/chat.types";

/**
 * Get display title for a chat
 */
export function getChatDisplayTitle(chat: Chat | null): string {
  if (!chat) return "Chat";
  return chat.title || "New Chat";
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Calculate context usage percentage
 */
export function calculateContextUsage(chat: Chat): number {
  if (!chat.lastContextWindow || !chat.totalTokens) return 0;
  return (chat.totalTokens / chat.lastContextWindow) * 100;
}

/**
 * Sort chats by most recent first
 */
export function sortChatsByRecent(chats: Chat[]): Chat[] {
  return [...chats].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
