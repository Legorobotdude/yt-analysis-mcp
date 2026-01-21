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
  ScreenshotExtractor,
  DependencyError,
  ScreenshotExtractionError,
} from "./screenshot-extractor.js";
import {
  SummarizeInputSchema,
  AskInputSchema,
  ExtractScreenshotsInputSchema,
  GetVideoTimestampsInputSchema,
  ExtractFramesInputSchema,
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
const screenshotExtractor = new ScreenshotExtractor();

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

      case "extract_screenshots": {
        const input = ExtractScreenshotsInputSchema.parse(args);

        // Step 1: Get timestamps from Gemini
        const timestampResult = await geminiClient.extractTimestamps(
          input.youtube_url,
          input.count,
          input.focus
        );

        // Step 2: Extract screenshots at those timestamps
        const screenshots = await screenshotExtractor.extractScreenshots(
          input.youtube_url,
          timestampResult.timestamps,
          {
            outputDir: input.output_dir,
            resolution: input.resolution,
          }
        );

        // Step 3: Build MCP response with images
        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];

        // Format duration
        const durationMin = Math.floor(timestampResult.video_duration_seconds / 60);
        const durationSec = timestampResult.video_duration_seconds % 60;
        const durationStr = `${durationMin}:${String(Math.floor(durationSec)).padStart(2, "0")}`;

        // Add summary text
        const summaryLines = screenshots.map(
          (s, i) =>
            `${i + 1}. [${s.timestamp_formatted}] ${s.description}${s.filePath ? `\n   Saved to: ${s.filePath}` : ""}`
        );

        content.push({
          type: "text",
          text:
            `Extracted ${screenshots.length} screenshots from video (duration: ${durationStr}, resolution: ${input.resolution})\n\n` +
            summaryLines.join("\n"),
        });

        // Add images
        for (const screenshot of screenshots) {
          content.push({
            type: "image",
            data: screenshot.base64,
            mimeType: screenshot.mimeType,
          });
        }

        return { content };
      }

      case "get_video_timestamps": {
        const input = GetVideoTimestampsInputSchema.parse(args);

        // Get timestamps from Gemini without extracting frames
        const timestampResult = await geminiClient.extractTimestamps(
          input.youtube_url,
          input.count,
          input.focus
        );

        // Format duration
        const durationMin = Math.floor(timestampResult.video_duration_seconds / 60);
        const durationSec = timestampResult.video_duration_seconds % 60;
        const durationStr = `${durationMin}:${String(Math.floor(durationSec)).padStart(2, "0")}`;

        // Build response text
        const lines = timestampResult.timestamps.map(
          (ts, i) => `${i + 1}. [${ts.time_formatted}] (${ts.time_seconds}s) - ${ts.description}`
        );

        const response =
          `Video duration: ${durationStr}\n\n` +
          `Identified ${timestampResult.timestamps.length} key timestamps:\n\n` +
          lines.join("\n") +
          `\n\nUse extract_frames with these timestamps to extract the frames.`;

        return {
          content: [{ type: "text", text: response }],
        };
      }

      case "extract_frames": {
        const input = ExtractFramesInputSchema.parse(args);

        // Extract frames at the specified timestamps
        const screenshots = await screenshotExtractor.extractFramesAtTimestamps(
          input.youtube_url,
          input.timestamps,
          {
            outputDir: input.output_dir,
            resolution: input.resolution,
          }
        );

        // Build MCP response with images
        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];

        // Add summary text
        const summaryLines = screenshots.map(
          (s, i) =>
            `${i + 1}. [${s.timestamp_formatted}]${s.filePath ? ` - Saved to: ${s.filePath}` : ""}`
        );

        content.push({
          type: "text",
          text:
            `Extracted ${screenshots.length} frames (resolution: ${input.resolution})\n\n` +
            summaryLines.join("\n"),
        });

        // Add images
        for (const screenshot of screenshots) {
          content.push({
            type: "image",
            data: screenshot.base64,
            mimeType: screenshot.mimeType,
          });
        }

        return { content };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError =
      error instanceof Error && error.name === "ZodError";

    let errorText: string;
    if (isValidationError) {
      errorText = `Validation error: ${message}`;
    } else if (error instanceof DependencyError) {
      errorText = `Dependency error: ${message}`;
    } else if (error instanceof ScreenshotExtractionError) {
      errorText = `Screenshot extraction failed: ${message}`;
    } else if (error instanceof VideoAnalysisError) {
      errorText = message;
    } else {
      errorText = `Error: ${message}`;
    }

    return {
      content: [
        {
          type: "text",
          text: errorText,
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
