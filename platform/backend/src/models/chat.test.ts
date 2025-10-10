import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import AgentModel from "./agent";
import ChatModel from "./chat";

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
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });

    it("should find all chats ordered by most recent", async () => {
      await ChatModel.create({ agentId: testAgentId });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      await ChatModel.create({ agentId: testAgentId });

      const chats = await ChatModel.findAll();
      expect(chats).toHaveLength(2);
      // Most recent should be first
      expect(new Date(chats[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(chats[1].createdAt).getTime(),
      );
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
      ];

      await ChatModel.saveMessages(
        chat.sessionId,
        messages as unknown as UIMessage[],
      );

      const withMessages = await ChatModel.findByIdWithMessages(chat.id);
      expect(withMessages?.messages).toHaveLength(2);
      expect(withMessages?.messages[0].role).toBe("user");
    });

    it("should replace existing messages", async () => {
      const chat = await ChatModel.create({ agentId: testAgentId });

      await ChatModel.saveMessages(chat.sessionId, [
        { id: "msg1", role: "user", content: "First", parts: [] },
      ] as unknown as UIMessage[]);

      await ChatModel.saveMessages(chat.sessionId, [
        { id: "msg2", role: "user", content: "Second", parts: [] },
      ] as unknown as UIMessage[]);

      const withMessages = await ChatModel.findByIdWithMessages(chat.id);
      expect(withMessages?.messages).toHaveLength(1);
    });
  });
});
