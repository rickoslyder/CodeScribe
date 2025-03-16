const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const ApiServer = require("./api-server");
const McpServer = require("./mcp-server");
const RepoMixIntegration = require("./repomix-integration");

let mainWindow;
// Default ignore patterns
const defaultIgnorePatterns = [
  "node_modules",
  ".git",
  "**/dist",
  "**/build",
  "**/.DS_Store",
  "**/.env",
  "**/*.log",
  "**/*.lock",
  "**/.package-lock.json",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.bmp",
  "**/*.tiff",
  "**/*.webp",
  "**/*.ico",
  "**/*.icns",
  "**/*.dmg",
  "**/*.zip",
  "**/*.deb",
  "**/*.rpm",
  "**/*.msi",
  "**/*.exe",
  "**/*.app",
];

// User settings with defaults
let userSettings = {
  ignorePatterns: [...defaultIgnorePatterns],
  anthropicApiKey: "", // Empty by default
  apiServerEnabled: false,
  apiServerPort: 69420,
  mcpServerEnabled: false,
};

// API server instance
let apiServer = null;
let mcpServer = null;
let repoMixIntegration = null;

// Markdown generator functions shared with the API server
const markdownGeneratorFunctions = {
  getDirectoryStructure,
  generateMarkdownContent,
  saveSettings,
};

// Attempt to load settings from file
function loadSettings() {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, "utf8");
      const savedSettings = JSON.parse(settingsData);
      userSettings = { ...userSettings, ...savedSettings };
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return userSettings;
}

// Save settings to file
async function saveSettings(settings) {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  try {
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    userSettings = settings;
    return { success: true };
  } catch (error) {
    console.error("Error saving settings:", error);
    return { success: false, error: error.message };
  }
}

// Start the API server if enabled
function startApiServer() {
  if (userSettings.apiServerEnabled && !apiServer) {
    apiServer = new ApiServer(markdownGeneratorFunctions, userSettings);
    apiServer.setPort(userSettings.apiServerPort);
    apiServer
      .start()
      .then(() => {
        console.log(`API server started on port ${userSettings.apiServerPort}`);
        if (mainWindow) {
          mainWindow.webContents.send("api-server-status", {
            running: true,
            port: userSettings.apiServerPort,
          });
        }
      })
      .catch((error) => {
        console.error("Failed to start API server:", error);
        if (mainWindow) {
          mainWindow.webContents.send("api-server-status", {
            running: false,
            error: error.message,
          });
        }
      });
  }
}

// Stop the API server
function stopApiServer() {
  if (apiServer) {
    apiServer
      .stop()
      .then(() => {
        console.log("API server stopped");
        apiServer = null;
        if (mainWindow) {
          mainWindow.webContents.send("api-server-status", { running: false });
        }
      })
      .catch((error) => {
        console.error("Error stopping API server:", error);
      });
  }
}

// Start the MCP server if enabled
function startMcpServer() {
  if (userSettings.mcpServerEnabled && !mcpServer) {
    mcpServer = new McpServer(
      markdownGeneratorFunctions,
      userSettings,
      repoMixIntegration
    );
    mcpServer
      .start()
      .then(() => {
        console.log("MCP server started");
        if (mainWindow) {
          mainWindow.webContents.send("mcp-server-status", { running: true });
        }
      })
      .catch((error) => {
        console.error("Failed to start MCP server:", error);
        if (mainWindow) {
          mainWindow.webContents.send("mcp-server-status", {
            running: false,
            error: error.message,
          });
        }
      });
  }
}

