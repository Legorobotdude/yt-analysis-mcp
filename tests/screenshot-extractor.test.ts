import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  ScreenshotExtractor,
  DependencyError,
  ScreenshotExtractionError,
} from "../src/screenshot-extractor.js";
import { GeminiVideoClient } from "../src/gemini-client.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Known public test video - "Me at the zoo" (first YouTube video, always available)
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

// Skip integration tests if no API key
const hasApiKey = !!process.env.GEMINI_API_KEY;

// Check if yt-dlp and ffmpeg are available at module load time
let dependenciesAvailable = false;
try {
  const { execSync } = await import("child_process");
  execSync("which yt-dlp", { stdio: "ignore" });
  execSync("which ffmpeg", { stdio: "ignore" });
  dependenciesAvailable = true;
} catch {
  dependenciesAvailable = false;
}

describe("ScreenshotExtractor - Unit Tests", () => {
  it("constructs without error", () => {
    const extractor = new ScreenshotExtractor();
    expect(extractor).toBeInstanceOf(ScreenshotExtractor);
  });

  it("DependencyError includes install hint", () => {
    const error = new DependencyError("test-tool", "Install via: test command");
    expect(error.name).toBe("DependencyError");
    expect(error.message).toContain("test-tool");
    expect(error.message).toContain("Install via: test command");
  });

  it("ScreenshotExtractionError stores timestamp", () => {
    const error = new ScreenshotExtractionError("Test error", 45);
    expect(error.name).toBe("ScreenshotExtractionError");
    expect(error.message).toBe("Test error");
    expect(error.timestamp).toBe(45);
  });
});

describe.skipIf(!hasApiKey || !dependenciesAvailable)(
  "ScreenshotExtractor - Integration Tests",
  () => {
    let extractor: ScreenshotExtractor;
    let tempDir: string;

    beforeAll(async () => {
      extractor = new ScreenshotExtractor();
      await extractor.checkDependencies();
      console.log("Dependencies found: yt-dlp and ffmpeg available");

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "test-screenshots-"));
      console.log(`Created temp directory: ${tempDir}`);
    });

    afterAll(async () => {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        console.log(`Cleaned up temp directory: ${tempDir}`);
      }
    });

    it("checks dependencies successfully", async () => {
      // Should not throw if yt-dlp and ffmpeg are installed
      await extractor.checkDependencies();
    });

    it("extracts single frame at specific timestamp", async () => {
      const outputPath = path.join(tempDir, "test-frame-5s.jpg");
      await extractor.extractFrame(TEST_VIDEO_URL, 5, outputPath);

      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      console.log(`Extracted frame at 5s, size: ${stats.size} bytes`);
    }, 120000);

    it("extracts multiple screenshots with provided timestamps", async () => {
      const timestamps = [
        { time_seconds: 2, time_formatted: "0:02", description: "Early in video" },
        { time_seconds: 10, time_formatted: "0:10", description: "Later in video" },
      ];

      const screenshots = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps,
        { outputDir: tempDir }
      );

      expect(screenshots).toHaveLength(2);

      for (const screenshot of screenshots) {
        expect(screenshot.base64.length).toBeGreaterThan(100);
        expect(screenshot.mimeType).toBe("image/jpeg");
        expect(screenshot.filePath).toBeDefined();
        expect(screenshot.filePath).toContain(tempDir);
        console.log(
          `Screenshot at ${screenshot.timestamp_formatted}: ${screenshot.base64.length} base64 chars, saved to ${screenshot.filePath}`
        );
      }
    }, 180000);

    it("returns screenshots without filePath when no outputDir specified", async () => {
      const timestamps = [
        { time_seconds: 3, time_formatted: "0:03", description: "Test frame" },
      ];

      const screenshots = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps
        // No outputDir - should use temp and clean up
      );

      expect(screenshots).toHaveLength(1);
      expect(screenshots[0].base64.length).toBeGreaterThan(100);
      expect(screenshots[0].filePath).toBeUndefined();
      console.log(
        `Screenshot without save: ${screenshots[0].base64.length} base64 chars`
      );
    }, 120000);

    it("handles quality parameter", async () => {
      const timestamps = [
        { time_seconds: 5, time_formatted: "0:05", description: "Quality test" },
      ];

      const highQuality = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps,
        { quality: 95 }
      );

      const lowQuality = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps,
        { quality: 30 }
      );

      // Higher quality should generally produce larger base64
      // (though this isn't guaranteed for all frames)
      console.log(
        `High quality (95): ${highQuality[0].base64.length} chars`
      );
      console.log(
        `Low quality (30): ${lowQuality[0].base64.length} chars`
      );

      expect(highQuality[0].base64.length).toBeGreaterThan(0);
      expect(lowQuality[0].base64.length).toBeGreaterThan(0);
    }, 180000);

    it("handles resolution parameter", async () => {
      const timestamps = [
        { time_seconds: 5, time_formatted: "0:05", description: "Resolution test" },
      ];

      const thumbnail = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps,
        { resolution: "thumbnail" }
      );

      const large = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestamps,
        { resolution: "large" }
      );

      // Larger resolution should produce larger base64
      console.log(
        `Thumbnail (160p): ${thumbnail[0].base64.length} chars`
      );
      console.log(
        `Large (1080p): ${large[0].base64.length} chars`
      );

      expect(thumbnail[0].base64.length).toBeGreaterThan(0);
      expect(large[0].base64.length).toBeGreaterThan(thumbnail[0].base64.length);
    }, 180000);

    it("extracts frames at manual timestamps", async () => {
      const timestampSeconds = [3, 8, 15];

      const screenshots = await extractor.extractFramesAtTimestamps(
        TEST_VIDEO_URL,
        timestampSeconds
      );

      expect(screenshots).toHaveLength(3);

      for (let i = 0; i < screenshots.length; i++) {
        expect(screenshots[i].timestamp_seconds).toBe(timestampSeconds[i]);
        expect(screenshots[i].base64.length).toBeGreaterThan(100);
        console.log(
          `Manual frame at ${screenshots[i].timestamp_formatted}: ${screenshots[i].base64.length} base64 chars`
        );
      }
    }, 240000);
  }
);

