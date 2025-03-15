# Progress Log

## Rebranding to CodeScribe

- Renamed app from "Markdown Generator" to "CodeScribe"
- Updated all references throughout codebase including package.json, README.md, main.js, and index.html
- Improved app description and presentation

## Repository Restructuring

- Archived Python code in a separate `python_archive` directory
- Added python_archive to .gitignore to exclude it from version control
- Moved Electron app to the root directory to make it the primary focus
- Updated package structure for better organization and clarity

## Integrated API and MCP Servers

- Added API server implementation for REST endpoints to generate markdown remotely
- Integrated MCP server to allow AI assistants to interact with the markdown generator
- Added UI controls in settings panel to enable/disable/configure both servers
- Updated package.json to include required dependencies
- Added menu options to control server state
- Updated README with comprehensive instructions for using the API and MCP servers 