// Stop the MCP server
function stopMcpServer() {
  if (mcpServer) {
    mcpServer
      .stop()
      .then(() => {
        console.log("MCP server stopped");
        mcpServer = null;
        if (mainWindow) {
          mainWindow.webContents.send("mcp-server-status", { running: false });
        }
      })
      .catch((error) => {
        console.error("Error stopping MCP server:", error);
      });
  }
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Initialize RepoMix integration
  repoMixIntegration = new RepoMixIntegration();
  repoMixIntegration.initialize().then((success) => {
    if (success) {
      console.log("RepoMix integration initialized successfully");
    } else {
      console.error("Failed to initialize RepoMix integration");
    }
  });

  // Open DevTools during development
  // mainWindow.webContents.openDevTools();

  // Create the application menu
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Server",
      submenu: [
        {
          label: "API Server",
          submenu: [
            {
              id: "toggle-api-server",
              label: userSettings.apiServerEnabled
                ? "Stop API Server"
                : "Start API Server",
              click: () => {
                if (userSettings.apiServerEnabled) {
                  userSettings.apiServerEnabled = false;
                  stopApiServer();
                } else {
                  userSettings.apiServerEnabled = true;
                  startApiServer();
                }
                saveSettings(userSettings);

                // Update menu label
                const menu = Menu.getApplicationMenu();
                const menuItem = menu.getMenuItemById("toggle-api-server");
                if (menuItem) {
                  menuItem.label = userSettings.apiServerEnabled
                    ? "Stop API Server"
                    : "Start API Server";
                }
              },
            },
            {
              label: "Configure API Server",
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.send("show-api-server-config");
                }
              },
            },
          ],
        },
        {
          label: "MCP Server",
          submenu: [
            {
              id: "toggle-mcp-server",
              label: userSettings.mcpServerEnabled
                ? "Stop MCP Server"
                : "Start MCP Server",
              click: () => {
                if (userSettings.mcpServerEnabled) {
                  userSettings.mcpServerEnabled = false;
                  stopMcpServer();
                } else {
                  userSettings.mcpServerEnabled = true;
                  startMcpServer();
                }
                saveSettings(userSettings);

                // Update menu label
                const menu = Menu.getApplicationMenu();
                const menuItem = menu.getMenuItemById("toggle-mcp-server");
                if (menuItem) {
                  menuItem.label = userSettings.mcpServerEnabled
                    ? "Stop MCP Server"
                    : "Start MCP Server";
                }
              },
            },
            {
              label: "Run MCP CLI Tool",
              click: () => {
                const { spawn } = require("child_process");
                const settingsPath = path.join(
                  app.getPath("userData"),
                  "settings.json"
                );
                const mcpCliPath = path.join(__dirname, "mcp-cli.js");

                // Make the script executable (Unix-like systems)
                try {
                  fs.chmodSync(mcpCliPath, "755");
                } catch (error) {
                  console.error(
                    "Error making MCP CLI script executable:",
                    error
                  );
                }

                const child = spawn(mcpCliPath, [settingsPath], {
                  detached: true,
                  stdio: "ignore",
                });

                child.unref();

                if (mainWindow) {
                  mainWindow.webContents.send("mcp-cli-started");
                }
              },
            },
          ],
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: "About CodeScribe",
              message: "CodeScribe - Code to Markdown Generator v1.0.0",
              detail:
                "An elegant application to generate documentation from source code files.\n\n" +
                "Features:\n" +
                "- Select specific files/folders to include\n" +
                "- Generate token counts for AI models\n" +
                "- REST API server for remote access\n" +
                "- MCP server for AI assistants integration",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Load settings first
  loadSettings();
  createWindow();

  // Start servers if enabled
  if (userSettings.apiServerEnabled) {
    startApiServer();
  }

  if (userSettings.mcpServerEnabled) {
    startMcpServer();
  }
});

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});

// Ensure proper cleanup on app exit
app.on("will-quit", (event) => {
  // Stop both servers if running
  if (apiServer || mcpServer) {
    event.preventDefault();

    Promise.all([
      apiServer ? apiServer.stop() : Promise.resolve(),
      mcpServer ? mcpServer.stop() : Promise.resolve(),
    ])
      .then(() => {
        app.quit();
      })
      .catch((error) => {
        console.error("Error stopping servers:", error);
        app.quit();
      });
  }
});