describe.skipIf(!hasApiKey)(
  "GeminiVideoClient.extractTimestamps - Integration Tests",
  () => {
    let client: GeminiVideoClient;

    beforeAll(() => {
      client = new GeminiVideoClient();
    });

    it("extracts timestamps from video", async () => {
      const result = await client.extractTimestamps(TEST_VIDEO_URL, 3);

      expect(result.timestamps).toBeInstanceOf(Array);
      expect(result.timestamps.length).toBe(3);
      expect(result.video_duration_seconds).toBeGreaterThan(0);

      for (const ts of result.timestamps) {
        expect(typeof ts.time_seconds).toBe("number");
        expect(ts.time_seconds).toBeGreaterThanOrEqual(0);
        expect(typeof ts.time_formatted).toBe("string");
        expect(typeof ts.description).toBe("string");
        console.log(
          `Timestamp: ${ts.time_formatted} (${ts.time_seconds}s) - ${ts.description}`
        );
      }

      console.log(`Video duration: ${result.video_duration_seconds}s`);
    }, 60000);

    it("respects focus parameter", async () => {
      const result = await client.extractTimestamps(
        TEST_VIDEO_URL,
        2,
        "animals"
      );

      expect(result.timestamps).toBeInstanceOf(Array);
      expect(result.timestamps.length).toBe(2);

      // With "animals" focus, descriptions should reference animals
      const descriptions = result.timestamps
        .map((ts) => ts.description.toLowerCase())
        .join(" ");

      console.log(`Focused timestamps (animals):`);
      for (const ts of result.timestamps) {
        console.log(`  ${ts.time_formatted}: ${ts.description}`);
      }

      // "Me at the zoo" features elephants
      expect(
        descriptions.includes("elephant") ||
          descriptions.includes("animal") ||
          descriptions.includes("zoo")
      ).toBe(true);
    }, 60000);
  }
);

describe.skipIf(!hasApiKey || !dependenciesAvailable)(
  "End-to-End Screenshot Extraction",
  () => {
    it("extracts screenshots using Gemini timestamps", async () => {
      const client = new GeminiVideoClient();
      const extractor = new ScreenshotExtractor();

      // Step 1: Get timestamps from Gemini
      console.log("Step 1: Getting timestamps from Gemini...");
      const timestampResult = await client.extractTimestamps(TEST_VIDEO_URL, 2);
      console.log(
        `Got ${timestampResult.timestamps.length} timestamps:`
      );
      for (const ts of timestampResult.timestamps) {
        console.log(`  ${ts.time_formatted}: ${ts.description}`);
      }

      // Step 2: Extract screenshots
      console.log("\nStep 2: Extracting screenshots...");
      const screenshots = await extractor.extractScreenshots(
        TEST_VIDEO_URL,
        timestampResult.timestamps
      );

      expect(screenshots.length).toBe(timestampResult.timestamps.length);

      for (const screenshot of screenshots) {
        expect(screenshot.base64.length).toBeGreaterThan(100);
        expect(screenshot.mimeType).toBe("image/jpeg");
        console.log(
          `Screenshot at ${screenshot.timestamp_formatted}: ${screenshot.base64.length} base64 chars`
        );
      }
    }, 240000);
  }
);
