# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is an MCP (Model Context Protocol) server that enables Claude to analyze YouTube videos using Google's Gemini API.

**Key architectural insight:** Gemini can analyze YouTube videos directly via URL using the `fileUri` parameter - no video downloading, transcription APIs, or intermediate processing required.

### Core Components

**`src/index.ts`** - MCP server entry point
- Initializes MCP Server with stdio transport
- Registers request handlers for `ListTools` and `CallTool`
- Routes tool calls to appropriate handlers
- Returns errors in MCP-compliant format (via `content` array with `isError: true`)

**`src/tools.ts`** - Tool definitions
- Exports `TOOLS` array with MCP tool schemas
- `summarize_video`: Takes `youtube_url` and optional `detail_level` (brief/medium/detailed)
- `ask_about_video`: Takes `youtube_url` and `question`

**`src/gemini-client.ts`** - Gemini API wrapper
- `GeminiVideoClient` class handles all Gemini interactions
- Key method: `analyze()` passes YouTube URL directly to Gemini via `fileData.fileUri`
- `DETAIL_PROMPTS` maps detail levels to specific prompt templates
- Custom error types: `VideoAnalysisError`, `VideoAccessError`

**`src/validators.ts`** - Input validation with Zod
- YouTube URL validation supporting: `youtube.com/watch?v=*`, `youtu.be/*`, `youtube.com/shorts/*`
- Zod schemas: `SummarizeInputSchema`, `AskInputSchema`
- Helper functions: `validateYouTubeUrl()`, `extractVideoId()`

### Data Flow

1. MCP client calls tool (e.g., `summarize_video`)
2. `index.ts` parses and validates input with Zod schemas
3. `GeminiVideoClient` constructs prompt based on `detail_level`
4. YouTube URL passed directly to Gemini as `fileData.fileUri`
5. Gemini response returned as MCP `TextContent`

## Development Commands

```bash
# Install dependencies
pnpm install

# Development (hot reload)
pnpm dev

# Build TypeScript
pnpm build

# Run all tests
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run specific test file
pnpm test tests/validators.test.ts

# Start built server
pnpm start
```

## Environment Configuration

Required:
- `GEMINI_API_KEY` - Google AI Studio API key

Optional:
- `GEMINI_MODEL` - Defaults to `gemini-3-flash-preview`

## Testing Notes

- Integration tests require `GEMINI_API_KEY` environment variable
- Tests use real YouTube video: `https://www.youtube.com/watch?v=jNQXAC9IVRw` ("Me at the zoo" - first YouTube video, short and stable)
- Tests are verbose by design for debugging purposes
- Unit tests (validators) run without API key
- Integration tests are skipped if no API key present

## MCP Integration

This server uses stdio transport (not HTTP/SSE). When adding to Claude:

```bash
claude mcp add -s user -e GEMINI_API_KEY=xxx yt-analysis -- node /path/to/dist/index.js
```

The server communicates via stdin/stdout using JSON-RPC 2.0 messages per MCP specification.
