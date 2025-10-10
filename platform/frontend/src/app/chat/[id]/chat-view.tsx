"use client";

import { useMemo } from "react";
import { useChat } from "@/lib/chat.query";
import { getChatDisplayTitle } from "@/lib/chat.utils";
import { useChatMessages } from "@/lib/use-chat-messages.hook";
import type { ChatMessage } from "@/types/chat";
import { ChatHistory } from "./components/chat-history";
import { ChatInput } from "./components/chat-input";
import { EmptyChatState } from "./components/empty-chat-state";

export function ChatView({ chatId }: { chatId: string }) {
  const { data: chat } = useChat(chatId);

  // Convert stored messages to chat format (memoized to prevent infinite loops)
  const initialMessages = useMemo<ChatMessage[]>(
    () =>
      chat.messages?.map((msg) => {
        // The content field stores the entire UIMessage object
        const uiMessage = msg.content as unknown as
          | string
          | {
              role?: string;
              content?:
                | string
                | Array<{
                    type: string;
                    text?: string;
                    [key: string]: unknown;
                  }>;
              text?: string;
              [key: string]: unknown;
            };

        // Extract string content from various possible formats
        let content = "";
        if (typeof uiMessage === "string") {
          content = uiMessage;
        } else if (uiMessage && Array.isArray(uiMessage.content)) {
          // Handle AI SDK format: { role, content: [{ text, type, ... }] }
          const textParts = uiMessage.content
            .filter((item) => item.type === "text" && item.text)
            .map((item) => item.text || "");
          content = textParts.join("\n");
        } else if (uiMessage && typeof uiMessage.content === "string") {
          content = uiMessage.content;
        } else if (uiMessage && typeof uiMessage.text === "string") {
          content = uiMessage.text;
        } else if (uiMessage) {
          // Fallback: try to stringify if it's an object
          content = JSON.stringify(uiMessage);
        }

        return {
          id: msg.id,
          role: msg.role as ChatMessage["role"],
          content,
          createdAt: msg.createdAt,
        };
      }) || [],
    [chat.messages],
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setInput,
  } = useChatMessages({
    chatId: chat.id,
    sessionId: chat.sessionId,
    initialMessages,
  });

  const isChatEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold">{getChatDisplayTitle(chat)}</h1>
      </div>

      {/* Messages or Empty State */}
      {isChatEmpty ? (
        <div className="flex-1 min-h-0 overflow-auto px-6">
          <EmptyChatState
            onPromptSelect={(prompt) => {
              setInput(prompt);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden px-6">
          <ChatHistory
            messages={messages}
            chatId={chat.id}
            sessionId={chat.sessionId}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-6 pt-2">
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          disabled={!chat}
        />
      </div>
    </div>
  );
}
