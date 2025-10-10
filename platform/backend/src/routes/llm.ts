import { type CoreMessage, type LanguageModel, streamText } from "ai";
import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ChatModel } from "@/models";

/**
 * LLM Streaming Routes
 *
 * Handles streaming LLM responses with tool support.
 * This endpoint receives messages from the AI SDK's useChat hook,
 * streams responses from the LLM provider, and saves messages to the database.
 */
const llmRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * POST /api/llm/stream
   * Stream LLM responses with tool support
   *
   * This endpoint is designed to work with AI SDK's useChat hook.
   * It receives messages, streams the LLM response, and saves messages on completion.
   */
  fastify.post(
    "/api/llm/stream",
    {
      schema: {
        operationId: "streamLlm",
        description: "Stream LLM response with tools",
        tags: ["LLM"],
        body: z.object({
          messages: z.array(z.any()), // UIMessage[] from AI SDK
          chatId: z.string().uuid(),
          sessionId: z.string().uuid(),
          model: z.string().default("gpt-4o"),
          provider: z.string().default("openai").optional(),
        }),
        response: {
          200: z.any(), // Stream response
          404: z.object({
            error: z.object({
              message: z.string(),
              type: z.string(),
            }),
          }),
          500: z.object({
            error: z.object({
              message: z.string(),
              type: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        messages,
        sessionId,
        model = "gpt-4o",
        provider = "openai",
      } = request.body;

      try {
        // Verify chat exists and get selected tools
        const chat = await ChatModel.findBySessionId(sessionId);
        if (!chat) {
          return reply.status(404).send({
            error: {
              message: "Chat not found",
              type: "not_found",
            },
          });
        }

        // Get selected tools for this chat
        const _selectedTools = await ChatModel.getSelectedTools(chat.id);

        // TODO: Implement tool loading based on selectedTools
        // For now, empty tools object until we add tool integration
        const tools = {};

        // Create model instance
        const modelInstance = await createModelInstance(
          model,
          provider,
          fastify,
        );

        // Stream with AI SDK
        const result = await streamText({
          model: modelInstance,
          messages: messages as CoreMessage[],
          tools,
          onFinish: async ({ usage }) => {
            try {
              // TODO: Implement message persistence
              // The AI SDK's useChat hook manages message state on the client
              // We may want to persist messages separately or via a different endpoint

              // Update token usage
              if (usage) {
                await ChatModel.updateTokenUsage(sessionId, {
                  promptTokens: usage.inputTokens || 0,
                  completionTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                  model,
                });

                fastify.log.info(
                  `Completed chat stream for session ${sessionId}, used ${
                    usage.totalTokens || 0
                  } tokens`,
                );
              }
            } catch (err) {
              fastify.log.error(
                { error: err },
                "Failed to save messages or update usage",
              );
              // Don't throw - stream already completed successfully
            }
          },
        });

        // Return the streaming response
        // AI SDK will handle the text/event-stream format automatically
        return result.toTextStreamResponse();
      } catch (err) {
        fastify.log.error({ error: err }, "LLM streaming error");
        return reply.status(500).send({
          error: {
            message:
              err instanceof Error ? err.message : "Failed to stream response",
            type: "api_error",
          },
        });
      }
    },
  );
};

/**
 * Create model instance based on provider
 *
 * This function supports multiple providers:
 * - OpenAI (including compatible APIs)
 * - Ollama (local models)
 * - More providers can be added in the future
 */
async function createModelInstance(
  model: string,
  provider: string,
  fastify: FastifyInstance,
): Promise<LanguageModel> {
  if (provider === "ollama") {
    const { createOllama } = await import("ollama-ai-provider");
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
    });
    fastify.log.info(`Using Ollama provider with model: ${model}`);
    return ollama(model) as unknown as LanguageModel;
  }

  // Default to OpenAI-compatible provider
  const { createOpenAI } = await import("@ai-sdk/openai");
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy-key",
    baseURL: process.env.OPENAI_BASE_URL,
  });
  fastify.log.info(`Using OpenAI provider with model: ${model}`);
  return openai(model);
}

export default llmRoutes;
