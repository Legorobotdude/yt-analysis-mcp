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
      "RECOMMENDED: Extract key screenshots from a YouTube video. Uses AI to automatically identify the most visually significant moments and extracts frames at those timestamps. This is the default tool for getting screenshots - use this unless you have a specific reason to manually specify timestamps.",
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
      "RARELY NEEDED: Preview AI-selected timestamps without extracting frames. Only use this if you need to see what timestamps would be selected before extraction, or if you want to manually filter/modify the timestamps before passing them to extract_frames. In most cases, just use extract_screenshots directly.",
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
      "ADVANCED: Extract frames at specific timestamps YOU provide. DO NOT USE THIS unless you already have exact timestamps from another source (e.g., user specified '2:30 and 5:15', or you got timestamps from get_video_timestamps/search_in_video). For general screenshot extraction, use extract_screenshots instead - it uses AI to pick the best moments automatically.",
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
  {
    name: "get_transcript",
    description:
      "Get the full transcript of a YouTube video with timestamps. Tries native captions first (faster, more accurate), falls back to AI transcription if unavailable.",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        include_timestamps: {
          type: "boolean",
          default: true,
          description: "Whether to include timestamps in the output (default: true)",
        },
        format: {
          type: "string",
          enum: ["text", "json", "srt", "vtt"],
          default: "text",
          description:
            "Output format: text (readable), json (structured), srt (SubRip subtitles), vtt (WebVTT subtitles). Default: text",
        },
        language: {
          type: "string",
          default: "en",
          description:
            "Preferred language code for captions (e.g., 'en', 'es', 'fr'). Default: 'en'",
        },
      },
      required: ["youtube_url"],
    },
  },
  {
    name: "search_in_video",
    description:
      "Search for specific content, topics, or mentions within a YouTube video. Returns timestamps where the content appears.",
    inputSchema: {
      type: "object",
      properties: {
        youtube_url: {
          type: "string",
          description:
            "Full YouTube URL (youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID)",
        },
        query: {
          type: "string",
          description:
            "What to search for (topic, phrase, visual element, person, etc.)",
        },
        search_type: {
          type: "string",
          enum: ["visual", "audio", "both"],
          default: "both",
          description:
            "Where to search: visual (on-screen elements), audio (spoken content), both (default)",
        },
      },
      required: ["youtube_url", "query"],
    },
  },
  {
    name: "search_youtube",
    description:
      "Search YouTube for videos matching a query. Returns video titles, descriptions, channels, and URLs. Use this to find videos before analyzing them with other tools.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms to find YouTube videos",
        },
        max_results: {
          type: "number",
          minimum: 1,
          maximum: 25,
          default: 5,
          description: "Maximum number of results to return (1-25, default: 5)",
        },
      },
      required: ["query"],
    },
  },
];