// Handle folder selection
ipcMain.handle("select-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

// Get settings
ipcMain.handle("get-settings", async () => {
  return userSettings;
});

// Save settings
ipcMain.handle("save-settings", async (event, settings) => {
  const result = await saveSettings(settings);

  // Update API server if it's running and port changed
  if (
    apiServer &&
    settings.apiServerEnabled &&
    settings.apiServerPort !== userSettings.apiServerPort
  ) {
    apiServer.setPort(settings.apiServerPort);
  }

  // Start/stop API server if the enabled state changed
  if (settings.apiServerEnabled !== userSettings.apiServerEnabled) {
    if (settings.apiServerEnabled) {
      startApiServer();
    } else {
      stopApiServer();
    }

    // Update menu label
    const menu = Menu.getApplicationMenu();
    const menuItem = menu.getMenuItemById("toggle-api-server");
    if (menuItem) {
      menuItem.label = settings.apiServerEnabled
        ? "Stop API Server"
        : "Start API Server";
    }
  }

  // Start/stop MCP server if the enabled state changed
  if (settings.mcpServerEnabled !== userSettings.mcpServerEnabled) {
    if (settings.mcpServerEnabled) {
      startMcpServer();
    } else {
      stopMcpServer();
    }

    // Update menu label
    const menu = Menu.getApplicationMenu();
    const menuItem = menu.getMenuItemById("toggle-mcp-server");
    if (menuItem) {
      menuItem.label = settings.mcpServerEnabled
        ? "Stop MCP Server"
        : "Start MCP Server";
    }
  }

  return result;
});

// Get files in directory with structure for selection
ipcMain.handle("get-directory-structure", async (event, rootDir) => {
  try {
    return await getDirectoryStructure(rootDir, userSettings.ignorePatterns);
  } catch (error) {
    console.error("Error getting directory structure:", error);
    return { success: false, error: error.message };
  }
});

// Handle markdown save
ipcMain.handle("save-markdown", async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save Markdown File",
    defaultPath: path.join(app.getPath("downloads"), "code_markdown.md"),
    filters: [{ name: "Markdown Files", extensions: ["md"] }],
  });

  if (!canceled && filePath) {
    try {
      await writeFile(filePath, content, "utf8");
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Operation cancelled" };
});

// Get API server status
ipcMain.handle("get-api-server-status", async () => {
  return {
    running: apiServer !== null,
    enabled: userSettings.apiServerEnabled,
    port: userSettings.apiServerPort,
  };
});

// Get MCP server status
ipcMain.handle("get-mcp-server-status", async () => {
  return {
    running: mcpServer !== null,
    enabled: userSettings.mcpServerEnabled,
  };
});

