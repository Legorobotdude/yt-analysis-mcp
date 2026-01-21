import { spawn } from "child_process";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { extractVideoId, type Resolution } from "./validators.js";

const exec = promisify(execCallback);

// Resolution to height mapping
const RESOLUTION_MAP: Record<Resolution, number | null> = {
  thumbnail: 160,
  small: 360,
  medium: 720,
  large: 1080,
  full: null, // No scaling, use original
};

export class DependencyError extends Error {
  constructor(dependency: string, installHint: string) {
    super(`Missing required dependency: ${dependency}. ${installHint}`);
    this.name = "DependencyError";
  }
}

export class ScreenshotExtractionError extends Error {
  constructor(
    message: string,
    public readonly timestamp?: number
  ) {
    super(message);
    this.name = "ScreenshotExtractionError";
  }
}

export interface Screenshot {
  timestamp_seconds: number;
  timestamp_formatted: string;
  description: string;
  base64: string;
  mimeType: "image/jpeg";
  filePath?: string;
}

export interface ExtractOptions {
  outputDir?: string;
  quality?: number;
  resolution?: Resolution;
}

export class ScreenshotExtractor {
  private ytdlpPath: string | null = null;
  private ffmpegPath: string | null = null;

  async checkDependencies(): Promise<void> {
    // Check yt-dlp
    try {
      const { stdout: ytdlpOut } = await exec("which yt-dlp");
      this.ytdlpPath = ytdlpOut.trim();
    } catch {
      throw new DependencyError(
        "yt-dlp",
        "Install via: brew install yt-dlp (macOS) or pip install yt-dlp"
      );
    }

    // Check ffmpeg
    try {
      const { stdout: ffmpegOut } = await exec("which ffmpeg");
      this.ffmpegPath = ffmpegOut.trim();
    } catch {
      throw new DependencyError(
        "ffmpeg",
        "Install via: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
      );
    }
  }

  async extractFrame(
    youtubeUrl: string,
    timestampSeconds: number,
    outputPath: string,
    quality: number = 85,
    resolution: Resolution = "large"
  ): Promise<void> {
    if (!this.ytdlpPath || !this.ffmpegPath) {
      await this.checkDependencies();
    }

    // Get target height for yt-dlp format selection
    const targetHeight = RESOLUTION_MAP[resolution] ?? 1080;

    // Get direct video stream URL from yt-dlp
    const { stdout: streamUrl } = await exec(
      `${this.ytdlpPath} -f "bestvideo[height<=${targetHeight}]/best[height<=${targetHeight}]" -g "${youtubeUrl}" 2>/dev/null | head -1`
    );

    const videoStreamUrl = streamUrl.trim();
    if (!videoStreamUrl) {
      throw new ScreenshotExtractionError(
        "Failed to get video stream URL",
        timestampSeconds
      );
    }

    // Extract frame using ffmpeg with seeking
    // -ss before -i for fast seeking (input seeking)
    // Quality scale: 2-31 where lower = better
    const ffmpegQuality = Math.max(2, Math.min(31, Math.round((100 - quality) / 3.33)));
    const ffmpegCmd = [
      this.ffmpegPath!,
      "-ss",
      String(timestampSeconds),
      "-i",
      videoStreamUrl,
      "-vframes",
      "1",
      "-q:v",
      String(ffmpegQuality),
    ];

    // Add scaling filter if resolution requires it
    const scaleHeight = RESOLUTION_MAP[resolution];
    if (scaleHeight !== null) {
      ffmpegCmd.push("-vf", `scale=-1:${scaleHeight}`);
    }

    ffmpegCmd.push("-y", outputPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegCmd[0], ffmpegCmd.slice(1), {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new ScreenshotExtractionError(
              `ffmpeg failed (code ${code}): ${stderr.slice(-500)}`,
              timestampSeconds
            )
          );
        } else {
          resolve();
        }
      });

      proc.on("error", (err) => {
        reject(
          new ScreenshotExtractionError(
            `ffmpeg spawn error: ${err.message}`,
            timestampSeconds
          )
        );
      });
    });
  }

  async extractScreenshots(
    youtubeUrl: string,
    timestamps: Array<{
      time_seconds: number;
      time_formatted: string;
      description: string;
    }>,
    options: ExtractOptions = {}
  ): Promise<Screenshot[]> {
    await this.checkDependencies();

    const videoId = extractVideoId(youtubeUrl);
    const quality = options.quality ?? 85;
    const resolution = options.resolution ?? "large";

    // Determine output directory
    const userOutputDir = options.outputDir || process.env.SCREENSHOT_OUTPUT_DIR;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-screenshots-"));
    const outputDir = userOutputDir || tempDir;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const screenshots: Screenshot[] = [];
    const errors: string[] = [];

    for (const ts of timestamps) {
      const filename = `${videoId}_${ts.time_seconds}s.jpg`;
      const filePath = path.join(outputDir, filename);

      try {
        await this.extractFrame(youtubeUrl, ts.time_seconds, filePath, quality, resolution);

        // Read file and convert to base64
        const buffer = await fs.readFile(filePath);
        const base64 = buffer.toString("base64");

        screenshots.push({
          timestamp_seconds: ts.time_seconds,
          timestamp_formatted: ts.time_formatted,
          description: ts.description,
          base64,
          mimeType: "image/jpeg",
          filePath: userOutputDir ? filePath : undefined,
        });

        // Clean up temp file if no user output_dir specified
        if (!userOutputDir) {
          await fs.unlink(filePath).catch(() => {});
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Timestamp ${ts.time_formatted}: ${msg}`);
        console.error(`Failed to extract frame at ${ts.time_formatted}:`, msg);
      }
    }

    // Clean up temp directory if we created one
    if (!userOutputDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    if (screenshots.length === 0 && errors.length > 0) {
      throw new ScreenshotExtractionError(
        `All extractions failed:\n${errors.join("\n")}`
      );
    }

    return screenshots;
  }

  /**
   * Extract frames at specific timestamps (manual mode).
   * Simpler input format that just takes an array of seconds.
   */
  async extractFramesAtTimestamps(
    youtubeUrl: string,
    timestampSeconds: number[],
    options: ExtractOptions = {}
  ): Promise<Screenshot[]> {
    // Convert simple timestamps to the full format
    const timestamps = timestampSeconds.map((seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return {
        time_seconds: seconds,
        time_formatted: `${mins}:${String(secs).padStart(2, "0")}`,
        description: `Frame at ${mins}:${String(secs).padStart(2, "0")}`,
      };
    });

    return this.extractScreenshots(youtubeUrl, timestamps, options);
  }
}
