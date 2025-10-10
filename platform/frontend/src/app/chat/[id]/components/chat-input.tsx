"use client";

import { Loader2, Send, Square } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
  disabled?: boolean;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled = false,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && input.trim()) {
        // Create a synthetic form event
        const formEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        }) as unknown as FormEvent<HTMLFormElement>;
        handleSubmit(formEvent);
      }
    }
  };

  const isSubmitDisabled = disabled || !input || !input.trim();

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative flex items-end gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
          disabled={disabled}
          className="min-h-[80px] max-h-[200px] resize-none pr-12"
          rows={3}
        />

        <div className="absolute bottom-2 right-2">
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={stop}
              className="h-8 w-8"
              title="Stop generation"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={isSubmitDisabled}
              className="h-8 w-8"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Generating response...</span>
        </div>
      )}
    </form>
  );
}
