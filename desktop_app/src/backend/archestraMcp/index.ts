import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type experimental_MCPClient, experimental_createMCPClient } from 'ai';

import config from '@backend/config';
import { type AvailableTool } from '@backend/sandbox/schemas';
import log from '@backend/utils/logger';

const { host: serverHost, port: serverPort } = config.server.http;

/**
 * Tool ID separator for Archestra MCP server tools
 */
const TOOL_ID_SEPARATOR = '__';

/**
 * Archestra MCP server ID
 */
const ARCHESTRA_MCP_SERVER_ID = 'archestra';

export type McpTools = Awaited<ReturnType<experimental_MCPClient['tools']>>;

/**
 * ArchestraMcpClient is a singleton client for the built-in Archestra MCP server.
 * It connects to the local MCP endpoint and provides tools for managing MCP servers.
 */
class ArchestraMcpClient {
  private mcpClient: experimental_MCPClient | null = null;
  private archestraMcpUrl: string;
  private isConnected: boolean = false;

  tools: McpTools = {};

  constructor() {
    this.archestraMcpUrl = `http://${serverHost}:${serverPort}/mcp`;
  }

  /**
   * Connect to the Archestra MCP server and fetch available tools
   */
  async connect() {
    if (this.isConnected) {
      log.info('Archestra MCP client already connected');
      return;
    }

    try {
      log.info(`Connecting to Archestra MCP server at ${this.archestraMcpUrl}...`);

      const transport = new StreamableHTTPClientTransport(new URL(this.archestraMcpUrl));
      log.info('Transport created, creating MCP client...');

      this.mcpClient = await experimental_createMCPClient({ transport });
      log.info('MCP client created, fetching tools...');

      await this.fetchTools();
      this.isConnected = true;

      log.info('Successfully connected to Archestra MCP server');
    } catch (error) {
      log.error('Failed to connect to Archestra MCP server:', error);
      log.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  /**
   * Fetch tools from the Archestra MCP server and transform their IDs
   */
  private async fetchTools() {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    log.info('Fetching tools from Archestra MCP server...');

    try {
      const tools = await this.mcpClient.tools();

      // Clear existing tools
      this.tools = {};

      // Transform tool IDs to include the Archestra prefix
      for (const [toolName, tool] of Object.entries(tools)) {
        const toolId = `${ARCHESTRA_MCP_SERVER_ID}${TOOL_ID_SEPARATOR}${toolName}`;
        this.tools[toolId] = tool;
      }

      const toolCount = Object.keys(this.tools).length;
      log.info(`Fetched ${toolCount} tools from Archestra MCP server`);
    } catch (error) {
      log.error('Failed to fetch tools from Archestra MCP server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the Archestra MCP server
   */
  async disconnect() {
    if (this.mcpClient) {
      try {
        await this.mcpClient.close();
        this.mcpClient = null;
        this.isConnected = false;
        this.tools = {};
        log.info('Disconnected from Archestra MCP server');
      } catch (error) {
        log.error('Error disconnecting from Archestra MCP server:', error);
      }
    }
  }

  /**
   * Get all tools in the Vercel AI SDK format
   */
  getAllTools(): McpTools {
    return this.tools;
  }

  /**
   * Get specific tools by ID in the Vercel AI SDK format
   */
  getToolsById(toolIds: string[]): McpTools {
    const selected: McpTools = {};

    for (const toolId of toolIds) {
      if (this.tools[toolId]) {
        selected[toolId] = this.tools[toolId];
      }
    }

    return selected;
  }

  /**
   * Helper function to make schema JSON-serializable by removing symbols
   */
  private cleanToolInputSchema = (
    schema: Awaited<ReturnType<experimental_MCPClient['tools']>>[string]['inputSchema']
  ): any => {
    if (!schema) return undefined;

    try {
      // JSON.parse(JSON.stringify()) removes non-serializable properties like symbols
      return JSON.parse(JSON.stringify(schema));
    } catch {
      return undefined;
    }
  };

  /**
   * Get available tools in UI format
   */
  get availableToolsList(): AvailableTool[] {
    return Object.entries(this.tools).map(([id, tool]) => {
      const separatorIndex = id.indexOf(TOOL_ID_SEPARATOR);
      const toolName = separatorIndex !== -1 ? id.substring(separatorIndex + TOOL_ID_SEPARATOR.length) : id;

      // Static evaluation for all Archestra MCP tools
      const toolEvaluations: Record<string, { is_read: boolean; is_write: boolean }> = {
        // MCP Server management tools
        list_installed_mcp_servers: { is_read: true, is_write: false },
        install_mcp_server: { is_read: false, is_write: true },
        uninstall_mcp_server: { is_read: false, is_write: true },
        search_mcp_servers: { is_read: true, is_write: false },

        // Memory management tools
        list_memories: { is_read: true, is_write: false },
        get_memory: { is_read: true, is_write: false },
        set_memory: { is_read: false, is_write: true },
        delete_memory: { is_read: false, is_write: true },

        // Tool management tools
        list_available_tools: { is_read: true, is_write: false },
        enable_tools: { is_read: false, is_write: true },
        disable_tools: { is_read: false, is_write: true },
      };

      const evaluation = toolEvaluations[toolName] || {
        is_read: false,
        is_write: false,
      };

      return {
        id,
        name: toolName,
        description: tool.description,
        inputSchema: this.cleanToolInputSchema(tool.inputSchema),
        mcpServerId: ARCHESTRA_MCP_SERVER_ID,
        mcpServerName: 'Archestra',
        // Static evaluations for built-in tools
        analysis: {
          status: 'completed',
          error: null,
          is_read: evaluation.is_read,
          is_write: evaluation.is_write,
        },
      };
    });
  }

  /**
   * Check if the client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export default new ArchestraMcpClient();
