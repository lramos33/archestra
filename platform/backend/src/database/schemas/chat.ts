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
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    agentIdIdx: index("chats_agent_id_idx").on(table.agentId),
    createdAtIdx: index("chats_created_at_idx").on(table.createdAt),
  }),
);

export default chatsTable;
