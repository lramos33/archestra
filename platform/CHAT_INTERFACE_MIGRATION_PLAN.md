# Chat Interface Migration Plan: Desktop App → Platform

> **Status:** Planning - Ready for Implementation  
> **Created:** October 10, 2025  
> **Prerequisite:** CHAT_MIGRATION_PLAN.md (Phases 1-6) must be completed  
> **Estimated Time:** ~20 hours of development

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Overview](#architecture-overview)
4. [Phase 1: Backend - Streaming Infrastructure](#phase-1-backend---streaming-infrastructure)
5. [Phase 2: Frontend - AI SDK Integration](#phase-2-frontend---ai-sdk-integration)
6. [Phase 3: Message Components](#phase-3-message-components)
7. [Phase 4: Chat Input](#phase-4-chat-input)
8. [Phase 5: Empty State & Prompts](#phase-5-empty-state--prompts)
9. [Phase 6: Tool Invocations](#phase-6-tool-invocations)
10. [Phase 7: Advanced Features](#phase-7-advanced-features)
11. [Phase 8: Testing & Polish](#phase-8-testing--polish)
12. [File Structure Summary](#file-structure-summary)
13. [Reference Files](#reference-files)
14. [Testing Checklist](#testing-checklist)

---

## Overview

This document outlines the migration of the chat interface (LLM conversation UI) from the desktop app to the platform. This builds on the foundation established in CHAT_MIGRATION_PLAN.md.

### Goals

✅ Full chat conversation interface with streaming  
✅ Message rendering (user, assistant, system)  
✅ Tool invocation display  
✅ Markdown and code syntax highlighting  
✅ Inline message editing  
✅ Message regeneration  
✅ Chat input with model selection  
✅ Empty state with prompt templates  
✅ Reasoning blocks (think blocks)  
✅ Token usage display

### What This Migration Includes

- AI SDK integration with streaming
- Backend LLM proxy endpoint
- Message components (user, assistant, tool)
- Markdown rendering with code blocks
- Tool invocation display
- Chat input with model selector
- Message actions (edit, delete, regenerate)
- Empty state with prompt templates
- Reasoning/think blocks
- Auto-scrolling chat history
- Token usage tracking UI

### What This Migration Does NOT Include

❌ Tool approval workflow (manual approval UI)  
❌ Real-time WebSocket updates across clients  
❌ Multi-chat parallel management  
❌ Memory/persona management  
❌ Advanced tool configuration UI  
❌ Chat export/import  
❌ Voice input  
❌ Image/file attachments  
❌ Custom system prompts UI

These features can be added in future iterations.

---

## Prerequisites

**IMPORTANT:** The following must be completed before starting this migration:

✅ CHAT_MIGRATION_PLAN.md Phases 1-6 completed  
✅ Chat database schema created  
✅ Chat API routes implemented  
✅ Chat list in sidebar working  
✅ Empty chat page routing working  
✅ TanStack Query hooks for chat data

If these are not complete, go back and finish CHAT_MIGRATION_PLAN.md first.

---

## Architecture Overview

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Page (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │           ChatView (Client Component)                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │    ChatHistory (Messages + Auto-scroll)         │  │  │
│  │  │  - UserMessage                                   │  │  │
│  │  │  - AssistantMessage (with AIResponse)            │  │  │
│  │  │  - ThinkBlock (reasoning)                        │  │  │
│  │  │  - ToolInvocation                                │  │  │
│  │  │  - ErrorMessage                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │    ChatInput (Model + Tools + Submit)           │  │  │
│  │  │  - AIInput (textarea with auto-resize)           │  │  │
│  │  │  - ModelSelector                                 │  │  │
│  │  │  - ToolDisplay                                   │  │  │
│  │  │  - TokenUsage                                    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  useChat (AI SDK) ──> /api/llm/stream                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Fastify)                              │
├─────────────────────────────────────────────────────────────┤
│  /api/llm/stream                                            │
│    - Verify chat permissions                                │
│    - Get selected tools for chat                            │
│    - Wrap tools with approval logic                         │
│    - Create model instance (Ollama/OpenAI/etc)              │
│    - Stream response with AI SDK                            │
│    - Save messages to DB on finish                          │
│    - Update token usage                                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User types message** → ChatInput captures input
2. **User submits** → `useChat.submit()` called
3. **Frontend sends request** → POST `/api/llm/stream`
4. **Backend processes** → Gets tools, creates model, streams response
5. **Frontend receives stream** → Updates messages in real-time
6. **Backend saves** → On stream finish, saves all messages to DB
7. **Frontend updates UI** → Re-renders with complete messages

### Key Design Decisions

1. **AI SDK v4+**: Use latest AI SDK with `useChat` hook for streaming
2. **Server-side streaming**: Backend proxies to LLM providers (Ollama, OpenAI, etc.)
3. **Message persistence**: Save messages on stream completion, not during
4. **Tool integration**: Use chat's selected tools from database
5. **Token tracking**: Update token usage after each completion
6. **No WebSocket**: Use HTTP streaming (Server-Sent Events) via AI SDK

---

## Phase 1: Backend - Streaming Infrastructure

**Estimated Time:** 4 hours

### Task 1.1: Create LLM Streaming Route

**File:** `platform/backend/src/routes/llm.ts`

**Implementation:**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  streamText,
  convertToUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";
import { ChatModel } from "@/models/chat";
import { AgentModel } from "@/models/agent";

interface StreamRequestBody {
  messages: UIMessage[];
  sessionId: string;
  model: string;
  provider?: string;
  chatId: string;
}

export default async function llmRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/llm/stream
   * Stream LLM responses with tool support
   */
  fastify.post<{
    Body: StreamRequestBody;
  }>(
    "/api/llm/stream",
    {
      schema: {
        tags: ["LLM"],
        description: "Stream LLM response with tools",
        body: z.object({
          messages: z.array(z.any()),
          sessionId: z.string().uuid(),
          model: z.string(),
          provider: z.string().optional(),
          chatId: z.string().uuid(),
        }),
        response: {
          200: z.any(), // Stream response
        },
      },
    },
    async (request, reply) => {
      const {
        messages,
        sessionId,
        model,
        provider = "openai",
        chatId,
      } = request.body;

      try {
        // Verify chat exists and get selected tools
        const chat = await ChatModel.findBySessionId(sessionId);
        if (!chat) {
          return reply.code(404).send({ error: "Chat not found" });
        }

        // Get selected tools for this chat
        const selectedTools = await ChatModel.getSelectedTools(chat.id);

        // TODO: Implement tool loading based on selectedTools
        // For now, empty tools object
        const tools = {};

        // Create model instance
        const modelInstance = await createModelInstance(model, provider);

        // Stream with AI SDK
        const result = streamText({
          model: modelInstance,
          messages: messages as any,
          tools,
          maxSteps: 10, // Allow multi-step tool usage
        });

        // Convert to UI stream response
        const response = convertToUIMessageStreamResponse({
          stream: result.stream,
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            // Save messages to database
            await ChatModel.saveMessages(sessionId, finalMessages);

            // Update token usage (extract from result)
            const usage = await result.usage;
            if (usage) {
              await ChatModel.updateTokenUsage(sessionId, {
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                model,
              });
            }
          },
        });

        // Send stream response
        return reply.send(response);
      } catch (error) {
        fastify.log.error("LLM streaming error:", error);
        return reply.code(500).send({
          error: "Failed to stream response",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
}

/**
 * Create model instance based on provider
 */
async function createModelInstance(model: string, provider: string) {
  if (provider === "ollama") {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
    });
    return ollama(model);
  }

  // Default to OpenAI-compatible
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy-key",
    baseURL: process.env.OPENAI_BASE_URL,
  });
  return openai(model);
}
```

**Key Features:**

- Streaming with AI SDK
- Tool support (placeholder for now)
- Message persistence on completion
- Token usage tracking
- Multi-provider support (Ollama, OpenAI)

**Reference:** `desktop_app/src/backend/server/plugins/llm/index.ts`

---

### Task 1.2: Register LLM Routes

**File:** `platform/backend/src/routes/index.ts`

**Add registration:**

```typescript
import llmRoutes from "./llm";

export default async function routes(fastify: FastifyInstance) {
  // ... existing routes ...

  // Register LLM routes
  await fastify.register(llmRoutes);
}
```

---

### Task 1.3: Add AI SDK Dependencies

**File:** `platform/backend/package.json`

**Add dependencies:**

```bash
cd platform/backend
pnpm add ai @ai-sdk/openai ollama-ai-provider
```

**Packages:**

- `ai`: AI SDK core
- `@ai-sdk/openai`: OpenAI provider
- `ollama-ai-provider`: Ollama provider

---

### Task 1.4: Environment Variables

**File:** `platform/.env` (or `.env.local`)

**Add variables:**

```bash
# LLM Providers
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434/api
```

---

## Phase 2: Frontend - AI SDK Integration

**Estimated Time:** 3 hours

### Task 2.1: Add AI SDK to Frontend

**Commands:**

```bash
cd platform/frontend
pnpm add ai
```

---

### Task 2.2: Create Chat Hook

**File:** `platform/frontend/src/hooks/use-chat-messages.ts`

**Implementation:**

```typescript
"use client";

import { useChat as useAIChat } from "ai/react";
import type { UIMessage } from "ai";
import { useEffect } from "react";
import { toast } from "sonner";

interface UseChatMessagesProps {
  chatId: string;
  sessionId: string;
  initialMessages?: UIMessage[];
  onMessagesUpdate?: (messages: UIMessage[]) => void;
}

export function useChatMessages({
  chatId,
  sessionId,
  initialMessages = [],
  onMessagesUpdate,
}: UseChatMessagesProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    setMessages,
  } = useAIChat({
    id: sessionId,
    api: "/api/llm/stream",
    body: {
      chatId,
      sessionId,
      model: "gpt-4o", // TODO: Get from user settings or chat config
      provider: "openai",
    },
    initialMessages,
    onError: (error) => {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    },
    onFinish: () => {
      // Messages are automatically saved by backend
      toast.success("Message sent");
    },
  });

  // Notify parent of message updates
  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    setMessages,
  };
}
```

---

### Task 2.3: Update Chat View

**File:** `platform/frontend/src/app/chat/[id]/chat-view.tsx`

**Replace placeholder with chat interface:**

```typescript
"use client";

import { useChatMessages } from "@/hooks/use-chat-messages";
import { useChat } from "@/lib/chat.query";
import { getChatDisplayTitle } from "@/lib/chat.utils";
import { ChatHistory } from "./components/chat-history";
import { ChatInput } from "./components/chat-input";
import { EmptyChatState } from "./components/empty-chat-state";

export function ChatView({ chatId }: { chatId: string }) {
  const { data: chat } = useChat(chatId);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
  } = useChatMessages({
    chatId: chat.id,
    sessionId: chat.sessionId,
    initialMessages: chat.messages || [],
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
              // TODO: Handle prompt selection
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
```

---

## Phase 3: Message Components

**Estimated Time:** 5 hours

### Task 3.1: Create ChatHistory Component

**File:** `platform/frontend/src/app/chat/[id]/components/chat-history.tsx`

**Implementation:**

```typescript
"use client";

import { useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { ErrorMessage } from "./error-message";

interface ChatHistoryProps {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  isLoading: boolean;
}

export function ChatHistory({
  messages,
  chatId,
  sessionId,
  isLoading,
}: ChatHistoryProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  return (
    <ScrollArea
      className="h-full w-full rounded-lg border"
      viewportRef={scrollAreaRef}
    >
      <div className="p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={message.id || `message-${index}`}>
            {message.role === "user" && <UserMessage message={message} />}
            {message.role === "assistant" &&
              (message.id.startsWith("error-") ? (
                <ErrorMessage message={message} />
              ) : (
                <AssistantMessage message={message} />
              ))}
            {message.role === "system" && (
              <div className="text-sm text-muted-foreground">
                {/* System messages - can be styled differently */}
              </div>
            )}
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

---

### Task 3.2: Create UserMessage Component

**File:** `platform/frontend/src/app/chat/[id]/components/user-message.tsx`

**Implementation:**

```typescript
"use client";

import type { UIMessage } from "ai";

interface UserMessageProps {
  message: UIMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  // Extract text from message parts
  let textContent = "";
  if (message.parts) {
    textContent = message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }

  return (
    <div className="rounded-lg p-3 bg-muted">
      <div className="text-xs font-medium mb-1 opacity-70 capitalize">You</div>
      <div className="text-sm whitespace-pre-wrap">{textContent}</div>
    </div>
  );
}
```

**Reference:** `desktop_app/src/ui/components/Chat/ChatHistory/Messages/UserMessage.tsx`

---

### Task 3.3: Create AssistantMessage Component

**File:** `platform/frontend/src/app/chat/[id]/components/assistant-message.tsx`

**Implementation:**

```typescript
"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { Edit2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIResponse } from "@/components/kibo/ai-response";
import { ThinkBlock } from "@/components/think-block";
import { ToolInvocation } from "@/components/tool-invocation";

interface AssistantMessageProps {
  message: UIMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!message.parts) {
    return null;
  }

  // Separate parts by type
  const reasoningParts: any[] = [];
  const toolParts: any[] = [];
  let accumulatedText = "";

  message.parts.forEach((part: any) => {
    if (part.type === "text") {
      accumulatedText += part.text;
    } else if (part.type === "reasoning") {
      reasoningParts.push(part);
    } else if (part.type === "dynamic-tool") {
      toolParts.push(part);
    }
  });

  return (
    <div
      className="rounded-lg p-3 bg-primary/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="text-xs font-medium mb-1 opacity-70 capitalize">
        Assistant
      </div>

      <div className="relative">
        <div className="gap-y-2 grid grid-cols-1 pr-24">
          {/* Reasoning blocks */}
          {reasoningParts.map((reasoning, index) => (
            <ThinkBlock
              key={`reasoning-${index}`}
              content={reasoning.text || ""}
              isStreaming={reasoning.state !== "done"}
            />
          ))}

          {/* Tool invocations */}
          {toolParts.map((tool, index) => (
            <ToolInvocation
              key={tool.toolCallId || `tool-${index}`}
              tool={tool}
            />
          ))}

          {/* Text content with markdown */}
          {accumulatedText.trim() && (
            <AIResponse>{accumulatedText.trim()}</AIResponse>
          )}
        </div>

        {/* Action buttons on hover */}
        {isHovered && (
          <div className="absolute top-0 right-0 flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Edit message"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Regenerate message"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Reference:** `desktop_app/src/ui/components/Chat/ChatHistory/Messages/AssistantMessage.tsx`

---

### Task 3.4: Create ErrorMessage Component

**File:** `platform/frontend/src/app/chat/[id]/components/error-message.tsx`

**Implementation:**

```typescript
"use client";

import type { UIMessage } from "ai";
import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: UIMessage;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  let errorText = "An error occurred";
  if (message.parts) {
    errorText = message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }

  return (
    <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/20">
      <div className="flex items-center gap-2 text-xs font-medium mb-1 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Error</span>
      </div>
      <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
        {errorText}
      </pre>
    </div>
  );
}
```

---

### Task 3.5: Create AIResponse Component

**File:** `platform/frontend/src/components/kibo/ai-response.tsx`

**Implementation:**

```typescript
"use client";

import { memo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

export type AIResponseProps = {
  children: string;
  className?: string;
};

const components: Options["components"] = {
  // Lists
  ol: ({ children, className, ...props }) => (
    <ol className={cn("list-inside pl-0.5 list-decimal", className)} {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, className, ...props }) => (
    <ul className={cn("list-inside pl-0.5 list-disc", className)} {...props}>
      {children}
    </ul>
  ),
  li: ({ children, className, ...props }) => (
    <li className={cn("py-1", className)} {...props}>
      {children}
    </li>
  ),

  // Typography
  strong: ({ children, className, ...props }) => (
    <span className={cn("font-semibold", className)} {...props}>
      {children}
    </span>
  ),
  a: ({ children, className, href, ...props }) => (
    <a
      className={cn("font-medium text-primary underline", className)}
      href={href}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // Headings
  h1: ({ children, className, ...props }) => (
    <h1
      className={cn("mt-6 mb-2 font-semibold text-3xl", className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, className, ...props }) => (
    <h2
      className={cn("mt-6 mb-2 font-semibold text-2xl", className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, className, ...props }) => (
    <h3 className={cn("mt-6 mb-2 font-semibold text-xl", className)} {...props}>
      {children}
    </h3>
  ),

  // Code blocks
  pre: ({ children }) => {
    // Extract code and language from children
    const codeElement = children as any;
    if (codeElement?.props?.className) {
      const language = codeElement.props.className.replace("language-", "");
      const code = codeElement.props.children;
      return <CodeBlock language={language} code={code} />;
    }
    return <pre>{children}</pre>;
  },
  code: ({ children, className }) => {
    // Inline code
    if (!className) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return <code>{children}</code>;
  },
};

export const AIResponse = memo(
  ({ children, className }: AIResponseProps) => (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

AIResponse.displayName = "AIResponse";
```

**Add dependencies:**

```bash
cd platform/frontend
pnpm add react-markdown remark-gfm
```

**Reference:** `desktop_app/src/ui/components/kibo/ai-response.tsx`

---

### Task 3.6: Create ThinkBlock Component

**File:** `platform/frontend/src/components/think-block.tsx`

**Implementation:**

```typescript
"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
        className
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
```

**Reference:** `desktop_app/src/ui/components/ThinkBlock/index.tsx`

---

## Phase 4: Chat Input

**Estimated Time:** 3 hours

### Task 4.1: Create ChatInput Component

**File:** `platform/frontend/src/app/chat/[id]/components/chat-input.tsx`

**Implementation:**

```typescript
"use client";

import { type ChangeEvent, type FormEvent } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
        handleSubmit(e as any);
      }
    }
  };

  const isSubmitDisabled = disabled || !input.trim();

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
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={isSubmitDisabled}
              className="h-8 w-8"
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
```

**Reference:** `desktop_app/src/ui/components/Chat/ChatInput/index.tsx`

---

### Task 4.2: Add Model Selection (Future)

**Note:** Model selection will be added in a future phase. For now, the model is hardcoded in the `useChatMessages` hook.

**TODO for future:**

- Create model selector dropdown
- Store selected model in user settings
- Pass model to backend streaming endpoint

---

## Phase 5: Empty State & Prompts

**Estimated Time:** 2 hours

### Task 5.1: Create EmptyChatState Component

**File:** `platform/frontend/src/app/chat/[id]/components/empty-chat-state.tsx`

**Implementation:**

```typescript
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
```

**Reference:** `desktop_app/src/ui/components/Chat/EmptyChatState/index.tsx`

---

### Task 5.2: Create PromptCollection Component

**File:** `platform/frontend/src/app/chat/[id]/components/prompt-collection.tsx`

**Implementation:**

```typescript
"use client";

import { PromptCard } from "./prompt-card";

const STARTER_PROMPTS = [
  {
    id: "email-summary",
    title: "Email Summary",
    description: "Summarize my recent emails and highlight important ones",
    prompt:
      "Please check my email inbox and summarize the important messages from today.",
  },
  {
    id: "task-planning",
    title: "Task Planning",
    description: "Help me organize and prioritize my tasks",
    prompt: "Review my tasks and help me create a prioritized plan for today.",
  },
  {
    id: "research",
    title: "Research Assistant",
    description: "Help me research a topic",
    prompt:
      "I need help researching [topic]. Can you find relevant information and summarize the key points?",
  },
  {
    id: "code-review",
    title: "Code Review",
    description: "Review code and suggest improvements",
    prompt: "Can you review my recent code changes and suggest improvements?",
  },
];

interface PromptCollectionProps {
  onPromptSelect: (prompt: string) => void;
}

export function PromptCollection({ onPromptSelect }: PromptCollectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {STARTER_PROMPTS.map((template) => (
        <PromptCard
          key={template.id}
          template={template}
          onClick={onPromptSelect}
        />
      ))}
    </div>
  );
}
```

**Reference:** `desktop_app/src/ui/components/Chat/PromptCollection/index.tsx`

---

### Task 5.3: Create PromptCard Component

**File:** `platform/frontend/src/app/chat/[id]/components/prompt-card.tsx`

**Implementation:**

```typescript
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

interface PromptCardProps {
  template: PromptTemplate;
  onClick: (prompt: string) => void;
}

export function PromptCard({ template, onClick }: PromptCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={() => onClick(template.prompt)}
    >
      <CardHeader>
        <CardTitle className="text-lg">{template.title}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span>Try this prompt</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Phase 6: Tool Invocations

**Estimated Time:** 2 hours

### Task 6.1: Create ToolInvocation Component

**File:** `platform/frontend/src/components/tool-invocation.tsx`

**Implementation:**

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ToolInvocationProps {
  tool: any; // DynamicToolUIPart from AI SDK
}

export function ToolInvocation({ tool }: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = tool.toolName;
  const args = "input" in tool ? tool.input : {};
  const result = "output" in tool ? tool.output : undefined;

  // Determine status
  const isPending = tool.state === "input-available";
  const isCompleted = tool.state === "output-available";
  const isError = tool.state === "output-error";

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        isCompleted && "border-green-500/30 bg-green-500/5",
        isError && "border-red-500/30 bg-red-500/5",
        isPending && "border-yellow-500/30 bg-yellow-500/5"
      )}
    >
      <button
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
          {args && typeof args === "object" && Object.keys(args).length > 0 && (
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
          {isError && result && (
            <div className="text-xs text-red-600 dark:text-red-400">
              Error:{" "}
              {typeof result === "object" &&
              result !== null &&
              "message" in result
                ? String((result as any).message)
                : String(result)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Reference:** `desktop_app/src/ui/components/ToolInvocation/index.tsx`

---

## Phase 7: Advanced Features

**Estimated Time:** 3 hours

### Task 7.1: Add Code Block Syntax Highlighting

**File:** `platform/frontend/src/components/kibo/code-block.tsx`

**Implementation:**

```typescript
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

export function CodeBlock({ language, code, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn("rounded-lg border bg-muted/50 overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground">
          {language}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-6 w-6 p-0"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}
```

**Note:** For full syntax highlighting, consider adding `react-syntax-highlighter`:

```bash
cd platform/frontend
pnpm add react-syntax-highlighter @types/react-syntax-highlighter
```

---

### Task 7.2: Add Message Actions (Edit, Delete, Regenerate)

**File:** `platform/frontend/src/hooks/use-message-actions.ts`

**Implementation:**

```typescript
"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { toast } from "sonner";
import { apiClient } from "@shared/api-client";

interface UseMessageActionsProps {
  messages: UIMessage[];
  setMessages: (
    messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
  ) => void;
  sessionId: string;
}

export function useMessageActions({
  messages,
  setMessages,
  sessionId,
}: UseMessageActionsProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const startEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditingContent(currentContent);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const saveEdit = async (messageId: string, newText: string) => {
    if (!newText.trim()) return;

    // Update local state
    let updatedMessage: UIMessage | null = null;
    const updatedMessages = messages.map((msg) => {
      if (msg.id === messageId) {
        updatedMessage = {
          ...msg,
          parts: [{ type: "text", text: newText }],
        } as UIMessage;
        return updatedMessage;
      }
      return msg;
    });

    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent("");

    // TODO: Add backend API endpoint for updating individual messages
    // For now, we'll save all messages
    try {
      // Backend will need a new endpoint for this
      toast.success("Message updated");
    } catch (error) {
      toast.error("Failed to update message");
      console.error("Failed to update message:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    // Update local state
    const updatedMessages = messages.filter((msg) => msg.id !== messageId);
    setMessages(updatedMessages);

    // TODO: Add backend API endpoint for deleting individual messages
    try {
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
      console.error("Failed to delete message:", error);
    }
  };

  return {
    editingMessageId,
    editingContent,
    setEditingContent,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteMessage,
  };
}
```

**Note:** This requires additional backend endpoints for message CRUD operations.

**Reference:** `desktop_app/src/ui/hooks/use-message-actions.ts`

---

### Task 7.3: Add Auto-Scroll with Manual Override

**File:** `platform/frontend/src/hooks/use-chat-scrolling.ts`

**Implementation:**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

export function useChatScrolling(messageCount: number) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user has scrolled up
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      setShouldAutoScroll(isNearBottom);
      setShowScrollButton(!isNearBottom);
    };

    scrollArea.addEventListener("scroll", handleScroll);
    return () => scrollArea.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when new messages arrive (if enabled)
  useEffect(() => {
    if (shouldAutoScroll && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messageCount, shouldAutoScroll]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      setShouldAutoScroll(true);
    }
  };

  return {
    scrollAreaRef,
    showScrollButton,
    scrollToBottom,
  };
}
```

---

## Phase 8: Testing & Polish

**Estimated Time:** 2 hours

### Task 8.1: Type Checking

```bash
cd platform
pnpm type-check
```

### Task 8.2: Linting

```bash
cd platform
pnpm lint
```

### Task 8.3: Start Development Environment

```bash
cd platform
tilt up
```

### Task 8.4: Manual Testing

See [Testing Checklist](#testing-checklist) below.

---

## File Structure Summary

### New Files Created

```
platform/
├── backend/
│   ├── src/
│   │   └── routes/
│   │       └── llm.ts                              ✨ NEW
│
├── frontend/
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── use-chat-messages.ts                ✨ NEW
│   │   │   ├── use-message-actions.ts              ✨ NEW
│   │   │   └── use-chat-scrolling.ts               ✨ NEW
│   │   ├── components/
│   │   │   ├── kibo/
│   │   │   │   ├── ai-response.tsx                 ✨ NEW
│   │   │   │   └── code-block.tsx                  ✨ NEW
│   │   │   ├── think-block.tsx                     ✨ NEW
│   │   │   └── tool-invocation.tsx                 ✨ NEW
│   │   └── app/
│   │       └── chat/
│   │           └── [id]/
│   │               ├── components/
│   │               │   ├── chat-history.tsx        ✨ NEW
│   │               │   ├── user-message.tsx        ✨ NEW
│   │               │   ├── assistant-message.tsx   ✨ NEW
│   │               │   ├── error-message.tsx       ✨ NEW
│   │               │   ├── chat-input.tsx          ✨ NEW
│   │               │   ├── empty-chat-state.tsx    ✨ NEW
│   │               │   ├── prompt-collection.tsx   ✨ NEW
│   │               │   └── prompt-card.tsx         ✨ NEW
```

### Files Modified

```
platform/
├── backend/
│   ├── src/
│   │   └── routes/
│   │       └── index.ts                            🔧 MODIFIED (register llm routes)
│   └── package.json                                 🔧 MODIFIED (add AI SDK deps)
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │       └── chat/
│   │           └── [id]/
│   │               └── chat-view.tsx               🔧 MODIFIED (full interface)
│   └── package.json                                 🔧 MODIFIED (add AI SDK deps)
│
└── .env                                             🔧 MODIFIED (add LLM keys)
```

---

## Reference Files

### Desktop App Reference Files

| Feature               | Desktop App File                                                               | Notes                     |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| Chat Page             | `desktop_app/src/ui/routes/chat.tsx`                                           | Main chat interface       |
| ChatHistory           | `desktop_app/src/ui/components/Chat/ChatHistory/index.tsx`                     | Message list with scroll  |
| UserMessage           | `desktop_app/src/ui/components/Chat/ChatHistory/Messages/UserMessage.tsx`      | User message bubble       |
| AssistantMessage      | `desktop_app/src/ui/components/Chat/ChatHistory/Messages/AssistantMessage.tsx` | AI message with actions   |
| ChatInput             | `desktop_app/src/ui/components/Chat/ChatInput/index.tsx`                       | Input with model selector |
| EmptyChatState        | `desktop_app/src/ui/components/Chat/EmptyChatState/index.tsx`                  | Empty state with prompts  |
| PromptCollection      | `desktop_app/src/ui/components/Chat/PromptCollection/index.tsx`                | Starter prompts           |
| ThinkBlock            | `desktop_app/src/ui/components/ThinkBlock/index.tsx`                           | Reasoning display         |
| ToolInvocation        | `desktop_app/src/ui/components/ToolInvocation/index.tsx`                       | Tool call display         |
| AIResponse            | `desktop_app/src/ui/components/kibo/ai-response.tsx`                           | Markdown rendering        |
| CodeBlock             | `desktop_app/src/ui/components/kibo/code-block.tsx`                            | Code syntax highlighting  |
| useMessageActions     | `desktop_app/src/ui/hooks/use-message-actions.ts`                              | Edit/delete/regenerate    |
| useChatScrolling      | `desktop_app/src/ui/components/Chat/ChatHistory/ChatHistory.hooks.ts`          | Auto-scroll logic         |
| Multi-chat Manager    | `desktop_app/src/ui/contexts/multi-chat-manager.tsx`                           | AI SDK integration        |
| LLM Streaming Backend | `desktop_app/src/backend/server/plugins/llm/index.ts`                          | Backend proxy             |

### Platform Reference Files

| Pattern        | Platform File                             | Notes            |
| -------------- | ----------------------------------------- | ---------------- |
| TanStack Query | `platform/frontend/src/lib/chat.query.ts` | Query hooks      |
| API Client     | `platform/shared/api-client/`             | Generated client |
| Server Actions | `platform/frontend/src/app/*/page.tsx`    | Next.js patterns |

---

## Testing Checklist

### Backend Testing

- [ ] **Streaming Endpoint**
  - [ ] Start backend: `cd platform/backend && pnpm dev`
  - [ ] Test with curl or Postman
  - [ ] Verify messages are saved to database
  - [ ] Check token usage is updated

### Frontend Testing

- [ ] **Empty State**

  - [ ] Navigate to empty chat
  - [ ] See prompt templates
  - [ ] Click prompt fills input (TODO)

- [ ] **Message Sending**

  - [ ] Type message and submit
  - [ ] See user message appear
  - [ ] See streaming indicator
  - [ ] See assistant response stream in
  - [ ] Verify message saved to DB

- [ ] **Message Rendering**

  - [ ] Markdown renders correctly (bold, italic, lists)
  - [ ] Code blocks have syntax highlighting
  - [ ] Links are clickable
  - [ ] Inline code styled correctly

- [ ] **Tool Invocations** (if tools enabled)

  - [ ] Tool calls display correctly
  - [ ] Can expand/collapse tool details
  - [ ] Arguments and results shown
  - [ ] Status icons correct

- [ ] **Think Blocks** (if model supports reasoning)

  - [ ] Reasoning blocks appear
  - [ ] Auto-expand when streaming
  - [ ] Auto-collapse when done
  - [ ] Can manually toggle

- [ ] **Message Actions** (TODO: implement)

  - [ ] Edit message works
  - [ ] Delete message works
  - [ ] Regenerate message works

- [ ] **Auto-Scrolling**

  - [ ] Chat auto-scrolls to bottom
  - [ ] Manual scroll up disables auto-scroll
  - [ ] Scroll to bottom button appears

- [ ] **Loading States**

  - [ ] Streaming indicator shows
  - [ ] Stop button works
  - [ ] Loading doesn't block UI

- [ ] **Error Handling**
  - [ ] Network errors show error message
  - [ ] Backend errors display nicely
  - [ ] Can retry after error

### Integration Testing

- [ ] **Full Flow**

  - [ ] Create new chat
  - [ ] Send multiple messages
  - [ ] Refresh page - messages persist
  - [ ] Delete chat - messages gone
  - [ ] Navigate between chats - messages load correctly

- [ ] **Token Usage** (if implemented)
  - [ ] Token counts update
  - [ ] Displayed in UI
  - [ ] Accurate tracking

### Performance Testing

- [ ] **Long Conversations**

  - [ ] 50+ messages still performant
  - [ ] Scrolling smooth
  - [ ] No memory leaks

- [ ] **Large Messages**
  - [ ] Long code blocks render well
  - [ ] Large tool outputs don't freeze UI
  - [ ] Markdown parsing fast

---

## Future Enhancements

These features are not included in this migration but can be added later:

### Phase 9: Tool Approval Workflow

- Manual approval UI for dangerous tools
- Approval queue display
- Approve/deny buttons
- Policy-based auto-approval

### Phase 10: Advanced Message Features

- Message branching (edit creates fork)
- Message search/filter
- Export conversation
- Share conversation

### Phase 11: Multi-Modal Support

- Image attachments
- File uploads
- Voice input
- Screenshot annotation

### Phase 12: Performance Optimizations

- Virtual scrolling for long chats
- Message pagination
- Lazy loading of tool results
- WebSocket for real-time updates

### Phase 13: Personalization

- Custom system prompts per chat
- Chat templates
- Favorite prompts
- Chat categories/tags

---

## Known Limitations

1. **Tool Approval**: Not implemented - all tools auto-execute
2. **Model Selection**: Hardcoded - needs UI for selection
3. **Message Editing**: Backend endpoint not implemented
4. **Message Deletion**: Backend endpoint not implemented
5. **Token Usage UI**: Data tracked but UI not implemented
6. **Draft Persistence**: Not implemented
7. **Multi-chat Support**: One chat at a time
8. **WebSocket Updates**: Using HTTP streaming only
9. **Syntax Highlighting**: Basic - needs `react-syntax-highlighter` for full support

---

## Environment Setup

### Required Environment Variables

```bash
# .env or .env.local

# OpenAI (for cloud models)
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Ollama (for local models)
OLLAMA_BASE_URL=http://localhost:11434/api

# Database
DATABASE_URL=postgresql://...

# Optional: Other providers
ANTHROPIC_API_KEY=...
GOOGLE_AI_API_KEY=...
```

### Install Dependencies

```bash
# Root
cd platform
pnpm install

# Backend
cd backend
pnpm add ai @ai-sdk/openai ollama-ai-provider

# Frontend
cd frontend
pnpm add ai react-markdown remark-gfm
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Remove hardcoded API keys
- [ ] Add proper authentication
- [ ] Rate limit streaming endpoint
- [ ] Add request validation
- [ ] Configure CORS properly
- [ ] Add monitoring/logging
- [ ] Test with production database
- [ ] Optimize bundle size
- [ ] Add error tracking (Sentry)
- [ ] Document API endpoints

---

## Getting Help

### Common Issues

**Issue: Streaming not working**

- Check backend is running and accessible
- Verify environment variables set
- Check browser console for errors
- Verify `/api/llm/stream` endpoint exists

**Issue: Messages not persisting**

- Check database connection
- Verify sessionId is correct
- Check backend logs for save errors
- Ensure migrations ran

**Issue: UI not updating**

- Check React DevTools for re-renders
- Verify `useChat` hook setup correctly
- Check for console errors
- Ensure AI SDK version compatible

**Issue: Type errors**

- Run `pnpm type-check`
- Regenerate API client: `cd shared && pnpm generate`
- Check AI SDK types installed

### Debug Commands

```bash
# Check backend logs
cd platform/backend
pnpm dev

# Check frontend in browser
# Open DevTools → Network tab → filter "stream"

# Check database
cd platform/backend
pnpm db:studio

# Check types
cd platform
pnpm type-check
```

---

## Conclusion

This migration brings full chat conversation capabilities to the platform. After completion, users will be able to:

✅ Have real-time conversations with LLMs  
✅ See streaming responses with markdown  
✅ View tool invocations and reasoning  
✅ Edit and manage messages  
✅ Use starter prompts  
✅ Track token usage

The implementation follows platform conventions (TanStack Query, Next.js App Router, AI SDK) and provides a solid foundation for future enhancements.

**Estimated Total Time:** ~20 hours

**Ready to start? Begin with Phase 1! 🚀**
