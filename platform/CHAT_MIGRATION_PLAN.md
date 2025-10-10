# Chat Migration Plan: Desktop App → Platform

> **Status:** Planning Complete - Ready for Implementation  
> **Created:** October 10, 2025  
> **Estimated Time:** ~17 hours of development

## Table of Contents

1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [Phase 1: Backend - Database & Models](#phase-1-backend---database--models)
4. [Phase 2: Backend - API Routes](#phase-2-backend---api-routes)
5. [Phase 3: Shared Types](#phase-3-shared-types)
6. [Phase 4: Frontend - Data Layer](#phase-4-frontend---data-layer)
7. [Phase 5: Frontend - UI Components](#phase-5-frontend---ui-components)
8. [Phase 6: Testing & Validation](#phase-6-testing--validation)
9. [File Structure Summary](#file-structure-summary)
10. [Out of Scope](#out-of-scope)
11. [Reference Files](#reference-files)

---

## Overview

This document outlines the migration of chat functionality from the desktop app (Electron + SQLite + Zustand) to the platform (Next.js + PostgreSQL + TanStack Query).

### Goals

✅ Display chat list in sidebar  
✅ Add "New Agent" button functionality  
✅ Create empty chat page with routing  
✅ Implement full backend API for chats  
✅ Set foundation for future chat interface implementation

### What This Migration Includes

- Chat CRUD operations (create, read, update, delete)
- Message storage and retrieval
- Tool selection per chat
- Token usage tracking infrastructure
- Sidebar chat list with inline title editing
- Navigation to individual chat pages

### What This Migration Does NOT Include

❌ Chat message rendering (AI SDK interface)  
❌ Streaming responses  
❌ Tool invocation during chat  
❌ WebSocket real-time updates  
❌ Token usage tracking UI  
❌ Model selection dropdown  
❌ Multi-chat parallel management  
❌ Draft message persistence  
❌ Message editing/deletion UI

These features will be added in future phases.

---

## Architecture Comparison

### Key Differences: Desktop App vs Platform

| Feature               | Desktop App                    | Platform                       |
| --------------------- | ------------------------------ | ------------------------------ |
| **State Management**  | Zustand store with persistence | TanStack Query (no Zustand)    |
| **Database**          | SQLite (integer IDs)           | PostgreSQL (UUID IDs)          |
| **Router**            | TanStack Router                | Next.js App Router             |
| **Data Fetching**     | Direct API calls               | TanStack Query hooks           |
| **Real-time Updates** | WebSocket subscriptions        | (Future: WebSocket or polling) |
| **ID Format**         | `chatId: number`               | `chatId: string` (UUID)        |
| **Backend Framework** | Fastify + Electron IPC         | Fastify (REST)                 |
| **ORM**               | Drizzle + SQLite               | Drizzle + PostgreSQL           |

### Design Decisions

1. **No Zustand**: Platform uses TanStack Query for all data fetching and caching instead of Zustand stores
2. **UUIDs over Integers**: Platform uses UUID primary keys for better distribution and security
3. **Server Components**: Leverage Next.js 15 App Router with Server Components for data prefetching
4. **Agent Association**: Each chat must be associated with an agent (agentId foreign key)

---

## Phase 1: Backend - Database & Models

**Estimated Time:** 6 hours

### Task 1.1: Create Chat Database Schema

**File:** `platform/backend/src/database/schemas/chat.ts`

**Schema Definition:**

```typescript
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import agentsTable from "./agent";

const chatsTable = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentsTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().unique().defaultRandom(),
    title: text("title"),
    selectedTools: jsonb("selected_tools").$type<string[] | null>(),
    totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
    totalCompletionTokens: integer("total_completion_tokens")
      .notNull()
      .default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    lastModel: text("last_model"),
    lastContextWindow: integer("last_context_window"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdIdx: index("chats_agent_id_idx").on(table.agentId),
    createdAtIdx: index("chats_created_at_idx").on(table.createdAt),
  })
);

export default chatsTable;
```

**Key Fields:**

- `id`: Primary key (UUID)
- `agentId`: Foreign key to agents table (required)
- `sessionId`: Unique session identifier for frontend tracking
- `title`: Chat title (nullable, auto-generated after 4 messages)
- `selectedTools`: JSON array of tool IDs, or null to enable all tools
- `totalPromptTokens`, `totalCompletionTokens`, `totalTokens`: Token usage tracking
- `lastModel`, `lastContextWindow`: Last used model info for context tracking

**Reference:** `desktop_app/src/backend/database/schema/chat.ts`

---

### Task 1.2: Create Message Database Schema

**File:** `platform/backend/src/database/schemas/message.ts`

**Schema Definition:**

```typescript
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";
import chatsTable from "./chat";

const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chatsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
    content: jsonb("content").$type<UIMessage>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    chatIdIdx: index("messages_chat_id_idx").on(table.chatId),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  })
);

export default messagesTable;
```

**Key Fields:**

- `id`: Primary key (UUID)
- `chatId`: Foreign key to chats table with cascade delete
- `role`: Message role (user, assistant, system, tool)
- `content`: Full UIMessage object from AI SDK (stored as JSONB)
- `createdAt`: Timestamp for message ordering

**Notes:**

- Messages are automatically deleted when parent chat is deleted (cascade)
- Content stores entire UIMessage structure for maximum flexibility
- Index on chatId for efficient message retrieval

**Reference:** `desktop_app/src/backend/database/schema/messages.ts`

---

### Task 1.3: Export New Schemas

**File:** `platform/backend/src/database/schemas/index.ts`

**Add these exports:**

```typescript
export { default as chatsTable } from "./chat";
export { default as messagesTable } from "./message";
```

---

### Task 1.4: Generate Database Migration

**Commands:**

```bash
cd platform/backend
pnpm db:migrate:dev
```

**What happens:**

1. Drizzle analyzes your schema changes
2. Generates SQL migration files in `src/database/migrations/`
3. Prompts you to name the migration (suggest: "add_chats_and_messages")
4. Applies migration to development database

**Expected Output:**

- New migration file: `src/database/migrations/XXXX_add_chats_and_messages.sql`
- Migration applied to local PostgreSQL database

---

### Task 1.5: Create Chat Model

**File:** `platform/backend/src/models/chat.ts`

**Model Structure:**

```typescript
import { asc, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import db, { schema } from "@/database";
import type { Chat, InsertChat, Message } from "@/types";

interface ChatWithMessages extends Chat {
  messages: Message[];
}

interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  contextWindow?: number;
}

class ChatModel {
  // ============================================
  // Basic CRUD Operations
  // ============================================

  /**
   * Create a new chat associated with an agent
   */
  static async create(data: InsertChat): Promise<Chat> {
    const [chat] = await db.insert(schema.chatsTable).values(data).returning();
    return chat;
  }

  /**
   * Get all chats (without messages) ordered by most recent
   */
  static async findAll(): Promise<Chat[]> {
    return db
      .select()
      .from(schema.chatsTable)
      .orderBy(desc(schema.chatsTable.createdAt));
  }

  /**
   * Find a single chat by ID (without messages)
   */
  static async findById(id: string): Promise<Chat | null> {
    const [chat] = await db
      .select()
      .from(schema.chatsTable)
      .where(eq(schema.chatsTable.id, id));
    return chat || null;
  }

  /**
   * Find a single chat by session ID (without messages)
   */
  static async findBySessionId(sessionId: string): Promise<Chat | null> {
    const [chat] = await db
      .select()
      .from(schema.chatsTable)
      .where(eq(schema.chatsTable.sessionId, sessionId));
    return chat || null;
  }

  /**
   * Get chat with all its messages
   */
  static async findByIdWithMessages(
    id: string
  ): Promise<ChatWithMessages | null> {
    const rows = await db
      .select()
      .from(schema.chatsTable)
      .leftJoin(
        schema.messagesTable,
        eq(schema.chatsTable.id, schema.messagesTable.chatId)
      )
      .where(eq(schema.chatsTable.id, id))
      .orderBy(asc(schema.messagesTable.createdAt));

    if (rows.length === 0 || !rows[0].chats) {
      return null;
    }

    const chat = rows[0].chats;
    const messages: Message[] = rows
      .filter((row) => row.messages !== null)
      .map((row) => row.messages!);

    return {
      ...chat,
      messages,
    };
  }

  /**
   * Update chat properties
   */
  static async update(
    id: string,
    data: Partial<InsertChat>
  ): Promise<Chat | null> {
    const [updatedChat] = await db
      .update(schema.chatsTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.chatsTable.id, id))
      .returning();
    return updatedChat || null;
  }

  /**
   * Delete a chat (cascades to messages)
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.chatsTable)
      .where(eq(schema.chatsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================
  // Tool Management
  // ============================================

  /**
   * Get selected tools for a chat
   * @returns Array of tool IDs, or null if all tools are selected
   */
  static async getSelectedTools(chatId: string): Promise<string[] | null> {
    const chat = await this.findById(chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${chatId}`);
    }
    return chat.selectedTools as string[] | null;
  }

  /**
   * Update selected tools for a chat
   * @param toolIds Array of tool IDs, or null to select all tools
   */
  static async updateSelectedTools(
    chatId: string,
    toolIds: string[] | null
  ): Promise<void> {
    await this.update(chatId, { selectedTools: toolIds });
  }

  /**
   * Add tools to the chat's selection
   */
  static async addSelectedTools(
    chatId: string,
    toolIds: string[]
  ): Promise<string[]> {
    const currentTools = await this.getSelectedTools(chatId);

    let updatedTools: string[];

    if (currentTools === null) {
      // When null (all tools selected), convert to explicit list
      // Note: You'll need to get all available tools from tool service
      // For now, just return the new toolIds
      updatedTools = toolIds;
    } else {
      // Add new tools to existing selection, avoiding duplicates
      const toolSet = new Set([...currentTools, ...toolIds]);
      updatedTools = Array.from(toolSet);
    }

    await this.updateSelectedTools(chatId, updatedTools);
    return updatedTools;
  }

  /**
   * Remove tools from the chat's selection
   */
  static async removeSelectedTools(
    chatId: string,
    toolIds: string[]
  ): Promise<string[]> {
    const currentTools = await this.getSelectedTools(chatId);

    let updatedTools: string[];

    if (currentTools === null) {
      // When null (all tools selected), we can't remove specific tools
      // Would need to convert to explicit list first
      // For now, return empty array or throw error
      throw new Error(
        "Cannot remove specific tools when all tools are selected"
      );
    } else {
      // Remove specified tools from existing selection
      const toolSet = new Set(currentTools);
      for (const toolId of toolIds) {
        toolSet.delete(toolId);
      }
      updatedTools = Array.from(toolSet);
    }

    await this.updateSelectedTools(chatId, updatedTools);
    return updatedTools;
  }

  /**
   * Select all available tools for a chat (sets selectedTools to null)
   */
  static async selectAllTools(chatId: string): Promise<void> {
    await this.updateSelectedTools(chatId, null);
  }

  /**
   * Deselect all tools for a chat (sets selectedTools to empty array)
   */
  static async deselectAllTools(chatId: string): Promise<void> {
    await this.updateSelectedTools(chatId, []);
  }

  // ============================================
  // Token Usage Tracking
  // ============================================

  /**
   * Update token usage for a chat
   * @param sessionId The chat session ID
   * @param usage Token usage data (cumulative values)
   */
  static async updateTokenUsage(
    sessionId: string,
    usage: TokenUsage
  ): Promise<void> {
    const chat = await this.findBySessionId(sessionId);
    if (!chat) {
      throw new Error(`Chat not found for session ID: ${sessionId}`);
    }

    await this.update(chat.id, {
      totalPromptTokens: usage.promptTokens || 0,
      totalCompletionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0,
      lastModel: usage.model,
      lastContextWindow: usage.contextWindow,
    });
  }

  /**
   * Reset token usage counters for a chat
   */
  static async resetTokenUsage(sessionId: string): Promise<void> {
    const chat = await this.findBySessionId(sessionId);
    if (!chat) {
      throw new Error(`Chat not found for session ID: ${sessionId}`);
    }

    await this.update(chat.id, {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      lastModel: null,
      lastContextWindow: null,
    });
  }

  // ============================================
  // Message Operations
  // ============================================

  /**
   * Save multiple messages to a chat (replaces all existing messages)
   */
  static async saveMessages(
    sessionId: string,
    messages: UIMessage[]
  ): Promise<void> {
    const chat = await this.findBySessionId(sessionId);
    if (!chat) {
      throw new Error(`Chat not found for session ID: ${sessionId}`);
    }

    // Delete existing messages
    await db
      .delete(schema.messagesTable)
      .where(eq(schema.messagesTable.chatId, chat.id));

    // Insert new messages
    if (messages.length > 0) {
      const now = Date.now();
      const messageValues = messages.map((message, index) => ({
        chatId: chat.id,
        role: message.role,
        content: message as any, // UIMessage type
        createdAt: new Date(now + index), // Preserve order with millisecond offsets
      }));

      await db.insert(schema.messagesTable).values(messageValues);
    }

    // TODO: Implement auto-title generation after 4 messages
    // await this.conditionallyGenerateTitle(chat.id, chat.title, messages);
  }

  /**
   * Auto-generate chat title based on first few messages
   * TODO: Implement with LLM call
   */
  static async conditionallyGenerateTitle(
    chatId: string,
    currentTitle: string | null,
    messages: UIMessage[]
  ): Promise<void> {
    // Only generate if no title exists and we have enough messages
    const relevantMessages = messages.filter(
      (msg) => msg.role === "user" || msg.role === "assistant"
    );

    if (currentTitle || relevantMessages.length < 4) {
      return;
    }

    // TODO: Call LLM to generate title based on first few messages
    // const title = await generateTitle(relevantMessages.slice(0, 4));
    // await this.update(chatId, { title });
  }
}

export default ChatModel;
```

**Key Methods:**

- `create()`: Create new chat with agent association
- `findAll()`: Get all chats ordered by most recent
- `findById()`: Get single chat
- `findByIdWithMessages()`: Get chat with all messages
- `update()`: Update chat properties
- `delete()`: Delete chat (cascades to messages)
- `getSelectedTools()`: Get tools enabled for this chat
- `updateSelectedTools()`: Update tool selection
- `updateTokenUsage()`: Track token consumption
- `saveMessages()`: Replace all chat messages

**Reference:** `desktop_app/src/backend/models/chat/index.ts`

---

### Task 1.6: Create Chat Model Tests

**File:** `platform/backend/src/models/chat.test.ts`

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import ChatModel from "./chat";
import AgentModel from "./agent";

describe("ChatModel", () => {
  let testAgentId: string;

  beforeEach(async () => {
    // Create a test agent for chat association
    const agent = await AgentModel.create({ name: "Test Agent" });
    testAgentId = agent.id;
  });

  describe("CRUD operations", () => {
    it("should create a new chat", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      expect(chat).toBeDefined();
      expect(chat.id).toBeDefined();
      expect(chat.sessionId).toBeDefined();
      expect(chat.agentId).toBe(testAgentId);
      expect(chat.title).toBeNull();
      expect(chat.totalTokens).toBe(0);
    });

    it("should find chat by id", async () => {
      const created = await ChatModel.create({ agentId: testAgentId });
      const found = await ChatModel.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it("should find chat by session id", async () => {
      const created = await ChatModel.create({ agentId: testAgentId });
      const found = await ChatModel.findBySessionId(created.sessionId);

      expect(found).toBeDefined();
      expect(found?.sessionId).toBe(created.sessionId);
    });

    it("should update chat title", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      const updated = await ChatModel.update(chat.id, { title: "Test Title" });

      expect(updated?.title).toBe("Test Title");
    });

    it("should delete chat", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      const deleted = await ChatModel.delete(chat.id);

      expect(deleted).toBe(true);

      const found = await ChatModel.findById(chat.id);
      expect(found).toBeNull();
    });

    it("should return null for non-existent chat", async () => {
      const found = await ChatModel.findById(
        "00000000-0000-0000-0000-000000000000"
      );
      expect(found).toBeNull();
    });
  });

  describe("Tool management", () => {
    it("should get selected tools (null by default)", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      const tools = await ChatModel.getSelectedTools(chat.id);

      expect(tools).toBeNull(); // null means all tools selected
    });

    it("should update selected tools", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      await ChatModel.updateSelectedTools(chat.id, ["tool1", "tool2"]);

      const tools = await ChatModel.getSelectedTools(chat.id);
      expect(tools).toEqual(["tool1", "tool2"]);
    });

    it("should add tools to selection", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      await ChatModel.updateSelectedTools(chat.id, ["tool1"]);

      const updated = await ChatModel.addSelectedTools(chat.id, [
        "tool2",
        "tool3",
      ]);
      expect(updated).toContain("tool1");
      expect(updated).toContain("tool2");
      expect(updated).toContain("tool3");
    });

    it("should select all tools", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      await ChatModel.updateSelectedTools(chat.id, ["tool1"]);
      await ChatModel.selectAllTools(chat.id);

      const tools = await ChatModel.getSelectedTools(chat.id);
      expect(tools).toBeNull();
    });

    it("should deselect all tools", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });
      await ChatModel.deselectAllTools(chat.id);

      const tools = await ChatModel.getSelectedTools(chat.id);
      expect(tools).toEqual([]);
    });
  });

  describe("Token usage tracking", () => {
    it("should update token usage", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      await ChatModel.updateTokenUsage(chat.sessionId, {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        model: "gpt-4",
        contextWindow: 8192,
      });

      const updated = await ChatModel.findById(chat.id);
      expect(updated?.totalPromptTokens).toBe(100);
      expect(updated?.totalCompletionTokens).toBe(50);
      expect(updated?.totalTokens).toBe(150);
      expect(updated?.lastModel).toBe("gpt-4");
      expect(updated?.lastContextWindow).toBe(8192);
    });

    it("should reset token usage", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      await ChatModel.updateTokenUsage(chat.sessionId, {
        totalTokens: 150,
      });

      await ChatModel.resetTokenUsage(chat.sessionId);

      const updated = await ChatModel.findById(chat.id);
      expect(updated?.totalTokens).toBe(0);
    });
  });

  describe("Messages", () => {
    it("should save messages to chat", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      const messages = [
        { id: "msg1", role: "user", content: "Hello", parts: [] },
        { id: "msg2", role: "assistant", content: "Hi there!", parts: [] },
      ] as any[];

      await ChatModel.saveMessages(chat.sessionId, messages);

      const withMessages = await ChatModel.findByIdWithMessages(chat.id);
      expect(withMessages?.messages).toHaveLength(2);
      expect(withMessages?.messages[0].role).toBe("user");
    });

    it("should replace existing messages", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      await ChatModel.saveMessages(chat.sessionId, [
        { id: "msg1", role: "user", content: "First", parts: [] },
      ] as any[]);

      await ChatModel.saveMessages(chat.sessionId, [
        { id: "msg2", role: "user", content: "Second", parts: [] },
      ] as any[]);

      const withMessages = await ChatModel.findByIdWithMessages(chat.id);
      expect(withMessages?.messages).toHaveLength(1);
    });
  });
});
```

**Test Coverage:**

- ✅ CRUD operations
- ✅ Tool management (select, deselect, add, remove)
- ✅ Token usage tracking
- ✅ Message operations
- ✅ Edge cases (not found, null values)

---

### Task 1.7: Create Message Model

**File:** `platform/backend/src/models/message.ts`

**Model Structure:**

```typescript
import { eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import db, { schema } from "@/database";
import type { Message, InsertMessage } from "@/types";

class MessageModel {
  /**
   * Create a new message
   */
  static async create(data: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(schema.messagesTable)
      .values(data)
      .returning();
    return message;
  }

  /**
   * Get all messages for a chat
   */
  static async findByChatId(chatId: string): Promise<Message[]> {
    return db
      .select()
      .from(schema.messagesTable)
      .where(eq(schema.messagesTable.chatId, chatId))
      .orderBy(schema.messagesTable.createdAt);
  }

  /**
   * Update message content
   */
  static async update(id: string, content: UIMessage): Promise<Message | null> {
    const [updated] = await db
      .update(schema.messagesTable)
      .set({ content: content as any })
      .where(eq(schema.messagesTable.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Delete a message
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.messagesTable)
      .where(eq(schema.messagesTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export default MessageModel;
```

---

### Task 1.8: Export New Models

**File:** `platform/backend/src/models/index.ts`

**Add exports:**

```typescript
export { default as ChatModel } from "./chat";
export { default as MessageModel } from "./message";
```

---

### Task 1.9: Update TypeScript Types

**File:** `platform/backend/src/types/database.ts` (or create if doesn't exist)

**Add types:**

```typescript
import type { UIMessage } from "ai";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { chatsTable, messagesTable } from "@/database/schemas";

// Chat types
export type Chat = InferSelectModel<typeof chatsTable>;
export type InsertChat = InferInsertModel<typeof chatsTable>;

// Message types
export type Message = InferSelectModel<typeof messagesTable>;
export type InsertMessage = InferInsertModel<typeof messagesTable>;

// Extended types
export interface ChatWithMessages extends Chat {
  messages: Message[];
}
```

---

## Phase 2: Backend - API Routes

**Estimated Time:** 3 hours

### Task 2.1: Create Chat Routes

**File:** `platform/backend/src/routes/chat.ts`

**Route Structure:**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import ChatModel from "@/models/chat";
import MessageModel from "@/models/message";

export default async function chatRoutes(fastify: FastifyInstance) {
  // ============================================
  // Chat CRUD Endpoints
  // ============================================

  /**
   * GET /api/chats
   * Get all chats (without messages)
   */
  fastify.get(
    "/api/chats",
    {
      schema: {
        tags: ["Chat"],
        description: "Get all chats",
        response: {
          200: z.array(z.any()), // TODO: Add proper response schema
        },
      },
    },
    async (request, reply) => {
      const chats = await ChatModel.findAll();
      return reply.send(chats);
    }
  );

  /**
   * GET /api/chats/:id
   * Get single chat with messages
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/api/chats/:id",
    {
      schema: {
        tags: ["Chat"],
        description: "Get single chat with messages",
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.any(), // TODO: Add proper response schema
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const chat = await ChatModel.findByIdWithMessages(id);

      if (!chat) {
        return reply.code(404).send({ error: "Chat not found" });
      }

      return reply.send(chat);
    }
  );

  /**
   * POST /api/chats
   * Create new chat
   */
  fastify.post<{
    Body: { agentId: string };
  }>(
    "/api/chats",
    {
      schema: {
        tags: ["Chat"],
        description: "Create new chat",
        body: z.object({
          agentId: z.string().uuid(),
        }),
        response: {
          201: z.any(), // TODO: Add proper response schema
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.body;
      const chat = await ChatModel.create({ agentId });
      return reply.code(201).send(chat);
    }
  );

  /**
   * PATCH /api/chats/:id
   * Update chat (title, etc.)
   */
  fastify.patch<{
    Params: { id: string };
    Body: { title?: string | null };
  }>(
    "/api/chats/:id",
    {
      schema: {
        tags: ["Chat"],
        description: "Update chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          title: z.string().nullable().optional(),
        }),
        response: {
          200: z.any(), // TODO: Add proper response schema
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const chat = await ChatModel.update(id, updates);

      if (!chat) {
        return reply.code(404).send({ error: "Chat not found" });
      }

      return reply.send(chat);
    }
  );

  /**
   * DELETE /api/chats/:id
   * Delete chat
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    "/api/chats/:id",
    {
      schema: {
        tags: ["Chat"],
        description: "Delete chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const deleted = await ChatModel.delete(id);

      if (!deleted) {
        return reply.code(404).send({ error: "Chat not found" });
      }

      return reply.code(204).send();
    }
  );

  // ============================================
  // Tool Management Endpoints
  // ============================================

  /**
   * GET /api/chats/:id/tools
   * Get selected tools for a chat
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/api/chats/:id/tools",
    {
      schema: {
        tags: ["Chat"],
        description: "Get selected tools for this chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()).nullable(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const selectedTools = await ChatModel.getSelectedTools(id);
        return reply.send({ selectedTools });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  /**
   * PUT /api/chats/:id/tools
   * Update selected tools for a chat
   */
  fastify.put<{
    Params: { id: string };
    Body: { toolIds: string[] | null };
  }>(
    "/api/chats/:id/tools",
    {
      schema: {
        tags: ["Chat"],
        description: "Update selected tools for this chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          toolIds: z.array(z.string()).nullable(),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()).nullable(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { toolIds } = request.body;

      try {
        await ChatModel.updateSelectedTools(id, toolIds);
        const selectedTools = await ChatModel.getSelectedTools(id);
        return reply.send({ selectedTools });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  /**
   * POST /api/chats/:id/tools/select
   * Add tools to chat selection
   */
  fastify.post<{
    Params: { id: string };
    Body: { toolIds: string[] };
  }>(
    "/api/chats/:id/tools/select",
    {
      schema: {
        tags: ["Chat"],
        description: "Add tools to chat selection",
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          toolIds: z.array(z.string()),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { toolIds } = request.body;

      try {
        const selectedTools = await ChatModel.addSelectedTools(id, toolIds);
        return reply.send({ selectedTools });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  /**
   * POST /api/chats/:id/tools/deselect
   * Remove tools from chat selection
   */
  fastify.post<{
    Params: { id: string };
    Body: { toolIds: string[] };
  }>(
    "/api/chats/:id/tools/deselect",
    {
      schema: {
        tags: ["Chat"],
        description: "Remove tools from chat selection",
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          toolIds: z.array(z.string()),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()),
          }),
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { toolIds } = request.body;

      try {
        const selectedTools = await ChatModel.removeSelectedTools(id, toolIds);
        return reply.send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot remove")) {
          return reply.code(400).send({ error: error.message });
        }
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  /**
   * POST /api/chats/:id/tools/select-all
   * Select all tools for this chat
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/api/chats/:id/tools/select-all",
    {
      schema: {
        tags: ["Chat"],
        description: "Select all tools for this chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await ChatModel.selectAllTools(id);
        return reply.send({ message: "All tools selected" });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  /**
   * POST /api/chats/:id/tools/deselect-all
   * Deselect all tools for this chat
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/api/chats/:id/tools/deselect-all",
    {
      schema: {
        tags: ["Chat"],
        description: "Deselect all tools for this chat",
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await ChatModel.deselectAllTools(id);
        return reply.send({ message: "All tools deselected" });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );

  // ============================================
  // Token Usage Endpoints
  // ============================================

  /**
   * POST /api/chats/:sessionId/reset-tokens
   * Reset token usage counters
   */
  fastify.post<{
    Params: { sessionId: string };
  }>(
    "/api/chats/:sessionId/reset-tokens",
    {
      schema: {
        tags: ["Chat"],
        description: "Reset token usage counters for a chat",
        params: z.object({
          sessionId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        await ChatModel.resetTokenUsage(sessionId);
        return reply.send({ message: "Token usage reset successfully" });
      } catch (error) {
        return reply.code(404).send({ error: "Chat not found" });
      }
    }
  );
}
```

**API Endpoints Summary:**

| Method | Endpoint                             | Description                   |
| ------ | ------------------------------------ | ----------------------------- |
| GET    | `/api/chats`                         | Get all chats                 |
| GET    | `/api/chats/:id`                     | Get single chat with messages |
| POST   | `/api/chats`                         | Create new chat               |
| PATCH  | `/api/chats/:id`                     | Update chat                   |
| DELETE | `/api/chats/:id`                     | Delete chat                   |
| GET    | `/api/chats/:id/tools`               | Get selected tools            |
| PUT    | `/api/chats/:id/tools`               | Update selected tools         |
| POST   | `/api/chats/:id/tools/select`        | Add tools to selection        |
| POST   | `/api/chats/:id/tools/deselect`      | Remove tools from selection   |
| POST   | `/api/chats/:id/tools/select-all`    | Select all tools              |
| POST   | `/api/chats/:id/tools/deselect-all`  | Deselect all tools            |
| POST   | `/api/chats/:sessionId/reset-tokens` | Reset token counters          |

**Reference:** `desktop_app/src/backend/server/plugins/chat/index.ts`

---

### Task 2.2: Register Chat Routes

**File:** `platform/backend/src/routes/index.ts`

**Add registration:**

```typescript
import chatRoutes from "./chat";

export default async function routes(fastify: FastifyInstance) {
  // ... existing routes ...

  // Register chat routes
  await fastify.register(chatRoutes);
}
```

---

### Task 2.3: Update OpenAPI Types

**Commands:**

```bash
cd platform/shared
pnpm generate
```

**What happens:**

- Reads OpenAPI spec from running backend
- Generates TypeScript types in `shared/api-client/`
- Creates type-safe API client for frontend

**Note:** Backend must be running for this to work.

---

## Phase 3: Shared Types

**Estimated Time:** 1 hour

### Task 3.1: Create Chat Types

**File:** `platform/shared/types/chat.types.ts` (new file)

**Type Definitions:**

```typescript
import type { UIMessage } from "ai";

/**
 * Core chat entity
 */
export interface Chat {
  id: string;
  agentId: string;
  sessionId: string;
  title?: string | null;
  selectedTools?: string[] | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  lastModel?: string | null;
  lastContextWindow?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message entity
 */
export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: UIMessage;
  createdAt: Date;
}

/**
 * Chat with all messages
 */
export interface ChatWithMessages extends Chat {
  messages: Message[];
}

/**
 * Create chat request
 */
export interface CreateChatRequest {
  agentId: string;
}

/**
 * Update chat request
 */
export interface UpdateChatRequest {
  title?: string | null;
}

/**
 * Tool selection update request
 */
export interface UpdateToolsRequest {
  toolIds: string[] | null;
}

/**
 * Token usage data
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  contextWindow?: number;
}
```

---

### Task 3.2: Export Shared Types

**File:** `platform/shared/index.ts`

**Add exports:**

```typescript
export * from "./types/chat.types";
```

---

## Phase 4: Frontend - Data Layer

**Estimated Time:** 2 hours

### Task 4.1: Create Chat Query Hooks

**File:** `platform/frontend/src/lib/chat.query.ts` (new file)

**Query Hook Definitions:**

```typescript
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@shared/api-client";
import type {
  Chat,
  ChatWithMessages,
  CreateChatRequest,
  UpdateChatRequest,
} from "@shared/types/chat.types";

// ============================================
// Query Keys
// ============================================

export const chatKeys = {
  all: ["chats"] as const,
  lists: () => [...chatKeys.all, "list"] as const,
  list: () => [...chatKeys.lists()] as const,
  details: () => [...chatKeys.all, "detail"] as const,
  detail: (id: string) => [...chatKeys.details(), id] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Get all chats
 * Uses Suspense - wrap in Suspense boundary
 */
export function useChats() {
  return useSuspenseQuery({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      const response = await apiClient.GET("/api/chats");
      if (response.error) {
        throw new Error("Failed to fetch chats");
      }
      return response.data as Chat[];
    },
  });
}

/**
 * Get single chat with messages
 * Uses Suspense - wrap in Suspense boundary
 */
export function useChat(chatId: string) {
  return useSuspenseQuery({
    queryKey: chatKeys.detail(chatId),
    queryFn: async () => {
      const response = await apiClient.GET("/api/chats/{id}", {
        params: { path: { id: chatId } },
      });
      if (response.error) {
        throw new Error("Failed to fetch chat");
      }
      return response.data as ChatWithMessages;
    },
  });
}

/**
 * Get all chats without Suspense (for optional data)
 */
export function useChatsOptional() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      const response = await apiClient.GET("/api/chats");
      if (response.error) {
        throw new Error("Failed to fetch chats");
      }
      return response.data as Chat[];
    },
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create new chat
 */
export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChatRequest) => {
      const response = await apiClient.POST("/api/chats", {
        body: data as any,
      });
      if (response.error) {
        throw new Error("Failed to create chat");
      }
      return response.data as Chat;
    },
    onSuccess: () => {
      // Invalidate chat list to refetch
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/**
 * Update chat (title, etc.)
 */
export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateChatRequest;
    }) => {
      const response = await apiClient.PATCH("/api/chats/{id}", {
        params: { path: { id } },
        body: data as any,
      });
      if (response.error) {
        throw new Error("Failed to update chat");
      }
      return response.data as Chat;
    },
    onSuccess: (_, { id }) => {
      // Invalidate both list and detail
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(id) });
    },
  });
}

/**
 * Delete chat
 */
export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.DELETE("/api/chats/{id}", {
        params: { path: { id } },
      });
      if (response.error) {
        throw new Error("Failed to delete chat");
      }
    },
    onSuccess: () => {
      // Invalidate chat list to refetch
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/**
 * Update selected tools
 */
export function useUpdateChatTools() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatId,
      toolIds,
    }: {
      chatId: string;
      toolIds: string[] | null;
    }) => {
      const response = await apiClient.PUT("/api/chats/{id}/tools", {
        params: { path: { id: chatId } },
        body: { toolIds } as any,
      });
      if (response.error) {
        throw new Error("Failed to update tools");
      }
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}
```

**Key Features:**

- Uses `useSuspenseQuery` for automatic loading states
- Uses `useMutation` for create/update/delete operations
- Automatic cache invalidation after mutations
- Type-safe API calls using generated client
- Query key factory pattern for efficient cache management

**Important:** Do NOT use Zustand. The desktop app uses it, but platform uses TanStack Query exclusively.

---

### Task 4.2: Create Chat Utilities

**File:** `platform/frontend/src/lib/chat.utils.ts` (new file)

**Utility Functions:**

```typescript
import type { Chat } from "@shared/types/chat.types";

/**
 * Get display title for a chat
 */
export function getChatDisplayTitle(chat: Chat | null): string {
  if (!chat) return "Chat";
  return chat.title || "New Chat";
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Calculate context usage percentage
 */
export function calculateContextUsage(chat: Chat): number {
  if (!chat.lastContextWindow || !chat.totalTokens) return 0;
  return (chat.totalTokens / chat.lastContextWindow) * 100;
}

/**
 * Sort chats by most recent first
 */
export function sortChatsByRecent(chats: Chat[]): Chat[] {
  return [...chats].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
```

---

## Phase 5: Frontend - UI Components

**Estimated Time:** 4 hours

### Task 5.1: Update Sidebar with Chat Section

**File:** `platform/frontend/src/app/_parts/sidebar.tsx`

**Add after "Security Sub-agents" section:**

```typescript
import { Suspense } from "react";
import { ChatList } from "./chat-list";
import { NewAgentButton } from "./new-agent-button";

// ... existing code ...

// Add this new section before the "Community" section:

<SidebarGroup>
  <SidebarGroupLabel className="flex items-center justify-between">
    <span>Chats</span>
    <NewAgentButton />
  </SidebarGroupLabel>
  <SidebarGroupContent>
    <Suspense fallback={<ChatListSkeleton />}>
      <ChatList />
    </Suspense>
  </SidebarGroupContent>
</SidebarGroup>;

// Also add the skeleton component
function ChatListSkeleton() {
  return (
    <SidebarMenuSub>
      {[1, 2, 3].map((i) => (
        <SidebarMenuSubItem key={i}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
            <div className="h-3 flex-1 bg-muted animate-pulse rounded" />
          </div>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}
```

---

### Task 5.2: Create NewAgentButton Component

**File:** `platform/frontend/src/app/_parts/new-agent-button.tsx` (new file)

**Component:**

```typescript
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCreateChat } from "@/lib/chat.query";
import { toast } from "sonner";

export function NewAgentButton() {
  const router = useRouter();
  const createChat = useCreateChat();

  const handleNewChat = async () => {
    try {
      // TODO: Get default agent ID from settings or context
      // For now, hardcode or get first agent
      const result = await createChat.mutateAsync({
        agentId: "default-agent-id", // TODO: Replace with actual agent ID
      });

      toast.success("New chat created");
      router.push(`/chat/${result.id}`);
    } catch (error) {
      toast.error("Failed to create chat");
      console.error("Failed to create chat:", error);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 w-6 p-0"
      onClick={handleNewChat}
      disabled={createChat.isPending}
      title="New chat"
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
```

**Note:** You'll need to update the `agentId` logic to get the actual default agent or selected agent.

---

### Task 5.3: Create ChatList Component

**File:** `platform/frontend/src/app/_parts/chat-list.tsx` (new file)

**Component:**

```typescript
"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useChats, useDeleteChat, useUpdateChat } from "@/lib/chat.query";
import { getChatDisplayTitle, sortChatsByRecent } from "@/lib/chat.utils";
import { toast } from "sonner";

const VISIBLE_CHAT_COUNT = 5;

export function ChatList() {
  const { data: chatsData } = useChats();
  const deleteChat = useDeleteChat();
  const updateChat = useUpdateChat();
  const router = useRouter();
  const pathname = usePathname();
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const chats = sortChatsByRecent(chatsData || []);
  const visibleChats = showAll ? chats : chats.slice(0, VISIBLE_CHAT_COUNT);
  const hiddenCount = Math.max(0, chats.length - VISIBLE_CHAT_COUNT);

  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const handleDelete = async (chatId: string) => {
    try {
      await deleteChat.mutateAsync(chatId);
      toast.success("Chat deleted");

      // If we're on this chat's page, navigate to home
      if (pathname === `/chat/${chatId}`) {
        router.push("/");
      }
    } catch (error) {
      toast.error("Failed to delete chat");
      console.error("Failed to delete chat:", error);
    }
  };

  const handleStartEdit = (chatId: string, currentTitle: string | null) => {
    setEditingId(chatId);
    setEditValue(currentTitle || "");
  };

  const handleSaveEdit = async (chatId: string) => {
    try {
      await updateChat.mutateAsync({
        id: chatId,
        data: { title: editValue.trim() || null },
      });
      setEditingId(null);
      toast.success("Chat title updated");
    } catch (error) {
      toast.error("Failed to update title");
      console.error("Failed to update title:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  if (chats.length === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No chats yet
          </div>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
  }

  return (
    <SidebarMenuSub>
      {visibleChats.map((chat) => {
        const isActive = pathname === `/chat/${chat.id}`;
        const isEditing = editingId === chat.id;

        return (
          <SidebarMenuSubItem key={chat.id} className="group/chat-item">
            <div className="flex items-center w-full gap-1">
              <SidebarMenuSubButton
                onClick={() => handleChatClick(chat.id)}
                isActive={isActive}
                className="flex-1 cursor-pointer"
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleSaveEdit(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(chat.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-xs"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="truncate text-xs"
                    onDoubleClick={() =>
                      handleStartEdit(chat.id, chat.title || null)
                    }
                    title={getChatDisplayTitle(chat)}
                  >
                    {getChatDisplayTitle(chat)}
                  </span>
                )}
              </SidebarMenuSubButton>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover/chat-item:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the chat and all its messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(chat.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SidebarMenuSubItem>
        );
      })}

      {hiddenCount > 0 && (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            onClick={() => setShowAll(!showAll)}
            className="cursor-pointer text-xs text-muted-foreground"
          >
            {showAll ? (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>Show {hiddenCount} more</span>
              </>
            )}
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )}
    </SidebarMenuSub>
  );
}
```

**Features:**

- ✅ List of chats sorted by most recent
- ✅ Active chat highlighting
- ✅ Inline title editing (double-click)
- ✅ Delete button with confirmation dialog
- ✅ Show more/less toggle for > 5 chats
- ✅ Empty state
- ✅ Loading handled by Suspense boundary

**Reference:** `desktop_app/src/ui/components/Sidebar/ChatSidebarSection/index.tsx`

---

### Task 5.4: Add Alert Dialog Component (if missing)

**Check if exists:** `platform/frontend/src/components/ui/alert-dialog.tsx`

**If missing, add it:**

```bash
cd platform/frontend
npx shadcn@latest add alert-dialog
```

---

### Task 5.5: Create Chat Page

**File:** `platform/frontend/src/app/chat/[id]/page.tsx` (new file)

**Server Component with Prefetching:**

```typescript
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { ChatView } from "./chat-view";
import { chatKeys } from "@/lib/chat.query";
import { apiClient } from "@shared/api-client";

export default async function ChatPage({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();

  // Prefetch chat data on server
  await queryClient.prefetchQuery({
    queryKey: chatKeys.detail(params.id),
    queryFn: async () => {
      const response = await apiClient.GET("/api/chats/{id}", {
        params: { path: { id: params.id } },
      });
      if (response.error) {
        throw new Error("Failed to fetch chat");
      }
      return response.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ChatLoadingSkeleton />}>
        <ChatView chatId={params.id} />
      </Suspense>
    </HydrationBoundary>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );
}
```

---

### Task 5.6: Create Chat View Component

**File:** `platform/frontend/src/app/chat/[id]/chat-view.tsx` (new file)

**Client Component:**

```typescript
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
```

---

### Task 5.7: Create Loading State

**File:** `platform/frontend/src/app/chat/[id]/loading.tsx` (new file)

```typescript
export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );
}
```

---

### Task 5.8: Create Error Boundary

**File:** `platform/frontend/src/app/chat/[id]/error.tsx` (new file)

```typescript
"use client";

import { Button } from "@/components/ui/button";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

---

## Phase 6: Testing & Validation

**Estimated Time:** 2 hours

### Task 6.1: Type Checking

**Command:**

```bash
cd platform
pnpm type-check
```

**Expected:** No TypeScript errors

**If errors:** Fix type issues before proceeding.

---

### Task 6.2: Linting

**Command:**

```bash
cd platform
pnpm lint
```

**Expected:** No linting errors

**If errors:** Run `pnpm lint --fix` or fix manually.

---

### Task 6.3: Backend Tests

**Command:**

```bash
cd platform/backend
pnpm test
```

**Expected:** All tests pass, including new chat model tests.

**If failures:** Debug and fix failing tests.

---

### Task 6.4: Start Development Environment

**Command:**

```bash
cd platform
tilt up
```

**Expected:**

- Backend starts on port 3001
- Frontend starts on port 3000
- Database migrations applied
- All services healthy in Tilt UI

**Check Tilt UI:** http://localhost:10350/

---

### Task 6.5: Manual Testing Checklist

**Test Plan:**

1. **View Chat List**

   - [ ] Navigate to http://localhost:3000
   - [ ] Sidebar shows "Chats" section
   - [ ] If no chats exist, shows "No chats yet"

2. **Create New Chat**

   - [ ] Click "+" button in Chats section
   - [ ] New chat is created
   - [ ] Redirects to `/chat/[id]` page
   - [ ] Chat appears in sidebar

3. **View Chat Page**

   - [ ] Empty chat interface displays
   - [ ] Chat title shows "New Chat" or generated title
   - [ ] Page loads without errors

4. **Edit Chat Title**

   - [ ] Double-click chat name in sidebar
   - [ ] Enter new title
   - [ ] Press Enter or click outside
   - [ ] Title updates in sidebar and chat page

5. **Delete Chat**

   - [ ] Click delete button (trash icon) in sidebar
   - [ ] Confirmation dialog appears
   - [ ] Click "Delete"
   - [ ] Chat removed from sidebar
   - [ ] If viewing deleted chat, redirects to home

6. **Multiple Chats**

   - [ ] Create 6+ chats
   - [ ] Only first 5 visible
   - [ ] "Show N more" button appears
   - [ ] Click to show all chats
   - [ ] Click to collapse back to 5

7. **Active Chat Highlighting**

   - [ ] Click different chats in sidebar
   - [ ] Active chat has highlighted background
   - [ ] URL updates to `/chat/[id]`

8. **Loading States**

   - [ ] Slow down network in DevTools
   - [ ] Observe loading skeletons
   - [ ] Confirm no flash of incorrect content

9. **Error Handling**

   - [ ] Stop backend server
   - [ ] Try to create chat
   - [ ] Error toast appears
   - [ ] Try to view chat
   - [ ] Error boundary displays

10. **Type Safety**
    - [ ] Hover over variables in IDE
    - [ ] Confirm types are correct
    - [ ] No TypeScript errors in IDE

---

## File Structure Summary

### New Files Created

```
platform/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── schemas/
│   │   │       ├── chat.ts                    ✨ NEW
│   │   │       └── message.ts                 ✨ NEW
│   │   ├── models/
│   │   │   ├── chat.ts                        ✨ NEW
│   │   │   ├── chat.test.ts                   ✨ NEW
│   │   │   └── message.ts                     ✨ NEW
│   │   └── routes/
│   │       └── chat.ts                        ✨ NEW
│   └── [migrations auto-generated]
│
├── shared/
│   └── types/
│       └── chat.types.ts                      ✨ NEW
│
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── chat.query.ts                  ✨ NEW
    │   │   └── chat.utils.ts                  ✨ NEW
    │   └── app/
    │       ├── _parts/
    │       │   ├── chat-list.tsx              ✨ NEW
    │       │   └── new-agent-button.tsx       ✨ NEW
    │       └── chat/
    │           └── [id]/
    │               ├── page.tsx               ✨ NEW
    │               ├── chat-view.tsx          ✨ NEW
    │               ├── loading.tsx            ✨ NEW
    │               └── error.tsx              ✨ NEW
```

### Files Modified

```
platform/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── schemas/
│   │   │       └── index.ts                   🔧 MODIFIED (add exports)
│   │   ├── models/
│   │   │   └── index.ts                       🔧 MODIFIED (add exports)
│   │   ├── routes/
│   │   │   └── index.ts                       🔧 MODIFIED (register routes)
│   │   └── types/
│   │       └── database.ts                    🔧 MODIFIED (add types)
│
├── shared/
│   ├── index.ts                               🔧 MODIFIED (export types)
│   └── api-client/                            🔧 AUTO-GENERATED
│
└── frontend/
    └── src/
        └── app/
            └── _parts/
                └── sidebar.tsx                🔧 MODIFIED (add chat section)
```

---

## Out of Scope

The following features exist in the desktop app but are **NOT** included in this migration phase:

### Not Implementing Now

1. **Chat Message Interface**

   - Message rendering (user/assistant bubbles)
   - Streaming responses
   - Tool invocation display
   - Code syntax highlighting
   - Markdown rendering

2. **WebSocket Real-time Updates**

   - Live title generation
   - Token usage updates
   - Multi-user collaboration

3. **Advanced UI Features**

   - Token usage indicator/memory bar
   - Model selection dropdown
   - Context window progress bar
   - Tool selection UI in chat

4. **Message Management**

   - Edit message
   - Regenerate response
   - Copy message
   - Delete message

5. **Chat Features**

   - Draft message persistence
   - Multi-chat parallel management
   - Chat templates
   - Chat export

6. **Tool Integration**
   - Tool invocation during chat
   - Tool result display
   - Tool permission prompts

These features will be implemented in future phases after the basic infrastructure is working.

---

## Reference Files

### Desktop App Reference Files

These files show how features were implemented in the desktop app:

| Feature        | Desktop App File                                                     | Notes                      |
| -------------- | -------------------------------------------------------------------- | -------------------------- |
| Chat Schema    | `desktop_app/src/backend/database/schema/chat.ts`                    | SQLite schema              |
| Message Schema | `desktop_app/src/backend/database/schema/messages.ts`                | SQLite schema              |
| Chat Model     | `desktop_app/src/backend/models/chat/index.ts`                       | Full CRUD logic            |
| Chat Routes    | `desktop_app/src/backend/server/plugins/chat/index.ts`               | Fastify routes             |
| Chat Store     | `desktop_app/src/ui/stores/chat-store.ts`                            | Zustand store (don't copy) |
| Chat Sidebar   | `desktop_app/src/ui/components/Sidebar/ChatSidebarSection/index.tsx` | UI component               |
| Editable Title | `desktop_app/src/ui/components/EditableTitle/index.tsx`              | Inline editing             |

### Platform Reference Files

These files show existing patterns in the platform:

| Pattern         | Platform File                                    | Notes             |
| --------------- | ------------------------------------------------ | ----------------- |
| Database Schema | `platform/backend/src/database/schemas/agent.ts` | PostgreSQL schema |
| Model Class     | `platform/backend/src/models/agent.ts`           | Class-based model |
| Model Tests     | `platform/backend/src/models/agent.test.ts`      | Vitest tests      |
| Routes          | `platform/backend/src/routes/agent.ts`           | Fastify routes    |
| Query Hooks     | Look for existing `.query.ts` files              | TanStack Query    |
| Sidebar         | `platform/frontend/src/app/_parts/sidebar.tsx`   | shadcn/ui sidebar |

---

## Next Steps After Completion

Once this migration is complete, you'll have:

✅ Full backend API for chats  
✅ Database schema for chats and messages  
✅ Chat list in sidebar  
✅ "New Agent" button working  
✅ Empty chat page that loads  
✅ Type-safe data layer with TanStack Query

### Future Phases

**Phase 7: Chat Message Interface**

- Integrate AI SDK for chat UI
- Implement streaming responses
- Add message bubbles (user/assistant)
- Add markdown rendering
- Add code syntax highlighting

**Phase 8: Tool Integration**

- Display tool calls in chat
- Show tool results
- Add tool permission UI
- Integrate with existing tool policies

**Phase 9: Advanced Features**

- Token usage UI (memory indicator)
- Model selection dropdown
- WebSocket real-time updates
- Multi-chat management
- Draft message persistence

**Phase 10: Polish**

- Message editing/regeneration
- Chat export
- Chat templates
- Search in chat history
- Keyboard shortcuts

---

## Getting Help

If you encounter issues during implementation:

1. **Type Errors**: Check `shared/api-client/` was regenerated after backend changes
2. **Database Errors**: Ensure migrations ran successfully
3. **Query Errors**: Check browser Network tab for API responses
4. **Build Errors**: Run `pnpm type-check` and `pnpm lint`
5. **Tilt Issues**: Check http://localhost:10350/ for service logs

**Useful Commands:**

```bash
# Check database
cd platform/backend
pnpm db:studio

# Check types
cd platform
pnpm type-check

# Check logs
cd platform
tilt up  # then visit http://localhost:10350/

# Reset database (careful!)
cd platform/backend
pnpm db:push  # force push schema
```

---

## Checklist

Track your progress through the migration:

### Phase 1: Backend - Database & Models

- [ ] Task 1.1: Create chat schema
- [ ] Task 1.2: Create message schema
- [ ] Task 1.3: Export schemas
- [ ] Task 1.4: Generate migration
- [ ] Task 1.5: Create chat model
- [ ] Task 1.6: Create chat tests
- [ ] Task 1.7: Create message model
- [ ] Task 1.8: Export models
- [ ] Task 1.9: Update types

### Phase 2: Backend - API Routes

- [ ] Task 2.1: Create chat routes
- [ ] Task 2.2: Register routes
- [ ] Task 2.3: Update OpenAPI types

### Phase 3: Shared Types

- [ ] Task 3.1: Create chat types
- [ ] Task 3.2: Export types

### Phase 4: Frontend - Data Layer

- [ ] Task 4.1: Create query hooks
- [ ] Task 4.2: Create utilities

### Phase 5: Frontend - UI Components

- [ ] Task 5.1: Update sidebar
- [ ] Task 5.2: Create new agent button
- [ ] Task 5.3: Create chat list
- [ ] Task 5.4: Add alert dialog
- [ ] Task 5.5: Create chat page
- [ ] Task 5.6: Create chat view
- [ ] Task 5.7: Create loading state
- [ ] Task 5.8: Create error boundary

### Phase 6: Testing & Validation

- [ ] Task 6.1: Type checking
- [ ] Task 6.2: Linting
- [ ] Task 6.3: Backend tests
- [ ] Task 6.4: Start dev environment
- [ ] Task 6.5: Manual testing

---

## Conclusion

This migration establishes the foundation for chat functionality in the platform. The phased approach ensures each layer (database, API, types, queries, UI) is built correctly before moving to the next.

The key architectural difference from the desktop app is the use of **TanStack Query instead of Zustand** for state management, and **PostgreSQL UUIDs instead of SQLite integers** for identifiers.

Once complete, you'll have a solid base to build the full chat interface in future phases.

**Good luck with the implementation! 🚀**
