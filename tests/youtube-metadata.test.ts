import { describe, it, expect, beforeAll } from "vitest";
import { YouTubeMetadataClient } from "../src/youtube-metadata.js";

describe("YouTubeMetadataClient.search", () => {
  let client: YouTubeMetadataClient;
  const hasApiKey = !!(
    process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY
  );

  beforeAll(() => {
    if (hasApiKey) {
      const apiKey =
        process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY || "";
      client = new YouTubeMetadataClient(apiKey);
    }
  });

  it.skipIf(!hasApiKey)(
    "returns search results for valid query",
    async () => {
      const results = await client.search("javascript tutorial", 5);

      console.log("Search results count:", results.length);
      console.log(
        "First result:",
        JSON.stringify(results[0], null, 2)
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(first.videoId).toBeTruthy();
      expect(first.url).toMatch(/^https:\/\/youtube\.com\/watch\?v=/);
      expect(first.title).toBeTruthy();
      expect(first.channelTitle).toBeTruthy();
      expect(first.publishedAt).toBeTruthy();
    }
  );

  it.skipIf(!hasApiKey)("respects max_results parameter", async () => {
    const results = await client.search("music", 2);

    console.log("Results for max_results=2:", results.length);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it.skipIf(!hasApiKey)("returns empty array for nonsense query", async () => {
    const results = await client.search(
      "xyzzy12345abcdef67890notaquery",
      5
    );

    console.log("Results for nonsense query:", results.length);

    expect(Array.isArray(results)).toBe(true);
  });

  it.skipIf(!hasApiKey)("defaults to 5 results", async () => {
    const results = await client.search("programming");

    console.log("Results for default max_results:", results.length);

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it.skipIf(!hasApiKey)("returns all expected fields", async () => {
    const results = await client.search("coding tutorial", 1);

    console.log("Full result structure:", JSON.stringify(results[0], null, 2));

    expect(results.length).toBe(1);

    const result = results[0];
    expect(typeof result.videoId).toBe("string");
    expect(typeof result.url).toBe("string");
    expect(typeof result.title).toBe("string");
    expect(typeof result.description).toBe("string");
    expect(typeof result.channelTitle).toBe("string");
    expect(typeof result.publishedAt).toBe("string");
    expect(typeof result.thumbnailUrl).toBe("string");
  });
});
