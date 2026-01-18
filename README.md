# yt-analysis-mcp

An MCP server that analyzes YouTube videos using Google's Gemini API. Pass in a YouTube URL to get summaries or ask questions about the video content.

## Features

- **Summarize videos** - Get brief, medium, or detailed summaries with timestamps
- **Ask questions** - Ask specific questions about video content
- **Direct URL support** - No video downloading required; Gemini analyzes YouTube URLs directly

## Installation

```bash
git clone https://github.com/yourusername/yt-analysis-mcp.git
cd yt-analysis-mcp
pnpm install
pnpm build
```

## Configuration

Set your Gemini API key:

```bash
export GEMINI_API_KEY=your-api-key
```

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Usage

### Claude Code

```bash
claude mcp add -s user -e GEMINI_API_KEY=your-key yt-analysis -- node /path/to/yt-analysis-mcp/dist/index.js
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yt-analysis": {
      "command": "node",
      "args": ["/path/to/yt-analysis-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

## Tools

### `summarize_video`

Summarize a YouTube video's content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `youtube_url` | string | Yes | Full YouTube URL |
| `detail_level` | string | No | `brief`, `medium` (default), or `detailed` |

### `ask_about_video`

Ask a specific question about a YouTube video's content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `youtube_url` | string | Yes | Full YouTube URL |
| `question` | string | Yes | Your question about the video |

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/shorts/VIDEO_ID`

## Development

```bash
# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

## License

MIT
