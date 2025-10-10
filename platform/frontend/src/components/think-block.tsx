"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThinkBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ThinkBlock({
  content,
  isStreaming = false,
  className,
}: ThinkBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  // Auto-expand when streaming, collapse when done
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isStreaming]);

  return (
    <div
      className={cn(
        "rounded-lg border border-muted-foreground/20 bg-muted/50",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 font-mono text-muted-foreground hover:bg-muted"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span className="text-xs">
          {isStreaming ? "Thinking..." : "Thinking"}
        </span>
      </Button>
      {isExpanded && (
        <div className="px-4 pb-3">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono leading-relaxed">
            {content}
            {isStreaming && <span className="animate-pulse">▊</span>}
          </pre>
        </div>
      )}
    </div>
  );
}
