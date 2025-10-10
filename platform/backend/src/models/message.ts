import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import db, { schema } from "@/database";
import type { InsertMessage, Message } from "@/types";

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
      .set({ content })
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
