import type { UIMessage } from "ai";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
  }),
);

export default messagesTable;
