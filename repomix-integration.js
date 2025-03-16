const { exec } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");

/**
 * RepoMix Integration Module for CodeScribe
 *
 * This module provides functionality to integrate RepoMix features
 * into the CodeScribe application, enabling features like remote
 * repository processing, security checks, and enhanced token counting.
 */
class RepoMixIntegration {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), "codescribe-repomix");
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      return true;
    } catch (error) {
      console.error("Failed to initialize RepoMix integration:", error);
      return false;
    }
  }

  /**
   * Run a RepoMix command
   * @param {string} command - The command to run
   * @returns {Promise<string>} - The command output
   */
  runRepoMixCommand(command) {
    return new Promise((resolve, reject) => {
      try {
        // We need to use a different approach for packaged apps
        // Instead of using the module directly, we'll use the CLI command
        // through a spawned process with the npm module path

        // Split the command into arguments
        const args = command.split(" ").filter((arg) => arg.trim() !== "");

        console.log(`Running RepoMix command with args:`, args);

        // Run npm to execute repomix
        const npmProcess = require("child_process").spawn(
          "npm",
          ["exec", "--", "repomix", ...args],
          {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
          }
        );

        let stdout = "";
        let stderr = "";

        npmProcess.stdout.on("data", (data) => {
          stdout += data;
        });

        npmProcess.stderr.on("data", (data) => {
          stderr += data;
        });

        npmProcess.on("close", (code) => {
          if (code !== 0) {
            console.error(`RepoMix error (code ${code}):`, stderr);
            return reject(
              new Error(`RepoMix exited with code ${code}: ${stderr}`)
            );
          }

          if (stderr) {
            console.error(`RepoMix stderr:`, stderr);
          }

          resolve(stdout);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process a remote repository and generate markdown
   * @param {string} repoUrl - The URL of the repository to process
   * @param {Object} options - Processing options
   * @returns {Promise<string>} - The generated markdown content
   */
  async processRemoteRepository(repoUrl, options = {}) {
    const outputFile = path.join(this.tempDir, `repo-${Date.now()}.md`);
    const securityCheck = options.securityCheck ? "--security-check" : "";
    const style = options.style || "markdown";

    // Handle ignore patterns
    let ignoreFlag = "";
    if (
      options.ignorePatterns &&
      Array.isArray(options.ignorePatterns) &&
      options.ignorePatterns.length > 0
    ) {
      // Join patterns with commas for RepoMix
      const ignorePatterns = options.ignorePatterns.join(",");
      ignoreFlag = `--ignore "${ignorePatterns}"`;
    }

    try {
      // Build command with individual arguments, including ignore patterns
      const command = `--remote ${repoUrl} --output ${outputFile} --style ${style} ${securityCheck} ${ignoreFlag}`;

      await this.runRepoMixCommand(command);

      // Check if the output file exists
      try {
        await fs.access(outputFile);
      } catch (error) {
        throw new Error(
          `Output file not created. RepoMix may have failed silently.`
        );
      }

      const content = await fs.readFile(outputFile, "utf8");

      // Clean up
      try {
        await fs.unlink(outputFile);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      return content;
    } catch (error) {
      console.error("Failed to process remote repository:", error);
      throw error;
    }
  }

  /**
   * Process a local repository with security checks
   * @param {string} repoPath - Path to the local repository
   * @param {Object} options - Processing options
   * @returns {Promise<string>} - The processed content
   */
  async processLocalRepositoryWithSecurity(repoPath, options = {}) {
    const outputFile = path.join(this.tempDir, `local-${Date.now()}.md`);
    const style = options.style || "markdown";

    // Handle ignore patterns
    let ignoreFlag = "";
    if (
      options.ignorePatterns &&
      Array.isArray(options.ignorePatterns) &&
      options.ignorePatterns.length > 0
    ) {
      // Join patterns with commas for RepoMix
      const ignorePatterns = options.ignorePatterns.join(",");
      ignoreFlag = `--ignore "${ignorePatterns}"`;
    }

    try {
      // Build command with individual arguments, including ignore patterns
      const command = `--input ${repoPath} --output ${outputFile} --style ${style} --security-check ${ignoreFlag}`;

      await this.runRepoMixCommand(command);

      // Check if the output file exists
      try {
        await fs.access(outputFile);
      } catch (error) {
        throw new Error(
          `Output file not created. RepoMix may have failed silently.`
        );
      }

      const content = await fs.readFile(outputFile, "utf8");

      // Clean up
      try {
        await fs.unlink(outputFile);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      return content;
    } catch (error) {
      console.error("Failed to process local repository:", error);
      throw error;
    }
  }

  /**
   * Get token count for content using RepoMix's accurate counter
   * @param {string} content - Content to count tokens for
   * @param {string} encoding - Token encoding to use
   * @returns {Promise<number>} - Token count
   */
  async getTokenCount(content, encoding = "cl100k_base") {
    try {
      const tempFile = path.join(this.tempDir, `tokens-${Date.now()}.txt`);
      await fs.writeFile(tempFile, content);

      // Build command with individual arguments
      const command = `--input ${tempFile} --count-tokens --encoding ${encoding}`;

      const output = await this.runRepoMixCommand(command);

      // Clean up
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      // Extract token count from output
      const match = output.match(/Token count: (\d+)/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }

      throw new Error("Failed to parse token count from output");
    } catch (error) {
      console.error("Failed to get token count:", error);
      throw error;
    }
  }
}

module.exports = RepoMixIntegration;
