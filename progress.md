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

## RepoMix Integration

- Added RepoMix as a dependency to enhance code processing capabilities
- Created a dedicated RepoMix integration module for processing repositories
- Added UI tab and controls for RepoMix features
- Integrated remote repository processing with security checks
- Enhanced token counting with RepoMix's accurate counter
- Updated MCP server to expose RepoMix functionality to AI assistants

## Repository Processing Enhancements

- Rebranded the RepoMix integration as a native "Repository" feature of CodeScribe
- Fixed execution issues with the packaged application by using Node.js to run RepoMix directly
- Added subtle acknowledgment of RepoMix in the README without prominently featuring it in the app UI
- Enhanced Repository feature capabilities with improved error handling

## Bug Fixes and Stability Improvements

- Fixed missing function issue in Repository tab implementation
- Added proper `calculateStats` function for token counting in Repository features
- Improved error handling throughout the application
- Enhanced module loading approach for better stability in packaged application
- Added user's ignore patterns to remote and local repository processing
- Fixed tab switching UI bug that caused incorrect layout when switching between tabs 