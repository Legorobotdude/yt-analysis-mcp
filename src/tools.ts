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
];