// Start API server
ipcMain.handle("start-api-server", async () => {
  if (apiServer) {
    return { success: false, error: "API server already running" };
  }

  userSettings.apiServerEnabled = true;
  await saveSettings(userSettings);

  try {
    startApiServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop API server
ipcMain.handle("stop-api-server", async () => {
  if (!apiServer) {
    return { success: false, error: "API server not running" };
  }

  userSettings.apiServerEnabled = false;
  await saveSettings(userSettings);

  try {
    stopApiServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start MCP server
ipcMain.handle("start-mcp-server", async () => {
  if (mcpServer) {
    return { success: false, error: "MCP server already running" };
  }

  userSettings.mcpServerEnabled = true;
  await saveSettings(userSettings);

  try {
    startMcpServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop MCP server
ipcMain.handle("stop-mcp-server", async () => {
  if (!mcpServer) {
    return { success: false, error: "MCP server not running" };
  }

  userSettings.mcpServerEnabled = false;
  await saveSettings(userSettings);

  try {
    stopMcpServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle markdown generation with selected files
ipcMain.handle("generate-markdown", async (event, rootDir, selectedPaths) => {
  try {
    return await generateMarkdownContent(rootDir, selectedPaths);
  } catch (error) {
    console.error("Error generating markdown:", error);
    return null;
  }
});

// Get directory structure with selectable files/folders
async function getDirectoryStructure(rootDir, ignorePatterns = []) {
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
        const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
        return new RegExp(`^${regexPattern}$`).test(name);
      }
      // Check if it's a direct match
      return relativePath.includes(pattern) || name === pattern;
    });
  }

  async function processDirectory(dir, parent) {
    const entries = await readdir(dir, { withFileTypes: true });

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
}

// Generate markdown content with selected files
async function generateMarkdownContent(rootDir, selectedPaths) {
  let content = "";
  let totalFiles = selectedPaths.length;
  let processedFiles = 0;

  for (const filePath of selectedPaths) {
    try {
      const relativePath = path.relative(rootDir, filePath);
      content += `## ${relativePath}\n\n`;

      const fileContent = await readFile(filePath, "utf8");
      const extension = path.extname(filePath).slice(1);
      const lang = extension || "";

      content += `\`\`\`${lang}\n${fileContent}\n\`\`\`\n\n`;

      processedFiles++;
      const progress = Math.floor((processedFiles / totalFiles) * 100);
      sendProgress(null, progress);
    } catch (error) {
      content += `Error reading file: ${error.message}\n\n`;
      processedFiles++;
    }
  }

  return content;
}

// Function to update progress
function sendProgress(event, progress) {
  if (mainWindow) {
    mainWindow.webContents.send("generation-progress", progress);
  }
}

/**
 * Calculate text statistics like token counts
 * @param {string} text - The text to calculate stats for
 * @returns {Promise<Object>} - Statistics object
 */
async function calculateStats(text) {
  try {
    // Import token counter module
    const tokenCounters = require("./tokenCounters");

    // Character count
    const charCount = text.length;

    // OpenAI tokens
    let openAiTokens = 0;
    try {
      openAiTokens = tokenCounters.countOpenAITokens(text, "gpt-4o");
    } catch (error) {
      console.error("Error counting OpenAI tokens:", error);
      openAiTokens = -1;
    }

    // Claude tokens (approximation)
    let claudeTokens = 0;
    try {
      claudeTokens = tokenCounters.countClaudeTokensApprox(text);
    } catch (error) {
      console.error("Error counting Claude tokens:", error);
      claudeTokens = -1;
    }

    return {
      charCount,
      openAiTokens,
      claudeTokens,
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    return { charCount: 0, openAiTokens: -1, claudeTokens: -1 };
  }
}

// IPC handlers for RepoMix integration
ipcMain.handle("process-remote-repository", async (event, repoUrl, options) => {
  try {
    if (!repoMixIntegration) {
      throw new Error("RepoMix integration not initialized");
    }

    // Update progress
    sendProgress(event, {
      total: 100,
      current: 10,
      message: "Fetching remote repository...",
    });

    // Include the user's ignore patterns in the options
    const optionsWithIgnorePatterns = {
      ...options,
      ignorePatterns: userSettings.ignorePatterns,
    };

    const content = await repoMixIntegration.processRemoteRepository(
      repoUrl,
      optionsWithIgnorePatterns
    );

    // Update progress
    sendProgress(event, {
      total: 100,
      current: 90,
      message: "Processing complete...",
    });

    // Calculate stats
    const stats = await calculateStats(content);

    return { content, stats };
  } catch (error) {
    console.error("Error processing remote repository:", error);
    throw error;
  } finally {
    // Complete progress
    sendProgress(event, { total: 100, current: 100, message: "Done" });
  }
});

ipcMain.handle(
  "process-local-repository-with-security",
  async (event, repoPath, options) => {
    try {
      if (!repoMixIntegration) {
        throw new Error("RepoMix integration not initialized");
      }

      // Update progress
      sendProgress(event, {
        total: 100,
        current: 10,
        message: "Processing local repository with security checks...",
      });

      // Include the user's ignore patterns in the options
      const optionsWithIgnorePatterns = {
        ...options,
        ignorePatterns: userSettings.ignorePatterns,
      };

      const content =
        await repoMixIntegration.processLocalRepositoryWithSecurity(
          repoPath,
          optionsWithIgnorePatterns
        );

      // Update progress
      sendProgress(event, {
        total: 100,
        current: 90,
        message: "Processing complete...",
      });

      // Calculate stats
      const stats = await calculateStats(content);

      return { content, stats };
    } catch (error) {
      console.error("Error processing local repository with security:", error);
      throw error;
    } finally {
      // Complete progress
      sendProgress(event, { total: 100, current: 100, message: "Done" });
    }
  }
);

ipcMain.handle(
  "count-tokens-with-repomix",
  async (event, content, encoding) => {
    try {
      if (!repoMixIntegration) {
        throw new Error("RepoMix integration not initialized");
      }

      const tokenCount = await repoMixIntegration.getTokenCount(
        content,
        encoding
      );
      return tokenCount;
    } catch (error) {
      console.error("Error counting tokens with RepoMix:", error);
      throw error;
    }
  }
);
