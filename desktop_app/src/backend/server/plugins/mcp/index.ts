import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FastifyPluginAsync } from 'fastify';
import { streamableHttp } from 'fastify-mcp';
import { z } from 'zod';

import ArchestraMcpContext from '@backend/archestraMcp/context';
import toolAggregator from '@backend/llms/toolAggregator';
import ChatModel from '@backend/models/chat';
import MemoryModel from '@backend/models/memory';
import log from '@backend/utils/logger';
import websocketService from '@backend/websocket';

// Workaround for fastify-mcp bug: declare global to store tool arguments
declare global {
  var _mcpToolArguments: any;
}

export const createArchestraMcpServer = () => {
  const archestraMcpServer = new McpServer({
    name: 'archestra-server',
    version: '1.0.0',
  }) as any;

  // Memory CRUD tools
  archestraMcpServer.tool('list_memories', 'List all stored memory entries with their names and values', async () => {
    log.info('list_memories called');
    try {
      const memories = await MemoryModel.getAllMemories();
      if (memories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No memories stored yet.',
            },
          ],
        };
      }

      const formatted = memories.map((m) => `${m.name}: ${m.value}`).join('\n');
      return {
        content: [
          {
            type: 'text',
            text: formatted,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });

  archestraMcpServer.tool(
    'get_memory',
    'Get a specific memory value by its name',
    z.object({
      name: z.string().describe('The name of the memory to retrieve'),
    }) as any,
    async ({ name }: any) => {
      try {
        const memory = await MemoryModel.getMemory(name);
        if (!memory) {
          return {
            content: [
              {
                type: 'text',
                text: `Memory "${name}" not found.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: memory.value,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving memory "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  archestraMcpServer.tool(
    'set_memory',
    'Set or update a memory entry with a specific name and value',
    z.object({
      name: z.string().describe('The name/key for the memory entry'),
      value: z.string().describe('The value/content to store'),
    }) as any,
    async (context: any) => {
      // Workaround for fastify-mcp bug: get arguments from global
      const { name, value } = global._mcpToolArguments || {};
      log.info('set_memory called with:', { name, value });

      try {
        // Validation
        if (!name || !name.trim()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: "name" parameter is required and cannot be empty',
              },
            ],
          };
        }

        if (value === undefined || value === null) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: "value" parameter is required',
              },
            ],
          };
        }

        const memory = await MemoryModel.setMemory(name.trim(), value);

        // Emit WebSocket event for memory update
        const memories = await MemoryModel.getAllMemories();
        websocketService.broadcast({
          type: 'memory-updated',
          payload: { memories },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Memory "${memory.name}" has been ${memory.createdAt === memory.updatedAt ? 'created' : 'updated'}.`,
            },
          ],
        };
      } catch (error) {
        log.error('Error in set_memory tool:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error setting memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  archestraMcpServer.tool(
    'delete_memory',
    'Delete a specific memory entry by name',
    z.object({
      name: z.string().describe('The name of the memory to delete'),
    }) as any,
    async ({ name }: any) => {
      try {
        const deleted = await MemoryModel.deleteMemory(name);

        if (!deleted) {
          return {
            content: [
              {
                type: 'text',
                text: `Memory "${name}" not found.`,
              },
            ],
          };
        }

        // Emit WebSocket event for memory update
        const memories = await MemoryModel.getAllMemories();
        websocketService.broadcast({
          type: 'memory-updated',
          payload: { memories },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Memory "${name}" has been deleted.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  // Tool management tools
  archestraMcpServer.tool(
    'list_available_tools',
    'List all available MCP tools showing which are enabled for the current chat',
    async () => {
      try {
        const chatId = ArchestraMcpContext.getCurrentChatId();
        if (!chatId) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: No active chat context found. Please send a message in a chat first.',
              },
            ],
          };
        }

        // Get all available tools
        const allTools = toolAggregator.getAllAvailableTools();

        // Get selected tools for the chat
        const selectedTools = await ChatModel.getSelectedTools(chatId);

        // Create a set of selected tool IDs for quick lookup
        const selectedSet =
          selectedTools === null
            ? new Set(allTools.map((t) => t.id)) // null means all selected
            : new Set(selectedTools);

        // Group tools by MCP server
        const toolsByServer: Record<string, any[]> = {};

        for (const tool of allTools) {
          const serverName = tool.mcpServerName || 'Unknown Server';
          if (!toolsByServer[serverName]) {
            toolsByServer[serverName] = [];
          }

          toolsByServer[serverName].push({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            selected: selectedSet.has(tool.id),
            analysis: tool.analysis,
          });
        }

        // Format the output
        const formattedOutput = Object.entries(toolsByServer)
          .map(([serverName, tools]) => {
            const enabledCount = tools.filter((t) => t.selected).length;
            const header = `**${serverName}** (${enabledCount}/${tools.length} enabled)`;

            const toolList = tools
              .map((t) => {
                const status = t.selected ? '✓' : '✗';
                const analysisInfo =
                  t.analysis?.is_read !== null
                    ? ` [${t.analysis.is_read ? 'R' : ''}${t.analysis.is_write ? 'W' : ''}]`
                    : '';
                return `  ${status} ${t.id}${analysisInfo}: ${t.description || 'No description'}`;
              })
              .join('\n');

            return `${header}\n${toolList}`;
          })
          .join('\n\n');

        const summary =
          selectedTools === null
            ? 'All tools are currently enabled (default)'
            : `${selectedSet.size} out of ${allTools.length} tools enabled`;

        return {
          content: [
            {
              type: 'text',
              text: `${summary}\n\n${formattedOutput}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  archestraMcpServer.tool(
    'enable_tools',
    'Enable specific tools for use in the current chat. First call list_available_tools to see tool IDs, then pass them here. Example: {"toolIds": ["filesystem__read_file", "filesystem__write_file", "remote-mcp__search_repositories"]}',
    z.object({
      toolIds: z
        .array(z.string())
        .describe(
          'Array of tool IDs from list_available_tools output. Example: ["archestra__list_memories", "filesystem__read_file", "remote-mcp__create_issue"]'
        ),
    }) as any,
    async (context: any) => {
      // Workaround for fastify-mcp bug: get arguments from global
      const { toolIds } = global._mcpToolArguments || {};
      const chatId = ArchestraMcpContext.getCurrentChatId();

      try {
        if (!chatId) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: No active chat context found. Please send a message in a chat first.',
              },
            ],
          };
        }

        if (!toolIds || !Array.isArray(toolIds)) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: toolIds must be an array of tool IDs',
              },
            ],
          };
        }

        // Get all available tools to validate the tool IDs exist
        const allTools = toolAggregator.getAllAvailableTools();
        const availableToolIds = new Set(allTools.map((t) => t.id));

        // Get currently selected tools for the chat
        const currentSelectedTools = await ChatModel.getSelectedTools(chatId);
        const currentEnabledSet =
          currentSelectedTools === null
            ? new Set(availableToolIds) // null means all tools are enabled
            : new Set(currentSelectedTools);

        // Validate each tool ID
        const errors: string[] = [];
        const validToolsToEnable: string[] = [];

        for (const toolId of toolIds) {
          if (!availableToolIds.has(toolId)) {
            errors.push(`Tool '${toolId}' does not exist`);
          } else if (currentEnabledSet.has(toolId)) {
            errors.push(`Tool '${toolId}' is already enabled`);
          } else {
            validToolsToEnable.push(toolId);
          }
        }

        // If there are any errors, return them
        if (errors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error enabling tools:\n${errors.join('\n')}`,
              },
            ],
          };
        }

        // If no valid tools to enable, return message
        if (validToolsToEnable.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tools to enable. All specified tools are either non-existent or already enabled.',
              },
            ],
          };
        }

        const updatedTools = await ChatModel.addSelectedTools(chatId, validToolsToEnable);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully enabled ${validToolsToEnable.length} tool(s). Total enabled: ${updatedTools.length}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error enabling tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  archestraMcpServer.tool(
    'disable_tools',
    'Disable specific tools from the current chat',
    z.object({
      toolIds: z.array(z.string()).describe('Array of tool IDs to disable'),
    }) as any,
    async (context: any) => {
      // Workaround for fastify-mcp bug: get arguments from global
      const { toolIds } = global._mcpToolArguments || {};
      const chatId = ArchestraMcpContext.getCurrentChatId();

      try {
        if (!chatId) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: No active chat context found. Please send a message in a chat first.',
              },
            ],
          };
        }

        if (!toolIds || !Array.isArray(toolIds)) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: toolIds must be an array of tool IDs',
              },
            ],
          };
        }

        // Get all available tools to validate the tool IDs exist
        const allTools = toolAggregator.getAllAvailableTools();
        const availableToolIds = new Set(allTools.map((t) => t.id));

        // Get currently selected tools for the chat
        const currentSelectedTools = await ChatModel.getSelectedTools(chatId);
        const currentEnabledSet =
          currentSelectedTools === null
            ? new Set(availableToolIds) // null means all tools are enabled
            : new Set(currentSelectedTools);

        // Validate each tool ID
        const errors: string[] = [];
        const validToolsToDisable: string[] = [];

        for (const toolId of toolIds) {
          if (!availableToolIds.has(toolId)) {
            errors.push(`Tool '${toolId}' does not exist`);
          } else if (!currentEnabledSet.has(toolId)) {
            errors.push(`Tool '${toolId}' is already disabled`);
          } else {
            validToolsToDisable.push(toolId);
          }
        }

        // If there are any errors, return them
        if (errors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error disabling tools:\n${errors.join('\n')}`,
              },
            ],
          };
        }

        // If no valid tools to disable, return message
        if (validToolsToDisable.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tools to disable. All specified tools are either non-existent or already disabled.',
              },
            ],
          };
        }

        const updatedTools = await ChatModel.removeSelectedTools(chatId, validToolsToDisable);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully disabled ${validToolsToDisable.length} tool(s). Remaining enabled: ${updatedTools.length}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error disabling tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  return archestraMcpServer.server;
};

const archestraMcpServerPlugin: FastifyPluginAsync = async (fastify) => {
  log.info('Registering Archestra MCP server plugin...');

  // Store the current request arguments globally as a workaround
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/mcp' && request.body) {
      const body = request.body as any;
      if (body.method === 'tools/call' && body.params && body.params.arguments) {
        global._mcpToolArguments = body.params.arguments;
        log.info('Stored tool arguments globally:', global._mcpToolArguments);
      }
    }
  });

  await fastify.register(streamableHttp, {
    stateful: false,
    mcpEndpoint: '/mcp',
    createServer: createArchestraMcpServer as any,
  });

  log.info('Archestra MCP server plugin registered successfully');
  fastify.log.info(`Archestra MCP server plugin registered`);
};

export default archestraMcpServerPlugin;
