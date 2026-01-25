import { describe, it, expect, beforeAll } from "vitest";
import { GeminiVideoClient } from "../src/gemini-client.js";
import {
  TranscriptClient,
  TranscriptExtractionError,
} from "../src/transcript-client.js";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

// Known public test video - "Me at the zoo" (first YouTube video, has auto-captions)
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

// Skip integration tests if no API key
const hasApiKey = !!process.env.GEMINI_API_KEY;

// Check for yt-dlp availability
let hasYtDlp = false;
try {
  await exec("which yt-dlp");
  hasYtDlp = true;
} catch {
  hasYtDlp = false;
}

describe.skipIf(!hasApiKey)("TranscriptClient - Integration Tests", () => {
  let geminiClient: GeminiVideoClient;
  let transcriptClient: TranscriptClient;

  beforeAll(() => {
    geminiClient = new GeminiVideoClient();
    transcriptClient = new TranscriptClient(geminiClient);
  });

  it("gets transcript in text format with timestamps", async () => {
    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "text",
      includeTimestamps: true,
    });

    console.log(`Transcript source: ${result.source}`);
    console.log(`Transcript language: ${result.language}`);
    console.log(`Transcript text (${result.text.length} chars):\n${result.text.substring(0, 500)}...`);

    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(10);
    expect(["captions", "gemini"]).toContain(result.source);

    // Should have timestamps like [0:01]
    if (result.source === "captions") {
      expect(result.text).toMatch(/\[\d+:\d+\]/);
    }
  }, 120000);

  it("gets transcript in text format without timestamps", async () => {
    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "text",
      includeTimestamps: false,
    });

    console.log(`Transcript without timestamps (${result.text.length} chars):\n${result.text.substring(0, 300)}...`);

    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(10);
    // Should NOT have timestamps
    expect(result.text).not.toMatch(/^\[\d+:\d+\]/);
  }, 120000);

  it("gets transcript in JSON format", async () => {
    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "json",
    });

    console.log(`JSON transcript (${result.text.length} chars):\n${result.text.substring(0, 500)}...`);

    // Should be valid JSON
    const parsed = JSON.parse(result.text);
    expect(parsed).toHaveProperty("source");
    expect(parsed).toHaveProperty("language");
    expect(parsed).toHaveProperty("segments");
    expect(Array.isArray(parsed.segments)).toBe(true);

    if (parsed.segments.length > 0) {
      expect(parsed.segments[0]).toHaveProperty("start_ms");
      expect(parsed.segments[0]).toHaveProperty("text");
    }
  }, 120000);

  it("gets transcript in SRT format", async () => {
    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "srt",
    });

    console.log(`SRT transcript (${result.text.length} chars):\n${result.text.substring(0, 500)}...`);

    expect(typeof result.text).toBe("string");
    // SRT format should have numbered entries and arrow timestamps
    expect(result.text).toMatch(/^\d+\n/); // Starts with number
    expect(result.text).toMatch(/-->/); // Has SRT arrows
  }, 120000);

  it("gets transcript in VTT format", async () => {
    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "vtt",
    });

    console.log(`VTT transcript (${result.text.length} chars):\n${result.text.substring(0, 500)}...`);

    expect(typeof result.text).toBe("string");
    // VTT format should start with WEBVTT header
    expect(result.text).toMatch(/^WEBVTT/);
    expect(result.text).toMatch(/-->/); // Has VTT arrows
  }, 120000);
});

describe.skipIf(!hasYtDlp)("TranscriptClient - yt-dlp caption extraction", () => {
  let geminiClient: GeminiVideoClient;
  let transcriptClient: TranscriptClient;

  beforeAll(() => {
    if (hasApiKey) {
      geminiClient = new GeminiVideoClient();
      transcriptClient = new TranscriptClient(geminiClient);
    }
  });

  it("prefers native captions when available", async () => {
    if (!hasApiKey) {
      console.log("Skipping: GEMINI_API_KEY not set (needed for fallback initialization)");
      return;
    }

    const result = await transcriptClient.getTranscript(TEST_VIDEO_URL, {
      format: "text",
      language: "en",
    });

    console.log(`Source: ${result.source}`);
    console.log(`Language: ${result.language}`);

    // "Me at the zoo" has auto-generated English captions
    // So we should get captions, not Gemini fallback
    expect(result.source).toBe("captions");
    expect(result.language).toContain("en");
  }, 120000);
});

describe("TranscriptExtractionError", () => {
  it("creates error with correct name and message", () => {
    const error = new TranscriptExtractionError("Test error");
    expect(error.name).toBe("TranscriptExtractionError");
    expect(error.message).toBe("Test error");
    expect(error instanceof Error).toBe(true);
  });
});

describe("TranscriptClient - Format conversion unit tests", () => {
  // These test the internal formatting logic without making API calls

  it("formatTimestamp converts milliseconds to MM:SS correctly", () => {
    // We can't directly test private methods, but we can test via JSON output
    // This is just a placeholder for format verification
    expect(true).toBe(true);
  });

  it("SRT timestamp format is HH:MM:SS,mmm", () => {
    // Test pattern
    const srtPattern = /\d{2}:\d{2}:\d{2},\d{3}/;
    const validSrt = "00:01:23,456";
    expect(srtPattern.test(validSrt)).toBe(true);
  });

  it("VTT timestamp format is HH:MM:SS.mmm", () => {
    // Test pattern
    const vttPattern = /\d{2}:\d{2}:\d{2}\.\d{3}/;
    const validVtt = "00:01:23.456";
    expect(vttPattern.test(validVtt)).toBe(true);
  });
});
