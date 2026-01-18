import { describe, it, expect } from "vitest";
import {
  validateYouTubeUrl,
  extractVideoId,
  YouTubeUrlSchema,
  SummarizeInputSchema,
  AskInputSchema,
} from "../src/validators.js";

describe("YouTubeUrlSchema", () => {
  it("accepts standard youtube.com/watch URL", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url);
  });

  it("accepts youtube.com/watch URL without www", () => {
    const url = "https://youtube.com/watch?v=dQw4w9WgXcQ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url);
  });

  it("accepts youtu.be short URL", () => {
    const url = "https://youtu.be/dQw4w9WgXcQ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url);
  });

  it("accepts youtube.com/shorts URL", () => {
    const url = "https://youtube.com/shorts/dQw4w9WgXcQ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url);
  });

  it("accepts http URLs", () => {
    const url = "http://youtube.com/watch?v=dQw4w9WgXcQ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url);
  });

  it("trims whitespace", () => {
    const url = "  https://youtu.be/dQw4w9WgXcQ  ";
    expect(YouTubeUrlSchema.parse(url)).toBe(url.trim());
  });

  it("rejects non-YouTube URLs", () => {
    expect(() => YouTubeUrlSchema.parse("https://vimeo.com/12345")).toThrow(
      "Invalid YouTube URL"
    );
  });

  it("rejects empty string", () => {
    expect(() => YouTubeUrlSchema.parse("")).toThrow("Invalid YouTube URL");
  });

  it("rejects random text", () => {
    expect(() => YouTubeUrlSchema.parse("not a url")).toThrow(
      "Invalid YouTube URL"
    );
  });

  it("rejects YouTube channel URLs", () => {
    expect(() =>
      YouTubeUrlSchema.parse("https://youtube.com/@channel")
    ).toThrow("Invalid YouTube URL");
  });

  it("rejects YouTube playlist URLs", () => {
    expect(() =>
      YouTubeUrlSchema.parse("https://youtube.com/playlist?list=PLxxx")
    ).toThrow("Invalid YouTube URL");
  });
});

describe("validateYouTubeUrl", () => {
  it("returns valid URL unchanged", () => {
    const url = "https://youtu.be/abc123";
    expect(validateYouTubeUrl(url)).toBe(url);
  });

  it("throws on invalid URL", () => {
    expect(() => validateYouTubeUrl("invalid")).toThrow();
  });
});

describe("extractVideoId", () => {
  it("extracts ID from standard watch URL", () => {
    expect(
      extractVideoId("https://youtube.com/watch?v=abc123")
    ).toBe("abc123");
  });

  it("extracts ID from watch URL with extra params", () => {
    expect(
      extractVideoId("https://youtube.com/watch?v=abc123&t=60")
    ).toBe("abc123");
  });

  it("extracts ID from youtu.be URL", () => {
    expect(extractVideoId("https://youtu.be/abc123")).toBe("abc123");
  });

  it("extracts ID from shorts URL", () => {
    expect(
      extractVideoId("https://youtube.com/shorts/abc123")
    ).toBe("abc123");
  });

  it("handles IDs with dashes and underscores", () => {
    expect(
      extractVideoId("https://youtu.be/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });
});

describe("SummarizeInputSchema", () => {
  it("accepts valid input with all fields", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
      detail_level: "detailed",
    };
    const result = SummarizeInputSchema.parse(input);
    expect(result.youtube_url).toBe("https://youtu.be/abc123");
    expect(result.detail_level).toBe("detailed");
  });

  it("defaults detail_level to medium", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
    };
    const result = SummarizeInputSchema.parse(input);
    expect(result.detail_level).toBe("medium");
  });

  it("rejects invalid detail_level", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
      detail_level: "super_detailed",
    };
    expect(() => SummarizeInputSchema.parse(input)).toThrow();
  });

  it("rejects missing youtube_url", () => {
    const input = {
      detail_level: "brief",
    };
    expect(() => SummarizeInputSchema.parse(input)).toThrow();
  });
});

describe("AskInputSchema", () => {
  it("accepts valid input", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
      question: "What is the main topic?",
    };
    const result = AskInputSchema.parse(input);
    expect(result.youtube_url).toBe("https://youtu.be/abc123");
    expect(result.question).toBe("What is the main topic?");
  });

  it("rejects empty question", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
      question: "",
    };
    expect(() => AskInputSchema.parse(input)).toThrow("Question cannot be empty");
  });

  it("rejects missing question", () => {
    const input = {
      youtube_url: "https://youtu.be/abc123",
    };
    expect(() => AskInputSchema.parse(input)).toThrow();
  });

  it("rejects missing youtube_url", () => {
    const input = {
      question: "What is this about?",
    };
    expect(() => AskInputSchema.parse(input)).toThrow();
  });
});
