import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "summarize_video",
    description:
      "Summarize a YouTube video's content. Returns a text summary based on the specified detail level.",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        detail_level: {
          type: "string",
          enum: ["brief", "medium", "detailed"],
          default: "medium",
          description:
            "Level of detail: brief (2-3 sentences), medium (key points with timestamps), detailed (comprehensive breakdown)",
        },
      },
      required: ["youtube_url"],
    },
  },
  {
    name: "ask_about_video",
    description:
      "Ask a specific question about a YouTube video's content. Returns an answer based on the video.",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        question: {
          type: "string",
          description: "Your question about the video content",
        },
      },
      required: ["youtube_url", "question"],
    },
  },
  {
    name: "extract_screenshots",
    description:
      "Extract key screenshots from a YouTube video at important moments. Uses AI to identify visually significant timestamps, then extracts frames. Returns both base64 images and optionally saves to disk.",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        count: {
          type: "number",
          minimum: 1,
          maximum: 20,
          default: 5,
          description: "Number of screenshots to extract (1-20, default: 5)",
        },
        output_dir: {
          type: "string",
          description:
            "Optional directory to save screenshots. If not provided, uses SCREENSHOT_OUTPUT_DIR env var or temp directory.",
        },
        focus: {
          type: "string",
          description:
            "Optional focus for timestamp selection (e.g., 'product demos', 'code examples', 'diagrams'). Default analyzes for general key moments.",
        },
      },
      required: ["youtube_url"],
    },
  },
];
