"use client";

import type { ChatMessage } from "@/types/chat";

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="rounded-lg p-3 bg-muted">
      <div className="text-xs font-medium mb-1 opacity-70 capitalize">You</div>
      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
    </div>
  );
}
