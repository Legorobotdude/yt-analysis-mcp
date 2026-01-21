import { GoogleGenAI } from "@google/genai";
import type { DetailLevel } from "./validators.js";

export class VideoAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoAnalysisError";
  }
}

export class VideoAccessError extends VideoAnalysisError {
  constructor(url: string, cause?: Error) {
    super(
      `Cannot access video: ${url}. Ensure video is public and not geo-restricted.`
    );
    this.name = "VideoAccessError";
    this.cause = cause;
  }
}

const DETAIL_PROMPTS: Record<DetailLevel, string> = {
  brief: "Summarize this video in 2-3 sentences, capturing the main point.",
  medium:
    "Summarize this video with key points. Include timestamps (MM:SS format) for important moments.",
  detailed:
    "Provide a comprehensive breakdown of this video. Include: main topics, key points with timestamps, important quotes or statements, and a conclusion.",
};

export interface TimestampResult {
  timestamps: Array<{
    time_seconds: number;
    time_formatted: string;
    description: string;
  }>;
  video_duration_seconds: number;
}

const TIMESTAMP_EXTRACTION_PROMPT = `Analyze this video and identify the most visually important moments that would make good screenshots.

Return EXACTLY a JSON object with this structure (no markdown, no code blocks, just raw JSON):
{
  "timestamps": [
    {
      "time_seconds": <number>,
      "time_formatted": "<MM:SS or HH:MM:SS>",
      "description": "<brief description of what makes this moment visually significant>"
    }
  ],
  "video_duration_seconds": <number>
}

Selection criteria for timestamps:
- Scene changes or transitions
- Key visual demonstrations or examples
- Important diagrams, charts, or text on screen
- Product reveals or feature demonstrations
- Moments with clear, non-blurry frames
- Diverse coverage across the video timeline (not clustered)

Return exactly {count} timestamps, evenly distributed when possible.
{focus_instruction}`;

export class GeminiVideoClient {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required. Set it before starting the server."
      );
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  }

  async summarize(youtubeUrl: string, detailLevel: DetailLevel): Promise<string> {
    const prompt = DETAIL_PROMPTS[detailLevel];
    return this.analyze(youtubeUrl, prompt);
  }

  async ask(youtubeUrl: string, question: string): Promise<string> {
    const prompt = `Based on this video, answer the following question:\n\n${question}`;
    return this.analyze(youtubeUrl, prompt);
  }

  async extractTimestamps(
    youtubeUrl: string,
    count: number,
    focus?: string
  ): Promise<TimestampResult> {
    const focusInstruction = focus
      ? `\n\nFocus especially on: ${focus}`
      : "";

    const prompt = TIMESTAMP_EXTRACTION_PROMPT
      .replace("{count}", String(count))
      .replace("{focus_instruction}", focusInstruction);

    const response = await this.analyze(youtubeUrl, prompt);

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const result = JSON.parse(jsonStr) as TimestampResult;

      // Validate structure
      if (!Array.isArray(result.timestamps)) {
        throw new Error("Invalid response: timestamps must be an array");
      }

      // Ensure time_seconds is present and valid
      for (const ts of result.timestamps) {
        if (typeof ts.time_seconds !== "number" || ts.time_seconds < 0) {
          throw new Error(`Invalid timestamp: ${JSON.stringify(ts)}`);
        }
      }

      return result;
    } catch (error) {
      throw new VideoAnalysisError(
        `Failed to parse timestamp response: ${error instanceof Error ? error.message : error}\n\nRaw response: ${response}`
      );
    }
  }

  async analyze(youtubeUrl: string, prompt: string): Promise<string> {
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const fullPrompt = `[System Context: Today's date is ${currentDate}]\n\n${prompt}`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: youtubeUrl,
                },
              },
              {
                text: fullPrompt,
              },
            ],
          },
        ],
      });

      const text = response.text;
      if (!text) {
        throw new VideoAnalysisError("Gemini returned an empty response");
      }

      return text;
    } catch (error) {
      if (error instanceof VideoAnalysisError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (
        message.toLowerCase().includes("video") ||
        message.toLowerCase().includes("file") ||
        message.toLowerCase().includes("access")
      ) {
        throw new VideoAccessError(
          youtubeUrl,
          error instanceof Error ? error : undefined
        );
      }

      if (
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("rate")
      ) {
        throw new VideoAnalysisError(
          "API quota exceeded or rate limited. Please try again later."
        );
      }

      throw new VideoAnalysisError(`Failed to analyze video: ${message}`);
    }
  }
}
