#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS } from "./tools.js";
import { GeminiVideoClient, VideoAnalysisError } from "./gemini-client.js";
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

try {
  geminiClient = new GeminiVideoClient();
} catch (error) {
  console.error(
    "Failed to initialize Gemini client:",
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
        const result = await geminiClient.summarize(
          input.youtube_url,
          input.detail_level as DetailLevel
        );
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "ask_about_video": {
        const input = AskInputSchema.parse(args);
        const result = await geminiClient.ask(input.youtube_url, input.question);
        return {
          content: [{ type: "text", text: result }],
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
