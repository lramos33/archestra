import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { schema } from "@/database";
import { ChatModel } from "@/models";
import { ErrorResponseSchema, UuidIdSchema } from "@/types";

// Create zod schemas from database schemas
const SelectChatSchema = createSelectSchema(schema.chatsTable);
const _InsertChatSchema = createInsertSchema(schema.chatsTable);
const SelectMessageSchema = createSelectSchema(schema.messagesTable);

// Response schemas
const ChatWithMessagesSchema = SelectChatSchema.extend({
  messages: z.array(SelectMessageSchema),
});

const chatRoutes: FastifyPluginAsyncZod = async (fastify) => {
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
        operationId: "getChats",
        description: "Get all chats",
        tags: ["Chats"],
        response: {
          200: z.array(SelectChatSchema),
          500: ErrorResponseSchema,
        },
      },
    },
    async (_, reply) => {
      try {
        const chats = await ChatModel.findAll();
        return reply.send(chats);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * GET /api/chats/:id
   * Get single chat with messages
   */
  fastify.get(
    "/api/chats/:id",
    {
      schema: {
        operationId: "getChatById",
        description: "Get single chat with messages",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: ChatWithMessagesSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const chat = await ChatModel.findByIdWithMessages(id);

        if (!chat) {
          return reply.status(404).send({
            error: {
              message: "Chat not found",
              type: "not_found",
            },
          });
        }

        return reply.send(chat);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * POST /api/chats
   * Create new chat
   */
  fastify.post(
    "/api/chats",
    {
      schema: {
        operationId: "createChat",
        description: "Create new chat",
        tags: ["Chats"],
        body: z.object({
          agentId: UuidIdSchema,
        }),
        response: {
          201: SelectChatSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { agentId } = request.body;
        const chat = await ChatModel.create({ agentId });
        return reply.status(201).send(chat);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * PATCH /api/chats/:id
   * Update chat (title, etc.)
   */
  fastify.patch(
    "/api/chats/:id",
    {
      schema: {
        operationId: "updateChat",
        description: "Update chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: z.object({
          title: z.string().nullable().optional(),
        }),
        response: {
          200: SelectChatSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const updates = request.body;

        const chat = await ChatModel.update(id, updates);

        if (!chat) {
          return reply.status(404).send({
            error: {
              message: "Chat not found",
              type: "not_found",
            },
          });
        }

        return reply.send(chat);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * DELETE /api/chats/:id
   * Delete chat
   */
  fastify.delete(
    "/api/chats/:id",
    {
      schema: {
        operationId: "deleteChat",
        description: "Delete chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          204: z.null(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const deleted = await ChatModel.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            error: {
              message: "Chat not found",
              type: "not_found",
            },
          });
        }

        return reply.status(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  // ============================================
  // Tool Management Endpoints
  // ============================================

  /**
   * GET /api/chats/:id/tools
   * Get selected tools for a chat
   */
  fastify.get(
    "/api/chats/:id/tools",
    {
      schema: {
        operationId: "getChatTools",
        description: "Get selected tools for this chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()).nullable(),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const selectedTools = await ChatModel.getSelectedTools(id);
        return reply.send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * PUT /api/chats/:id/tools
   * Update selected tools for a chat
   */
  fastify.put(
    "/api/chats/:id/tools",
    {
      schema: {
        operationId: "updateChatTools",
        description: "Update selected tools for this chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: z.object({
          toolIds: z.array(z.string()).nullable(),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()).nullable(),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { toolIds } = request.body;

        await ChatModel.updateSelectedTools(id, toolIds);
        const selectedTools = await ChatModel.getSelectedTools(id);
        return reply.send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * POST /api/chats/:id/tools/select
   * Add tools to chat selection
   */
  fastify.post(
    "/api/chats/:id/tools/select",
    {
      schema: {
        operationId: "addChatTools",
        description: "Add tools to chat selection",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: z.object({
          toolIds: z.array(z.string()),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { toolIds } = request.body;

        const selectedTools = await ChatModel.addSelectedTools(id, toolIds);
        return reply.send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * POST /api/chats/:id/tools/deselect
   * Remove tools from chat selection
   */
  fastify.post(
    "/api/chats/:id/tools/deselect",
    {
      schema: {
        operationId: "removeChatTools",
        description: "Remove tools from chat selection",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: z.object({
          toolIds: z.array(z.string()),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()),
          }),
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { toolIds } = request.body;

        const selectedTools = await ChatModel.removeSelectedTools(id, toolIds);
        return reply.send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot remove")) {
          return reply.status(400).send({
            error: {
              message: error.message,
              type: "invalid_request",
            },
          });
        }
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * POST /api/chats/:id/tools/select-all
   * Select all tools for this chat
   */
  fastify.post(
    "/api/chats/:id/tools/select-all",
    {
      schema: {
        operationId: "selectAllChatTools",
        description: "Select all tools for this chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        await ChatModel.selectAllTools(id);
        return reply.send({ message: "All tools selected" });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  /**
   * POST /api/chats/:id/tools/deselect-all
   * Deselect all tools for this chat
   */
  fastify.post(
    "/api/chats/:id/tools/deselect-all",
    {
      schema: {
        operationId: "deselectAllChatTools",
        description: "Deselect all tools for this chat",
        tags: ["Chats"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        await ChatModel.deselectAllTools(id);
        return reply.send({ message: "All tools deselected" });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  // ============================================
  // Token Usage Endpoints
  // ============================================

  /**
   * POST /api/chats/:sessionId/reset-tokens
   * Reset token usage counters
   */
  fastify.post(
    "/api/chats/:sessionId/reset-tokens",
    {
      schema: {
        operationId: "resetChatTokens",
        description: "Reset token usage counters for a chat",
        tags: ["Chats"],
        params: z.object({
          sessionId: UuidIdSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        await ChatModel.resetTokenUsage(sessionId);
        return reply.send({ message: "Token usage reset successfully" });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: {
              message: error.message,
              type: "not_found",
            },
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );
};

export default chatRoutes;
