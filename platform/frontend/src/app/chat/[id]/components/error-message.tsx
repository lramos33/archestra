"use client";

import { AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/types/chat";

interface ErrorMessageProps {
  message: ChatMessage;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/20">
      <div className="flex items-center gap-2 text-xs font-medium mb-1 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Error</span>
      </div>
      <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
        {message.content}
      </pre>
    </div>
  );
}
