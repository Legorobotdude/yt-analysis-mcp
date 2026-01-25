import { promisify } from "util";
import { exec as execCallback } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { GeminiVideoClient } from "./gemini-client.js";
import type { TranscriptFormat } from "./validators.js";

const exec = promisify(execCallback);

export class TranscriptExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptExtractionError";
  }
}

export interface TranscriptSegment {
  start_ms: number;
  duration_ms: number;
  start_formatted: string;
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  source: "captions" | "gemini";
  language: string;
  video_duration_seconds?: number;
}

interface Json3Event {
  tStartMs: number;
  dDurationMs: number;
  segs?: Array<{ utf8: string }>;
}

interface Json3Caption {
  events: Json3Event[];
}

export class TranscriptClient {
  private ytdlpPath: string | null = null;

  constructor(private geminiClient: GeminiVideoClient) {}

  /**
   * Get transcript for a YouTube video.
   * Tries native captions first via yt-dlp, falls back to Gemini AI transcription.
   */
  async getTranscript(
    youtubeUrl: string,
    options: {
      includeTimestamps?: boolean;
      format?: TranscriptFormat;
      language?: string;
    } = {}
  ): Promise<{ text: string; source: "captions" | "gemini"; language: string }> {
    const includeTimestamps = options.includeTimestamps ?? true;
    const format = options.format ?? "text";
    const language = options.language ?? "en";

    let result: TranscriptResult;

    // Try yt-dlp captions first
    const captionResult = await this.tryYtDlpCaptions(youtubeUrl, language);

    if (captionResult) {
      result = captionResult;
    } else {
      // Fall back to Gemini transcription
      result = await this.useGeminiFallback(youtubeUrl);
    }

    const text = this.formatOutput(result, format, includeTimestamps);
    return { text, source: result.source, language: result.language };
  }

