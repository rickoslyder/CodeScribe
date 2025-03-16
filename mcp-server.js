const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const tokenCounters = require("./tokenCounters");

/**
 * A simple implementation of the Model Context Protocol (MCP) server
 * for the Markdown Generator application.
 *
 * This implementation follows the basic structure of the MCP specification:
 * https://modelcontextprotocol.io/
 */
class McpServer {
  constructor(markdownGeneratorFunctions, settings, repoMixIntegration) {
    this.markdownGeneratorFunctions = markdownGeneratorFunctions;
    this.settings = settings;
    this.repoMixIntegration = repoMixIntegration;
    this.child = null;
    this.messageBuffer = "";
    this.nextId = 1;
    this.callbacks = new Map();
  }

  /**
   * Start the MCP server as a child process that communicates over stdin/stdout
   * as per the MCP specification.
   */
  start() {
    // Spawn the process to handle MCP messages
    // In a real MCP server, this might be a separate process
    // For simplicity, we're implementing the handler within this class

    // Set up message handling
    process.stdin.on("data", (data) => {
      this.handleStdinData(data);
    });

    // Send the initialize result when the server is started
    this.sendInitializeResult();

    console.log("MCP server started and ready to receive messages");
    return Promise.resolve();
  }

  /**
   * Handle data coming from stdin
   */
  handleStdinData(data) {
    // Accumulate incoming data
    this.messageBuffer += data.toString();

    // Process complete messages (each message is a JSON object on a single line)
    let newlineIndex;
    while ((newlineIndex = this.messageBuffer.indexOf("\n")) !== -1) {
      const line = this.messageBuffer.substring(0, newlineIndex);
      this.messageBuffer = this.messageBuffer.substring(newlineIndex + 1);

      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleJsonRpcMessage(message);
        } catch (error) {
          console.error("Error parsing JSON message:", error);
        }
      }
    }
  }

  /**
   * Handle JSON-RPC messages according to MCP specification
   */
  async handleJsonRpcMessage(message) {
    console.log("Received message:", JSON.stringify(message));

    // Check if it's a valid JSON-RPC 2.0 message
    if (message.jsonrpc !== "2.0") {
      return this.sendErrorResponse(message.id, -32600, "Invalid Request");
    }

    // Handle request messages
    if (message.method) {
      try {
        switch (message.method) {
          case "initialize":
            // Already handled on startup, but respond anyway
            this.sendInitializeResult(message.id);
            break;

          case "shutdown":
            // Client is requesting shutdown
            this.sendResult(message.id, {});
            break;

          case "tools/list":
            // Return list of available tools
            this.handleToolsList(message);
            break;

          case "tools/call":
            // Handle tool call
            await this.handleToolsCall(message);
            break;

          case "resources/list":
            // Return list of available resources
            this.handleResourcesList(message);
            break;

          case "resources/get":
            // Get a specific resource
            await this.handleResourcesGet(message);
            break;

          default:
            // Unknown method
            this.sendErrorResponse(
              message.id,
              -32601,
              `Method not found: ${message.method}`
            );
            break;
        }
      } catch (error) {
        console.error(`Error handling method ${message.method}:`, error);
        this.sendErrorResponse(
          message.id,
          -32000,
          `Error handling method ${message.method}: ${error.message}`
        );
      }
    }
  }

  /**
   * Handle the tools/list method
   */
  handleToolsList(message) {
    // Respond with the list of available tools
    const tools = [
      {
        name: "generate_markdown",
        description:
          "Generates markdown documentation from source code in a specified folder",
        inputSchema: {
          type: "object",
          properties: {
            folderPath: {
              type: "string",
              description: "Path to the folder containing source code",
            },
            selectedPaths: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Optional list of specific file paths to include",
            },
            ignorePatterns: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Optional list of patterns to ignore",
            },
          },
          required: ["folderPath"],
        },
      },
      {
        name: "pack_remote_repository",
        description:
          "Process a remote Git repository and generate markdown documentation",
        inputSchema: {
          type: "object",
          properties: {
            repoUrl: {
              type: "string",
              description:
                "URL of the repository to process (e.g., 'owner/repo' or full URL)",
            },
            securityCheck: {
              type: "boolean",
              description:
                "Whether to perform security checks (default: false)",
            },
            style: {
              type: "string",
              description:
                "Output style: 'markdown', 'plain', or 'xml' (default: 'markdown')",
              enum: ["markdown", "plain", "xml"],
            },
          },
          required: ["repoUrl"],
        },
      },
      {
        name: "process_with_security",
        description:
          "Process a local repository with security checks to identify and filter sensitive information",
        inputSchema: {
          type: "object",
          properties: {
            folderPath: {
              type: "string",
              description: "Path to the folder containing source code",
            },
            style: {
              type: "string",
              description:
                "Output style: 'markdown', 'plain', or 'xml' (default: 'markdown')",
              enum: ["markdown", "plain", "xml"],
            },
          },
          required: ["folderPath"],
        },
      },
      {
        name: "count_tokens",
        description: "Counts tokens in a text string using various tokenizers",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to count tokens for",
            },
            model: {
              type: "string",
              enum: ["gpt-4o", "claude"],
              description: "The model to use for token counting",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "get_directory_structure",
        description: "Returns the directory structure for a given folder path",
        inputSchema: {
          type: "object",
          properties: {
            folderPath: {
              type: "string",
              description: "Path to the folder to scan",
            },
            ignorePatterns: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Optional list of patterns to ignore",
            },
          },
          required: ["folderPath"],
        },
      },
    ];

    this.sendResult(message.id, { tools });
  }

  /**
   * Handle the tools/call method
   */
  async handleToolsCall(message) {
    const params = message.params || {};
    const { name, input } = params;

    if (!name) {
      return this.sendErrorResponse(message.id, -32602, "Missing tool name");
    }

    try {
      let result;

      switch (name) {
        case "generate_markdown":
          result = await this.handleGenerateMarkdown(input);
          break;
        case "pack_remote_repository":
          result = await this.handlePackRemoteRepository(input);
          break;
        case "process_with_security":
          result = await this.handleProcessWithSecurity(input);
          break;
        case "count_tokens":
          result = await this.handleCountTokens(input);
          break;
        case "get_directory_structure":
          result = await this.handleGetDirectoryStructure(input);
          break;
        default:
          return this.sendErrorResponse(
            message.id,
            -32601,
            `Unknown tool: ${name}`
          );
      }

      this.sendResult(message.id, { result });
    } catch (error) {
      console.error(`Error handling tool call ${name}:`, error);
      this.sendErrorResponse(
        message.id,
        -32603,
        `Error handling tool call: ${error.message}`
      );
    }
  }

  /**
   * Handle the resources/list method
   */
  handleResourcesList(message) {
    // Respond with the list of available resources
    const resources = [
      {
        name: "settings",
        description: "Current settings for the Markdown Generator",
        schema: {
          type: "object",
          properties: {
            ignorePatterns: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Patterns to ignore when generating markdown",
            },
            anthropicApiKey: {
              type: "string",
              description: "Anthropic API key for Claude token counting",
            },
          },
        },
      },
    ];

    this.sendResult(message.id, { resources });
  }

  /**
   * Handle the resources/get method
   */
  async handleResourcesGet(message) {
    const params = message.params || {};
    const { name } = params;

    if (!name) {
      return this.sendErrorResponse(
        message.id,
        -32602,
        "Missing resource name"
      );
    }

    try {
      let content;

      switch (name) {
        case "settings":
          content = { ...this.settings };
          // Don't expose the API key in resources
          if (content.anthropicApiKey) {
            content.anthropicApiKey = content.anthropicApiKey
              ? "[REDACTED]"
              : "";
          }
          break;

        default:
          return this.sendErrorResponse(
            message.id,
            -32602,
            `Unknown resource: ${name}`
          );
      }

      this.sendResult(message.id, { content });
    } catch (error) {
      console.error(`Error getting resource ${name}:`, error);
      this.sendErrorResponse(
        message.id,
        -32000,
        `Error getting resource ${name}: ${error.message}`
      );
    }
  }

  /**
   * Handle the generate_markdown tool
   */
  async handleGenerateMarkdown(input) {
    const { folderPath, selectedPaths, ignorePatterns } = input;

    if (!folderPath) {
      throw new Error("folderPath is required");
    }

    // If ignorePatterns is provided, use it temporarily for this request
    let originalIgnorePatterns;
    if (ignorePatterns) {
      originalIgnorePatterns = [...this.settings.ignorePatterns];
      this.settings.ignorePatterns = ignorePatterns;
    }

    try {
      // If selectedPaths is not provided, get the directory structure
      let pathsToProcess = selectedPaths;
      if (!pathsToProcess) {
        const directoryStructure =
          await this.markdownGeneratorFunctions.getDirectoryStructure(
            folderPath,
            this.settings.ignorePatterns
          );

        // Collect all file paths from the structure
        pathsToProcess = [];
        const collectFilePaths = (item) => {
          if (item.type === "file") {
            pathsToProcess.push(item.path);
          } else if (item.children) {
            item.children.forEach(collectFilePaths);
          }
        };

        collectFilePaths(directoryStructure);
      }

      // Generate markdown
      const markdownContent =
        await this.markdownGeneratorFunctions.generateMarkdownContent(
          folderPath,
          pathsToProcess
        );

      // Calculate stats
      const stats = await this.calculateStats(markdownContent);

      return {
        success: true,
        markdownContent,
        stats,
      };
    } finally {
      // Restore original ignore patterns if they were changed
      if (ignorePatterns && originalIgnorePatterns) {
        this.settings.ignorePatterns = originalIgnorePatterns;
      }
    }
  }

  /**
   * Handle the count_tokens tool
   */
  async handleCountTokens(input) {
    const { text, model } = input;

    if (!text) {
      throw new Error("text is required");
    }

    const stats = await this.calculateStats(text);

    return {
      success: true,
      stats,
    };
  }

  /**
   * Handle the get_directory_structure tool
   */
  async handleGetDirectoryStructure(input) {
    const { folderPath, ignorePatterns } = input;

    if (!folderPath) {
      throw new Error("folderPath is required");
    }

    // If ignorePatterns is provided, use it temporarily for this request
    let patternsToUse = ignorePatterns || this.settings.ignorePatterns;

    const directoryStructure =
      await this.markdownGeneratorFunctions.getDirectoryStructure(
        folderPath,
        patternsToUse
      );

    return {
      success: true,
      directoryStructure,
    };
  }

  /**
   * Helper function to calculate stats for generated markdown
   */
  async calculateStats(text) {
    const characterCount = text.length;

    // Count OpenAI tokens
    let openAiTokens = -1;
    try {
      openAiTokens = tokenCounters.countOpenAITokens(text, "gpt-4o");
    } catch (error) {
      console.error("Error counting OpenAI tokens:", error);
    }

    // Count Claude tokens
    let claudeTokens = -1;
    try {
      if (this.settings.anthropicApiKey) {
        claudeTokens = await tokenCounters.countClaudeTokensWithAPI(
          text,
          this.settings.anthropicApiKey
        );
      } else {
        claudeTokens = tokenCounters.countClaudeTokensApprox(text);
      }
    } catch (error) {
      console.error("Error counting Claude tokens:", error);
    }

    return {
      characterCount,
      openAiTokens,
      claudeTokens,
    };
  }

  /**
   * Handle the pack_remote_repository tool
   */
  async handlePackRemoteRepository(input) {
    if (!this.repoMixIntegration) {
      throw new Error("RepoMix integration not initialized");
    }

    const { repoUrl, securityCheck = false, style = "markdown" } = input;

    if (!repoUrl) {
      throw new Error("Missing repoUrl parameter");
    }

    console.log(`Processing remote repository: ${repoUrl}`);

    try {
      const content = await this.repoMixIntegration.processRemoteRepository(
        repoUrl,
        { securityCheck, style }
      );

      const stats = await this.calculateStats(content);

      return {
        content,
        stats,
      };
    } catch (error) {
      throw new Error(`Error processing remote repository: ${error.message}`);
    }
  }

  /**
   * Handle the process_with_security tool
   */
  async handleProcessWithSecurity(input) {
    if (!this.repoMixIntegration) {
      throw new Error("RepoMix integration not initialized");
    }

    const { folderPath, style = "markdown" } = input;

    if (!folderPath) {
      throw new Error("Missing folderPath parameter");
    }

    console.log(`Processing folder with security checks: ${folderPath}`);

    try {
      const content =
        await this.repoMixIntegration.processLocalRepositoryWithSecurity(
          folderPath,
          { style }
        );

      const stats = await this.calculateStats(content);

      return {
        content,
        stats,
      };
    } catch (error) {
      throw new Error(`Error processing with security: ${error.message}`);
    }
  }

  /**
   * Send the initialize result to the client
   */
  sendInitializeResult(id = null) {
    const result = {
      serverName: "Markdown Generator MCP Server",
      serverVersion: "1.0.0",
      protocolVersion: "0.1",
      capabilities: {
        tools: true,
        resources: true,
        prompts: false, // We don't implement prompts
        roots: false, // We don't implement roots
      },
    };

    this.sendResult(id || this.getNextId(), result);
  }

  /**
   * Send a JSON-RPC result response
   */
  sendResult(id, result) {
    const response = {
      jsonrpc: "2.0",
      id,
      result,
    };

    this.sendMessage(response);
  }

  /**
   * Send a JSON-RPC error response
   */
  sendErrorResponse(id, code, message, data = undefined) {
    const response = {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data,
      },
    };

    this.sendMessage(response);
  }

  /**
   * Send a message to the MCP client
   */
  sendMessage(message) {
    const messageStr = JSON.stringify(message);
    process.stdout.write(messageStr + "\n");
  }

  /**
   * Get the next unique message ID
   */
  getNextId() {
    return this.nextId++;
  }

  /**
   * Stop the MCP server
   */
  stop() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }

    console.log("MCP server stopped");
    return Promise.resolve();
  }
}

module.exports = McpServer;
