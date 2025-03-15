const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const tokenCounters = require("./tokenCounters");

/**
 * API Server class that provides REST endpoints for the Markdown Generator
 */
class ApiServer {
  /**
   * Create a new API server
   * @param {Object} markdownFunctions - Object containing markdown generation functions
   * @param {Object} settings - User settings
   */
  constructor(markdownFunctions, settings) {
    this.app = express();
    this.server = null;
    this.port = settings.apiServerPort || 69420;
    this.markdownFunctions = markdownFunctions;
    this.settings = settings;

    // Configure Express
    this.app.use(cors());
    this.app.use(bodyParser.json());

    this.setupRoutes();
  }

  /**
   * Set up API routes
   */
  setupRoutes() {
    // API status endpoint
    this.app.get("/api/status", (req, res) => {
      res.json({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    });

    // Get directory structure
    this.app.post("/api/directory", async (req, res) => {
      try {
        if (!req.body.path) {
          return res.status(400).json({ error: "Path is required" });
        }

        const structure = await this.markdownFunctions.getDirectoryStructure(
          req.body.path,
          req.body.ignorePatterns || this.settings.ignorePatterns
        );

        res.json({ success: true, structure });
      } catch (error) {
        console.error("API - Error getting directory structure:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to get directory structure",
        });
      }
    });

    // Generate markdown
    this.app.post("/api/markdown", async (req, res) => {
      try {
        if (!req.body.rootDir) {
          return res.status(400).json({ error: "Root directory is required" });
        }

        if (!req.body.selectedPaths || !Array.isArray(req.body.selectedPaths)) {
          return res
            .status(400)
            .json({ error: "Selected paths must be an array" });
        }

        const markdown = await this.markdownFunctions.generateMarkdownContent(
          req.body.rootDir,
          req.body.selectedPaths
        );

        if (!markdown) {
          return res.status(500).json({
            success: false,
            error: "Failed to generate markdown",
          });
        }

        res.json({
          success: true,
          markdown,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("API - Error generating markdown:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to generate markdown",
        });
      }
    });

    // Get settings
    this.app.get("/api/settings", (req, res) => {
      // Filter out sensitive settings like API keys
      const safeSettings = { ...this.settings };
      delete safeSettings.anthropicApiKey;

      res.json({
        success: true,
        settings: safeSettings,
      });
    });

    // Update settings
    this.app.post("/api/settings", async (req, res) => {
      try {
        if (!req.body.settings) {
          return res.status(400).json({ error: "Settings object is required" });
        }

        // Prevent overwriting sensitive settings via API
        const updatedSettings = {
          ...this.settings,
          ...req.body.settings,
        };

        // Don't allow changing API server port via API to avoid self-disconnection
        updatedSettings.apiServerPort = this.settings.apiServerPort;

        const result = await this.markdownFunctions.saveSettings(
          updatedSettings
        );

        if (!result.success) {
          return res.status(500).json(result);
        }

        this.settings = updatedSettings;
        res.json({ success: true });
      } catch (error) {
        console.error("API - Error updating settings:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to update settings",
        });
      }
    });

    // Fallback for undefined routes
    this.app.use("*", (req, res) => {
      res.status(404).json({
        error: "Not found",
        endpoints: [
          "/api/status",
          "/api/directory",
          "/api/markdown",
          "/api/settings",
        ],
      });
    });
  }

  /**
   * Set the server port
   * @param {number} port - Server port to use
   */
  setPort(port) {
    this.port = port;
  }

  /**
   * Start the API server
   * @returns {Promise} Promise that resolves when server starts
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`API server listening on port ${this.port}`);
          resolve();
        });

        this.server.on("error", (error) => {
          console.error("API server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Failed to start API server:", error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   * @returns {Promise} Promise that resolves when server stops
   */
  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          console.error("Error stopping API server:", error);
          reject(error);
          return;
        }

        this.server = null;
        console.log("API server stopped");
        resolve();
      });
    });
  }
}

module.exports = ApiServer;
