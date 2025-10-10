import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { chatsTable, messagesTable } from "@/database/schemas";

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
