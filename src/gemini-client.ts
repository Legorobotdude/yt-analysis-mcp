import { GoogleGenAI } from "@google/genai";
import type { DetailLevel, SearchType } from "./validators.js";

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

export interface SearchMatch {
  timestamp_seconds: number;
  timestamp_formatted: string;
  context: string;
  match_type: "visual" | "audio" | "both";
}

export interface SearchResult {
  matches: SearchMatch[];
  query: string;
  total_matches: number;
}

const TIMESTAMP_EXTRACTION_PROMPT = `Analyze this video and select {count} timestamps that will produce HIGH-QUALITY screenshots.

CRITICAL: Frame quality is the TOP priority. A boring but sharp frame is better than an interesting but blurry one.

STEP 1 - REJECT these frame types (they make bad screenshots):
- Motion blur (camera or subject moving)
- Scene transitions, fades, or dissolves
- Dark or poorly lit moments
- Out-of-focus shots
- Frames with heavy compression artifacts
- Moments where the subject is partially out of frame
- Rapid camera movement or shaky footage

STEP 2 - PREFER these frame types:
- Static shots where camera and subject are still
- Well-lit scenes with good contrast
- Sharp focus on the main subject
- Stable, composed frames (not mid-pan or mid-zoom)
- Moments 0.5-1 second AFTER a scene change (not during)
- Clear text/graphics when present (fully rendered, not animating)

STEP 3 - Among quality frames, prioritize:
- Visual variety (different scenes, angles, subjects)
- Key content moments (demonstrations, reveals, important visuals)
- Spread across the video timeline
{focus_instruction}

Return EXACTLY a JSON object (no markdown, no code blocks):
{
  "timestamps": [
    {
      "time_seconds": <number>,
      "time_formatted": "<MM:SS or HH:MM:SS>",
      "description": "<what's shown AND why this frame is high quality>"
    }
  ],
  "video_duration_seconds": <number>
}`;

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

  /**
   * Extract full transcript from video using AI transcription.
   * Used as fallback when native captions are not available.
   */
  async extractTranscript(youtubeUrl: string): Promise<string> {
    const prompt = `Extract the complete transcript of this video with timestamps.

Return the transcript in this exact JSON format (no markdown, just raw JSON):
{
  "segments": [
    {
      "start_ms": <number - start time in milliseconds>,
      "duration_ms": <number - approximate duration in milliseconds>,
      "text": "<spoken text for this segment>"
    }
  ],
  "video_duration_seconds": <number - total video duration>,
  "language": "<detected language code, e.g., 'en'>"
}

Guidelines:
- Transcribe ALL spoken content accurately
- Break into natural segments (sentences or phrases)
- Include speaker changes if multiple speakers
- Use [brackets] for important non-speech sounds only if relevant
- Be thorough - capture every word spoken in the video`;

    return this.analyze(youtubeUrl, prompt);
  }

  /**
   * Search for specific content within a video.
   * Returns timestamps where the content appears.
   */
  async searchInVideo(
    youtubeUrl: string,
    query: string,
    searchType: SearchType
  ): Promise<SearchResult> {
    const searchContext =
      searchType === "visual"
        ? "visual elements only (what you see on screen)"
        : searchType === "audio"
          ? "audio/speech only (what is spoken or heard)"
          : "both visual elements and audio/speech";

    const prompt = `Search this video for: "${query}"

Search in: ${searchContext}

Return results in this exact JSON format (no markdown, just raw JSON):
{
  "matches": [
    {
      "timestamp_seconds": <number>,
      "timestamp_formatted": "<MM:SS or HH:MM:SS>",
      "context": "<brief description of how/where the query appears>",
      "match_type": "<'visual' or 'audio' or 'both'>"
    }
  ],
  "query": "${query}",
  "total_matches": <number>
}

Guidelines:
- Find ALL occurrences of the query or closely related content
- For visual matches: describe what appears on screen
- For audio matches: include relevant quote or paraphrase
- Be thorough but avoid false positives
- If nothing matches, return empty matches array with total_matches: 0`;

    const response = await this.analyze(youtubeUrl, prompt);

    // Parse JSON from response
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const result = JSON.parse(jsonStr) as SearchResult;

      if (!Array.isArray(result.matches)) {
        throw new Error("Invalid response: matches must be an array");
      }

      return result;
    } catch (error) {
      throw new VideoAnalysisError(
        `Failed to parse search response: ${error instanceof Error ? error.message : error}\n\nRaw response: ${response}`
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
