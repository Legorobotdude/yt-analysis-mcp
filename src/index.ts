#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS } from "./tools.js";
import { GeminiVideoClient, VideoAnalysisError } from "./gemini-client.js";
import { YouTubeMetadataClient } from "./youtube-metadata.js";
import {
  SummarizeInputSchema,
  AskInputSchema,
  type DetailLevel,
} from "./validators.js";

const server = new Server(
  {
    name: "yt-analysis-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let geminiClient: GeminiVideoClient;
let youtubeClient: YouTubeMetadataClient | null = null;

try {
  geminiClient = new GeminiVideoClient();

  // Initialize YouTube client if API key is available
  // Can reuse GEMINI_API_KEY if YouTube Data API is enabled in same project
  const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY;
  if (youtubeApiKey) {
    youtubeClient = new YouTubeMetadataClient(youtubeApiKey);
    console.error("YouTube metadata fetching enabled");
  } else {
    console.error("YouTube metadata disabled (no API key)");
  }
} catch (error) {
  console.error(
    "Failed to initialize clients:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "summarize_video": {
        const input = SummarizeInputSchema.parse(args);

        // Fetch metadata and analysis in parallel
        const [metadata, analysis] = await Promise.all([
          youtubeClient?.getMetadata(input.youtube_url).catch(() => null),
          geminiClient.summarize(
            input.youtube_url,
            input.detail_level as DetailLevel
          ),
        ]);

        // Format response with metadata if available
        let response = "";
        if (metadata) {
          response += `# ${metadata.title}\n`;
          response += `**Channel:** ${metadata.channelTitle}\n`;
          response += `**Published:** ${new Date(metadata.publishedAt).toLocaleDateString()}\n\n`;
          response += `---\n\n`;
        }
        response += analysis;

        return {
          content: [{ type: "text", text: response }],
        };
      }

      case "ask_about_video": {
        const input = AskInputSchema.parse(args);

        // Fetch metadata and analysis in parallel
        const [metadata, analysis] = await Promise.all([
          youtubeClient?.getMetadata(input.youtube_url).catch(() => null),
          geminiClient.ask(input.youtube_url, input.question),
        ]);

        // Format response with metadata if available
        let response = "";
        if (metadata) {
          response += `# ${metadata.title}\n`;
          response += `**Channel:** ${metadata.channelTitle}\n\n`;
          response += `---\n\n`;
        }
        response += analysis;

        return {
          content: [{ type: "text", text: response }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError =
      error instanceof Error && error.name === "ZodError";

    return {
      content: [
        {
          type: "text",
          text: isValidationError
            ? `Validation error: ${message}`
            : error instanceof VideoAnalysisError
              ? message
              : `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("YouTube Analysis MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
