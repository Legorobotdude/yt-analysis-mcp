import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { extractVideoId, type Resolution } from "./validators.js";

const PROCESS_TIMEOUT_MS = 120_000;
const MAX_CAPTURE_CHARS = 64 * 1024;
const MAX_DIAGNOSTIC_CHARS = 500;

interface ProcessResult {
  stdout: string;
  stderr: string;
}

function appendPrefix(current: string, data: Buffer | string): string {
  if (current.length >= MAX_CAPTURE_CHARS) return current;
  return (current + data.toString()).slice(0, MAX_CAPTURE_CHARS);
}

function appendSuffix(current: string, data: Buffer | string): string {
  return (current + data.toString()).slice(-MAX_CAPTURE_CHARS);
}

function sanitizedDiagnostic(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
    .trim()
    .slice(-MAX_DIAGNOSTIC_CHARS);
}

function processErrorMessage(
  name: string,
  detail: string,
  diagnostic = ""
): string {
  const safeDiagnostic = sanitizedDiagnostic(diagnostic);
  return `${name} ${detail}${safeDiagnostic ? `: ${safeDiagnostic}` : ""}`;
}

function runProcess(
  command: string,
  args: string[],
  name: string
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer | string) => {
      stdout = appendPrefix(stdout, data);
    });
    proc.stderr.on("data", (data: Buffer | string) => {
      stderr = appendSuffix(stderr, data);
    });

    const timeout = setTimeout(() => {
      proc.kill();
      finish(() => {
        reject(
          new Error(
            processErrorMessage(
              name,
              `timed out after ${PROCESS_TIMEOUT_MS}ms`,
              stderr
            )
          )
        );
      });
    }, PROCESS_TIMEOUT_MS);

    proc.on("error", (error) => {
      finish(() => {
        reject(
          new Error(
            processErrorMessage(name, "spawn error", error.message)
          )
        );
      });
    });

    proc.on("close", (code, signal) => {
      finish(() => {
        if (code !== 0) {
          const status = signal ? `signal ${signal}` : `code ${code}`;
          reject(
            new Error(processErrorMessage(name, `failed (${status})`, stderr))
          );
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  });
}

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
      await runProcess("yt-dlp", ["--version"], "yt-dlp");
      this.ytdlpPath = "yt-dlp";
    } catch {
      throw new DependencyError(
        "yt-dlp",
        "Install via: brew install yt-dlp (macOS) or pip install yt-dlp"
      );
    }

    // Check ffmpeg
    try {
      await runProcess("ffmpeg", ["-version"], "ffmpeg");
      this.ffmpegPath = "ffmpeg";
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
    let streamUrl: string;
    try {
      ({ stdout: streamUrl } = await runProcess(
        this.ytdlpPath!,
        [
          "-f",
          `bestvideo[height<=${targetHeight}]/best[height<=${targetHeight}]`,
          "-g",
          youtubeUrl,
        ],
        "yt-dlp"
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : "yt-dlp failed";
      throw new ScreenshotExtractionError(message, timestampSeconds);
    }

    const videoStreamUrl =
      streamUrl
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "";
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
    const ffmpegArgs = [
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
      ffmpegArgs.push("-vf", `scale=-1:${scaleHeight}`);
    }

    ffmpegArgs.push("-y", outputPath);

    try {
      await runProcess(this.ffmpegPath!, ffmpegArgs, "ffmpeg");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ffmpeg failed";
      throw new ScreenshotExtractionError(message, timestampSeconds);
    }
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
