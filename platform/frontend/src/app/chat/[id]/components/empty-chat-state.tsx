"use client";

import { PromptCollection } from "./prompt-collection";

interface EmptyChatStateProps {
  onPromptSelect: (prompt: string) => void;
}

export function EmptyChatState({ onPromptSelect }: EmptyChatStateProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Start a conversation</h2>
          <p className="text-muted-foreground">
            Choose a prompt below or type your own message
          </p>
        </div>
        <PromptCollection onPromptSelect={onPromptSelect} />
      </div>
    </div>
  );
}
