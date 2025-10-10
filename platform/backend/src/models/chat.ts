import type { UIMessage } from "ai";
import { asc, desc, eq } from "drizzle-orm";
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
    id: string,
  ): Promise<ChatWithMessages | null> {
    const rows = await db
      .select()
      .from(schema.chatsTable)
      .leftJoin(
        schema.messagesTable,
        eq(schema.chatsTable.id, schema.messagesTable.chatId),
      )
      .where(eq(schema.chatsTable.id, id))
      .orderBy(asc(schema.messagesTable.createdAt));

    if (rows.length === 0 || !rows[0].chats) {
      return null;
    }

    const chat = rows[0].chats;
    const messages: Message[] = rows
      .filter((row) => row.messages !== null)
      .map((row) => row.messages as Message);

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
    data: Partial<InsertChat>,
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
    const chat = await ChatModel.findById(chatId);
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
    toolIds: string[] | null,
  ): Promise<void> {
    await ChatModel.update(chatId, { selectedTools: toolIds });
  }

  /**
   * Add tools to the chat's selection
   */
  static async addSelectedTools(
    chatId: string,
    toolIds: string[],
  ): Promise<string[]> {
    const currentTools = await ChatModel.getSelectedTools(chatId);

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

    await ChatModel.updateSelectedTools(chatId, updatedTools);
    return updatedTools;
  }

  /**
   * Remove tools from the chat's selection
   */
  static async removeSelectedTools(
    chatId: string,
    toolIds: string[],
  ): Promise<string[]> {
    const currentTools = await ChatModel.getSelectedTools(chatId);

    let updatedTools: string[];

    if (currentTools === null) {
      // When null (all tools selected), we can't remove specific tools
      // Would need to convert to explicit list first
      // For now, return empty array or throw error
      throw new Error(
        "Cannot remove specific tools when all tools are selected",
      );
    } else {
      // Remove specified tools from existing selection
      const toolSet = new Set(currentTools);
      for (const toolId of toolIds) {
        toolSet.delete(toolId);
      }
      updatedTools = Array.from(toolSet);
    }

    await ChatModel.updateSelectedTools(chatId, updatedTools);
    return updatedTools;
  }

  /**
   * Select all available tools for a chat (sets selectedTools to null)
   */
  static async selectAllTools(chatId: string): Promise<void> {
    await ChatModel.updateSelectedTools(chatId, null);
  }

  /**
   * Deselect all tools for a chat (sets selectedTools to empty array)
   */
  static async deselectAllTools(chatId: string): Promise<void> {
    await ChatModel.updateSelectedTools(chatId, []);
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
    usage: TokenUsage,
  ): Promise<void> {
    const chat = await ChatModel.findBySessionId(sessionId);
    if (!chat) {
      throw new Error(`Chat not found for session ID: ${sessionId}`);
    }

    await ChatModel.update(chat.id, {
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
    const chat = await ChatModel.findBySessionId(sessionId);
    if (!chat) {
      throw new Error(`Chat not found for session ID: ${sessionId}`);
    }

    await ChatModel.update(chat.id, {
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
    messages: UIMessage[],
  ): Promise<void> {
    const chat = await ChatModel.findBySessionId(sessionId);
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
        content: message, // UIMessage type
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
    _chatId: string,
    currentTitle: string | null,
    messages: UIMessage[],
  ): Promise<void> {
    // Only generate if no title exists and we have enough messages
    const relevantMessages = messages.filter(
      (msg) => msg.role === "user" || msg.role === "assistant",
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
