"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/types/chat";
import { AssistantMessage } from "./assistant-message";
import { ErrorMessage } from "./error-message";
import { UserMessage } from "./user-message";

interface ChatHistoryProps {
  messages: ChatMessage[];
  chatId: string;
  sessionId: string;
  isLoading: boolean;
}

export function ChatHistory({
  messages,
  chatId: _chatId,
  sessionId: _sessionId,
  isLoading,
}: ChatHistoryProps) {
  const _scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <ScrollArea className="h-full w-full rounded-lg border">
      <div className="p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={message.id || `message-${index}`}>
            {message.role === "user" && <UserMessage message={message} />}
            {message.role === "assistant" &&
              (message.id?.startsWith("error-") ? (
                <ErrorMessage message={message} />
              ) : (
                <AssistantMessage message={message} />
              ))}
            {message.role === "system" && (
              <div className="text-sm text-muted-foreground italic">
                {message.content}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            <span>Assistant is thinking...</span>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
