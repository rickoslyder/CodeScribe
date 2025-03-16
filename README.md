# CodeScribe - Code to Markdown Generator

An elegant application to generate markdown documentation from your code files.

## Features

- Select a folder to scan for code files
- Generate a markdown document containing all file contents with syntax highlighting
- View the generated markdown directly in the app
- Save the markdown to a file on your computer
- Process entire remote repositories directly from GitHub URLs
- Security scanning to detect and filter sensitive information
- Advanced token counting for AI models (GPT-4o, Claude)
- REST API server for remote access to documentation generation functionality
- Model Context Protocol (MCP) server for AI assistants integration

## Installation

```bash
# Clone the repository
git clone https://github.com/rickoslyder/codescribe.git

# Navigate to the project folder
cd codescribe

# Install dependencies
npm install
```

## Development

```bash
# Run the app in development mode
npm start
```

## Building the App

```bash
# Build for your current platform
npm run build

# Build for specific platforms
npm run build -- --mac
npm run build -- --windows
npm run build -- --linux
```

The built application will be in the `dist` folder.

## How It Works

1. CodeScribe scans the selected directory recursively
2. For each file found, it reads the content and formats it as markdown
3. Files are displayed with their paths as headers
4. Code is syntax-highlighted based on the file extension

## API Server

The application includes a REST API server that allows you to access documentation generation functionality from external applications.

### Enabling the API Server

1. Open the app and go to the Settings tab
2. In the API Server section, check the "Enable API server" checkbox
3. Set the desired port (default is 69420)
4. Click "Save Settings"

Alternatively, you can enable/disable the API server from the application menu: Server > API Server > Start/Stop API Server.

### API Endpoints

- `GET /api/status` - Get the API server status
- `POST /api/directory` - Get the directory structure of a specified path
  ```json
  {
    "path": "/path/to/your/folder",
    "ignorePatterns": ["node_modules", ".git"]
  }
  ```
- `POST /api/markdown` - Generate markdown from selected files
  ```json
  {
    "rootDir": "/path/to/your/folder",
    "selectedPaths": [
      "/path/to/your/folder/file1.js",
      "/path/to/your/folder/file2.js"
    ]
  }
  ```
- `GET /api/settings` - Get current settings (excluding sensitive information)
- `POST /api/settings` - Update settings
  ```json
  {
    "settings": {
      "ignorePatterns": ["node_modules", ".git", "dist"]
    }
  }
  ```

## MCP Server

The application includes a Model Context Protocol (MCP) server that allows AI assistants to interact with CodeScribe.

### Enabling the MCP Server

1. Open the app and go to the Settings tab
2. In the MCP Server section, check the "Enable MCP server" checkbox
3. Click "Save Settings"

Alternatively, you can enable/disable the MCP server from the application menu: Server > MCP Server > Start/Stop MCP Server.

### Running MCP CLI Tool

For advanced users, you can run the MCP server as a standalone CLI tool:

1. From the application menu, select: Server > MCP Server > Run MCP CLI Tool
2. This will start the MCP server in a separate process using your saved settings

You can also run the CLI tool directly:

```bash
# Make sure the script is executable
chmod +x ./mcp-cli.js

# Run with default settings
./mcp-cli.js

# Run with a specific settings file
./mcp-cli.js /path/to/settings.json
```

### MCP Capabilities

The MCP server provides the following functionality to AI assistants:

- Directory structure retrieval
- Documentation generation from specified files
- Settings management
- Repository processing with security checks
- Remote repository fetching and analysis

MCP is an open protocol developed by Anthropic, designed to allow AI assistants to interact with external tools and services.

## License

ISC 

## Acknowledgments

CodeScribe's repository processing capabilities are powered in part by [RepoMix](https://github.com/yamadashy/repomix), an open-source tool for packaging repositories.