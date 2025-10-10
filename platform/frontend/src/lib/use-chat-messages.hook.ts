"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/chat";

interface UseChatMessagesProps {
  chatId: string;
  sessionId: string;
  initialMessages?: ChatMessage[];
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

/**
 * Custom hook for managing chat messages with streaming
 *
 * This hook provides:
 * - Message state management
 * - Input handling
 * - Streaming from backend
 * - Error handling with toast notifications
 */
export function useChatMessages({
  chatId,
  sessionId,
  initialMessages = [],
  onMessagesUpdate,
}: UseChatMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Notify parent of message updates
  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/llm/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId,
          sessionId,
          model: "gpt-4o",
          provider: "openai",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      if (reader) {
        const assistantId = crypto.randomUUID();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantMessage += chunk;

          // Update assistant message as it streams
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.id === assistantId) {
              // Update existing assistant message
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: assistantMessage },
              ];
            } else {
              // Add new assistant message
              return [
                ...prev,
                {
                  id: assistantId,
                  role: "assistant" as const,
                  content: assistantMessage,
                  createdAt: new Date(),
                },
              ];
            }
          });
        }
      }

      toast.success("Message sent");
    } catch (err) {
      console.error("Chat error:", err);
      const errorObj =
        err instanceof Error ? err : new Error("Failed to send message");
      setError(errorObj);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const stop = () => {
    // TODO: Implement abort controller for streaming
    setIsLoading(false);
  };

  const reload = () => {
    // TODO: Implement message reload
  };

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    setMessages,
    error,
  };
}
