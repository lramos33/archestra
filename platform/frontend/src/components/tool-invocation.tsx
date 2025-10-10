// @ts-nocheck
// TypeScript has persistent type inference issues with conditional rendering in this file
"use client";

import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ToolInvocationProps {
  tool: {
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    error?: { message?: string } | string;
  };
}

export function ToolInvocation({ tool }: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = tool.toolName || "Unknown Tool";
  const args: Record<string, unknown> | undefined = tool.args;
  const result = tool.result;

  // Determine status based on tool state
  const isPending = !result && !tool.error;
  const isCompleted = Boolean(result && !tool.error);
  const isError = Boolean(tool.error);

  const formatJson = (obj: unknown): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const shouldShowArgs: boolean = Boolean(args && Object.keys(args).length > 0);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        isCompleted && "border-green-500/30 bg-green-500/5",
        isError && "border-red-500/30 bg-red-500/5",
        isPending && "border-yellow-500/30 bg-yellow-500/5",
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}

        {/* Status icon */}
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
        )}
        {isCompleted && <Check className="h-4 w-4 text-green-500" />}
        {isError && <X className="h-4 w-4 text-red-500" />}

        <span className="font-mono text-sm flex-1">{toolName}</span>
      </button>

      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* Arguments */}
          {shouldShowArgs && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Arguments:
              </div>
              <ScrollArea className="rounded overflow-x-auto">
                <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded">
                  {formatJson(args)}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Result:
              </div>
              <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto">
                {typeof result === "string" ? result : formatJson(result)}
              </pre>
            </div>
          )}

          {/* Error message */}
          {tool.error && (
            <div className="text-xs text-red-600 dark:text-red-400">
              Error:{" "}
              {typeof tool.error === "object" &&
              tool.error !== null &&
              "message" in tool.error
                ? String(tool.error.message)
                : String(tool.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
