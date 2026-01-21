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
        resolution: {
          type: "string",
          enum: ["thumbnail", "small", "medium", "large", "full"],
          default: "large",
          description:
            "Output resolution: thumbnail (160p), small (360p), medium (720p), large (1080p), full (original). Default: large",
        },
      },
      required: ["youtube_url"],
    },
  },
  {
    name: "get_video_timestamps",
    description:
      "Preview mode: Use AI to identify important moments in a YouTube video and return their timestamps WITHOUT extracting frames. Use this to preview what timestamps would be selected before committing to extraction.",
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
          description: "Number of timestamps to identify (1-20, default: 5)",
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
  {
    name: "extract_frames",
    description:
      "Extract frames from a YouTube video at specific timestamps you provide. Use this when you already know the exact timestamps you want (e.g., from get_video_timestamps or video summary).",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        timestamps: {
          type: "array",
          items: {
            type: "number",
          },
          minItems: 1,
          maxItems: 20,
          description:
            "Array of timestamps in seconds to extract frames from (e.g., [5, 30, 60, 120])",
        },
        output_dir: {
          type: "string",
          description:
            "Optional directory to save screenshots. If not provided, uses SCREENSHOT_OUTPUT_DIR env var or temp directory.",
        },
        resolution: {
          type: "string",
          enum: ["thumbnail", "small", "medium", "large", "full"],
          default: "large",
          description:
            "Output resolution: thumbnail (160p), small (360p), medium (720p), large (1080p), full (original). Default: large",
        },
      },
      required: ["youtube_url", "timestamps"],
    },
  },
];
