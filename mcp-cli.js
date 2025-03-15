#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const McpServer = require("./mcp-server");
const tokenCounters = require("./tokenCounters");

// Load the markdown generator functions
const markdownGeneratorFunctions = {
  async getDirectoryStructure(rootDir, ignorePatterns = []) {
    const fs = require("fs").promises;
    const path = require("path");

    const structure = {
      name: path.basename(rootDir),
      path: rootDir,
      type: "directory",
      children: [],
      selected: true,
    };

    // Function to check if a path should be ignored
    function shouldIgnore(itemPath) {
      const relativePath = path.relative(rootDir, itemPath);
      const name = path.basename(itemPath);

      return ignorePatterns.some((pattern) => {
        // Check if it's a glob pattern with wildcard
        if (pattern.includes("*")) {
          const regexPattern = pattern
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*");
          return new RegExp(`^${regexPattern}$`).test(name);
        }
        // Check if it's a direct match
        return relativePath.includes(pattern) || name === pattern;
      });
    }

    async function processDirectory(dir, parent) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip if it matches ignore patterns
        if (shouldIgnore(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          const dirItem = {
            name: entry.name,
            path: fullPath,
            type: "directory",
            children: [],
            selected: true,
          };
          parent.children.push(dirItem);
          await processDirectory(fullPath, dirItem);
        } else {
          parent.children.push({
            name: entry.name,
            path: fullPath,
            type: "file",
            selected: true,
          });
        }
      }
    }

    await processDirectory(rootDir, structure);
    return structure;
  },

  async generateMarkdownContent(rootDir, selectedPaths) {
    const fs = require("fs").promises;
    const path = require("path");

    let content = "";
    let totalFiles = selectedPaths.length;
    let processedFiles = 0;

    for (const filePath of selectedPaths) {
      try {
        const relativePath = path.relative(rootDir, filePath);
        content += `## ${relativePath}\n\n`;

        const fileContent = await fs.readFile(filePath, "utf8");
        const extension = path.extname(filePath).slice(1);
        const lang = extension || "";

        content += `\`\`\`${lang}\n${fileContent}\n\`\`\`\n\n`;

        processedFiles++;
        const progress = Math.floor((processedFiles / totalFiles) * 100);

        // Report progress (won't actually do anything in CLI mode)
        if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
          console.error(`Progress: ${progress}%`);
        }
      } catch (error) {
        content += `Error reading file: ${error.message}\n\n`;
        processedFiles++;
      }
    }

    return content;
  },

  async saveSettings(settings) {
    // In CLI mode, we don't persist settings
    return { success: true };
  },
};

// Load or create settings
let settings = {
  ignorePatterns: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".DS_Store",
    ".env",
    "*.log",
    "*.lock",
    "package-lock.json",
    "*.min.js",
    "*.min.css",
  ],
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
};

// Try to load settings from a file if provided
const settingsPath = process.argv[2];
if (settingsPath && fs.existsSync(settingsPath)) {
  try {
    const settingsData = fs.readFileSync(settingsPath, "utf8");
    const loadedSettings = JSON.parse(settingsData);
    settings = { ...settings, ...loadedSettings };
    console.error(`Loaded settings from ${settingsPath}`);
  } catch (error) {
    console.error(`Error loading settings from ${settingsPath}:`, error);
  }
}

// Create and start the MCP server
const mcpServer = new McpServer(markdownGeneratorFunctions, settings);
mcpServer.start();

// Handle process termination
process.on("SIGINT", () => {
  console.error("Received SIGINT. Shutting down...");
  mcpServer.stop().then(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.error("Received SIGTERM. Shutting down...");
  mcpServer.stop().then(() => {
    process.exit(0);
  });
});
