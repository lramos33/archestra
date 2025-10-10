"use client";

import { Edit2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AIResponse } from "@/components/ai-response";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/chat";

interface AssistantMessageProps {
  message: ChatMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      className="rounded-lg p-3 bg-primary/5 w-full text-left"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="text-xs font-medium mb-1 opacity-70 capitalize">
        Assistant
      </div>

      <div className="relative">
        <div className="gap-y-2 grid grid-cols-1 pr-24">
          {/* Text content with markdown */}
          {message.content && <AIResponse>{message.content}</AIResponse>}
        </div>

        {/* Action buttons on hover */}
        {isHovered && (
          <div className="absolute top-0 right-0 flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Edit message"
              onClick={() => {}}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Regenerate message"
              onClick={() => {}}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Delete message"
              onClick={() => {}}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
