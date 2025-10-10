"use client";

import { useChat } from "@/lib/chat.query";
import { getChatDisplayTitle } from "@/lib/chat.utils";

export function ChatView({ chatId }: { chatId: string }) {
  const { data: chat } = useChat(chatId);

  return (
    <div className="flex flex-col h-full p-6">
      <h1 className="text-2xl font-bold mb-4">{getChatDisplayTitle(chat)}</h1>

      {/* Empty state - chat interface coming in next phase */}
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <div className="text-center max-w-md">
          <p className="text-lg mb-2">Chat Interface</p>
          <p className="text-sm">
            The chat message interface will be implemented in the next phase.
          </p>
          <p className="text-xs mt-4 text-muted-foreground/70">
            Chat ID: {chat.id}
            <br />
            Session ID: {chat.sessionId}
          </p>
        </div>
      </div>
    </div>
  );
}