  /**
   * Try to extract captions using yt-dlp.
   * Returns null if no captions are available.
   */
  private async tryYtDlpCaptions(
    youtubeUrl: string,
    language: string
  ): Promise<TranscriptResult | null> {
    await this.checkYtDlp();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-transcript-"));

    try {
      // First, list available subtitles
      const { stdout: subList } = await exec(
        `${this.ytdlpPath} --list-subs --skip-download "${youtubeUrl}" 2>/dev/null`
      );

      // Check if requested language or auto-generated version is available
      const hasManual = subList.includes(`${language} `) || subList.includes(`${language}\t`);
      const hasAuto = subList.includes(`${language} (auto-generated)`) ||
                      subList.includes(`${language}-orig`);

      if (!hasManual && !hasAuto) {
        // Check for any available subtitles
        const hasAnySubs = subList.includes("Available subtitles") ||
                          subList.includes("Available automatic captions");
        if (!hasAnySubs) {
          return null;
        }
      }

      // Download subtitles in json3 format (most structured)
      const outputTemplate = path.join(tempDir, "%(id)s.%(ext)s");

      // Try to get subtitles - prefer manual, fall back to auto
      const subArgs = hasManual
        ? `--write-sub --sub-lang ${language}`
        : `--write-auto-sub --sub-lang ${language}`;

      await exec(
        `${this.ytdlpPath} ${subArgs} --sub-format json3 --skip-download -o "${outputTemplate}" "${youtubeUrl}" 2>/dev/null`
      );

      // Find the downloaded subtitle file
      const files = await fs.readdir(tempDir);
      const subFile = files.find((f) => f.endsWith(".json3"));

      if (!subFile) {
        return null;
      }

      const content = await fs.readFile(path.join(tempDir, subFile), "utf-8");
      const segments = this.parseJson3(content);

      if (segments.length === 0) {
        return null;
      }

      return {
        segments,
        source: "captions",
        language: hasManual ? language : `${language} (auto-generated)`,
      };
    } catch {
      // Captions not available or extraction failed
      return null;
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Use Gemini AI to transcribe the video.
   */
  private async useGeminiFallback(youtubeUrl: string): Promise<TranscriptResult> {
    const response = await this.geminiClient.extractTranscript(youtubeUrl);

    // Parse the JSON response
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const parsed = JSON.parse(jsonStr) as {
        segments: Array<{
          start_ms: number;
          duration_ms?: number;
          text: string;
        }>;
        video_duration_seconds?: number;
        language?: string;
      };

      const segments: TranscriptSegment[] = parsed.segments.map((seg) => ({
        start_ms: seg.start_ms,
        duration_ms: seg.duration_ms ?? 0,
        start_formatted: this.formatTimestamp(seg.start_ms),
        text: seg.text,
      }));

      return {
        segments,
        source: "gemini",
        language: parsed.language ?? "en",
        video_duration_seconds: parsed.video_duration_seconds,
      };
    } catch (error) {
      throw new TranscriptExtractionError(
        `Failed to parse Gemini transcript response: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Parse yt-dlp's json3 caption format.
   */
  private parseJson3(content: string): TranscriptSegment[] {
    try {
      const data = JSON.parse(content) as Json3Caption;
      const segments: TranscriptSegment[] = [];

      for (const event of data.events || []) {
        if (!event.segs) continue;

        const text = event.segs
          .map((seg) => seg.utf8)
          .join("")
          .trim();

        if (!text || text === "\n") continue;

        segments.push({
          start_ms: event.tStartMs,
          duration_ms: event.dDurationMs || 0,
          start_formatted: this.formatTimestamp(event.tStartMs),
          text: text.replace(/\n/g, " ").trim(),
        });
      }

      return segments;
    } catch (error) {
      throw new TranscriptExtractionError(
        `Failed to parse json3 captions: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Format milliseconds as MM:SS or HH:MM:SS.
   */
  private formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  /**
   * Format transcript result based on output format.
   */
  private formatOutput(
    result: TranscriptResult,
    format: TranscriptFormat,
    includeTimestamps: boolean
  ): string {
    switch (format) {
      case "json":
        return JSON.stringify(
          {
            source: result.source,
            language: result.language,
            video_duration_seconds: result.video_duration_seconds,
            segments: result.segments.map((seg) => ({
              start_ms: seg.start_ms,
              duration_ms: seg.duration_ms,
              start_formatted: seg.start_formatted,
              text: seg.text,
            })),
          },
          null,
          2
        );

      case "srt":
        return this.formatSrt(result.segments);

      case "vtt":
        return this.formatVtt(result.segments);

      case "text":
      default:
        return this.formatText(result.segments, includeTimestamps);
    }
  }

  /**
   * Format as plain text with optional timestamps.
   */
  private formatText(segments: TranscriptSegment[], includeTimestamps: boolean): string {
    if (includeTimestamps) {
      return segments.map((seg) => `[${seg.start_formatted}] ${seg.text}`).join("\n");
    }
    return segments.map((seg) => seg.text).join(" ");
  }

  /**
   * Format as SRT subtitle format.
   */
  private formatSrt(segments: TranscriptSegment[]): string {
    return segments
      .map((seg, i) => {
        const startTime = this.msToSrtTime(seg.start_ms);
        const endTime = this.msToSrtTime(seg.start_ms + (seg.duration_ms || 2000));
        return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
      })
      .join("\n");
  }

  /**
   * Format as WebVTT subtitle format.
   */
  private formatVtt(segments: TranscriptSegment[]): string {
    const header = "WEBVTT\n\n";
    const body = segments
      .map((seg) => {
        const startTime = this.msToVttTime(seg.start_ms);
        const endTime = this.msToVttTime(seg.start_ms + (seg.duration_ms || 2000));
        return `${startTime} --> ${endTime}\n${seg.text}`;
      })
      .join("\n\n");
    return header + body;
  }

  /**
   * Convert milliseconds to SRT timestamp format (HH:MM:SS,mmm).
   */
  private msToSrtTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
  }

  /**
   * Convert milliseconds to WebVTT timestamp format (HH:MM:SS.mmm).
   */
  private msToVttTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }

  /**
   * Check if yt-dlp is available.
   */
  private async checkYtDlp(): Promise<void> {
    if (this.ytdlpPath) return;

    try {
      const { stdout } = await exec("which yt-dlp");
      this.ytdlpPath = stdout.trim();
    } catch {
      throw new TranscriptExtractionError(
        "yt-dlp is required for caption extraction. Install via: brew install yt-dlp (macOS) or pip install yt-dlp"
      );
    }
  }
}
