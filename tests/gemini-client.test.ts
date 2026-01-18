import { describe, it, expect, beforeAll } from "vitest";
import { GeminiVideoClient, VideoAnalysisError } from "../src/gemini-client.js";

// Known public test video - "Me at the zoo" (first YouTube video, always available)
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

// Skip integration tests if no API key
const hasApiKey = !!process.env.GEMINI_API_KEY;

describe.skipIf(!hasApiKey)("GeminiVideoClient - Integration Tests", () => {
  let client: GeminiVideoClient;

  beforeAll(() => {
    client = new GeminiVideoClient();
  });

  it("summarizes video with brief detail level", async () => {
    const result = await client.summarize(TEST_VIDEO_URL, "brief");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(10);
    console.log(`Brief summary (${result.length} chars):\n${result}`);
  }, 60000);

  it("summarizes video with medium detail level", async () => {
    const result = await client.summarize(TEST_VIDEO_URL, "medium");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(10);
    console.log(`Medium summary (${result.length} chars):\n${result}`);
  }, 60000);

  it("summarizes video with detailed level", async () => {
    const result = await client.summarize(TEST_VIDEO_URL, "detailed");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
    console.log(`Detailed summary (${result.length} chars):\n${result}`);
  }, 60000);

  it("answers a question about the video", async () => {
    const result = await client.ask(TEST_VIDEO_URL, "What animals are shown in this video?");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // "Me at the zoo" shows elephants
    const lowerResult = result.toLowerCase();
    expect(
      lowerResult.includes("elephant") || lowerResult.includes("zoo")
    ).toBe(true);
    console.log(`Answer:\n${result}`);
  }, 60000);

  it("handles questions with specific context", async () => {
    const result = await client.ask(TEST_VIDEO_URL, "Where was this video filmed?");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    console.log(`Location answer:\n${result}`);
  }, 60000);
});

describe("GeminiVideoClient - Unit Tests", () => {
  it("throws error when GEMINI_API_KEY is not set", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(() => new GeminiVideoClient()).toThrow("GEMINI_API_KEY");

    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("uses custom model from environment", () => {
    if (!process.env.GEMINI_API_KEY) {
      console.log("Skipping: GEMINI_API_KEY not set");
      return;
    }

    const originalModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-2.5-pro";

    const client = new GeminiVideoClient();
    // Client should initialize without error
    expect(client).toBeInstanceOf(GeminiVideoClient);

    if (originalModel) {
      process.env.GEMINI_MODEL = originalModel;
    } else {
      delete process.env.GEMINI_MODEL;
    }
  });
});

describe("VideoAnalysisError", () => {
  it("creates error with correct name and message", () => {
    const error = new VideoAnalysisError("Test error");
    expect(error.name).toBe("VideoAnalysisError");
    expect(error.message).toBe("Test error");
    expect(error instanceof Error).toBe(true);
  });
});
