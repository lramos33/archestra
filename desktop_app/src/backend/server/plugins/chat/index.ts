import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import toolAggregator from '@backend/llms/toolAggregator';
import ChatModel, { ChatWithMessagesSchema } from '@backend/models/chat';
import { AvailableToolSchema } from '@backend/sandbox/schemas';
import { ErrorResponseSchema, StringNumberIdSchema } from '@backend/schemas';

/**
 * Register our zod schemas into the global registry, such that they get output as components in the openapi spec
 * https://github.com/turkerdev/fastify-type-provider-zod?tab=readme-ov-file#how-to-create-refs-to-the-schemas
 */
z.globalRegistry.add(ChatWithMessagesSchema, { id: 'ChatWithMessages' });

const chatRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/api/chat',
    {
      schema: {
        operationId: 'getChats',
        description: 'Get all chats',
        tags: ['Chat'],
        response: {
          200: z.array(ChatWithMessagesSchema),
        },
      },
    },
    async (_request, reply) => {
      const chats = await ChatModel.getAllChats();
      return reply.code(200).send(chats);
    }
  );

  fastify.get(
    '/api/chat/:id',
    {
      schema: {
        operationId: 'getChatById',
        description: 'Get single chat with messages',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          200: ChatWithMessagesSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id } }, reply) => {
      const chat = await ChatModel.getChatById(id);
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }

      return reply.code(200).send(chat);
    }
  );

  fastify.post(
    '/api/chat',
    {
      schema: {
        operationId: 'createChat',
        description: 'Create new chat',
        tags: ['Chat'],
        body: z.object({
          // Currently empty - chat creation doesn't require any fields
        }),
        response: {
          201: ChatWithMessagesSchema,
        },
      },
    },
    async (_request, reply) => {
      const chat = await ChatModel.createChat();
      return reply.code(201).send(chat);
    }
  );

  fastify.patch(
    '/api/chat/:id',
    {
      schema: {
        operationId: 'updateChat',
        description: 'Update chat',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        body: z.object({
          title: z.string().nullable().optional(),
        }),
        response: {
          200: ChatWithMessagesSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id }, body }, reply) => {
      const chat = await ChatModel.updateChat(id, body);
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }

      return reply.code(200).send(chat);
    }
  );

  fastify.delete(
    '/api/chat/:id',
    {
      schema: {
        operationId: 'deleteChat',
        description: 'Delete chat',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          204: z.null(),
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id } }, reply) => {
      await ChatModel.deleteChat(id);
      return reply.code(204).send();
    }
  );

  // Tool management endpoints
  fastify.get(
    '/api/chat/:id/tools',
    {
      schema: {
        operationId: 'getChatSelectedTools',
        description: 'Get selected tools for a specific chat',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()).nullable(),
            availableTools: z.array(AvailableToolSchema),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id } }, reply) => {
      try {
        const selectedTools = await ChatModel.getSelectedTools(id);
        const availableTools = toolAggregator.getAllAvailableTools();

        return reply.code(200).send({
          selectedTools,
          availableTools,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Chat not found')) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
        throw error;
      }
    }
  );

  fastify.post(
    '/api/chat/:id/tools/select',
    {
      schema: {
        operationId: 'selectChatTools',
        description: 'Add tools to chat selection',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        body: z.object({
          toolIds: z.array(z.string()),
        }),
        response: {
          200: z.object({
            selectedTools: z.array(z.string()),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id }, body }, reply) => {
      try {
        const selectedTools = await ChatModel.addSelectedTools(id, body.toolIds);
        return reply.code(200).send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Chat not found')) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
        throw error;
      }
    }
  );

  fastify.post(
    '/api/chat/:id/tools/deselect',
    {
      schema: {
        operationId: 'deselectChatTools',
        description: 'Remove tools from chat selection',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
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
        },
      },
    },
    async ({ params: { id }, body }, reply) => {
      try {
        const selectedTools = await ChatModel.removeSelectedTools(id, body.toolIds);
        return reply.code(200).send({ selectedTools });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Chat not found')) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
        if (error instanceof Error && error.message.includes('Cannot remove specific tools')) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  fastify.post(
    '/api/chat/:id/tools/select-all',
    {
      schema: {
        operationId: 'selectAllChatTools',
        description: 'Select all available tools for this chat',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id } }, reply) => {
      try {
        await ChatModel.selectAllTools(id);
        return reply.code(200).send({ message: 'All tools selected' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Chat not found')) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
        throw error;
      }
    }
  );

  fastify.post(
    '/api/chat/:id/tools/deselect-all',
    {
      schema: {
        operationId: 'deselectAllChatTools',
        description: 'Clear all tool selections for this chat',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async ({ params: { id } }, reply) => {
      try {
        await ChatModel.deselectAllTools(id);
        return reply.code(200).send({ message: 'All tools deselected' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Chat not found')) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
        throw error;
      }
    }
  );

  fastify.get(
    '/api/chat/:id/tools/available',
    {
      schema: {
        operationId: 'getChatAvailableTools',
        description: 'List all tools available for selection',
        tags: ['Chat'],
        params: z.object({
          id: StringNumberIdSchema,
        }),
        response: {
          200: z.array(AvailableToolSchema),
        },
      },
    },
    async (_request, reply) => {
      const availableTools = toolAggregator.getAllAvailableTools();
      return reply.code(200).send(availableTools);
    }
  );
};

export default chatRoutes;
