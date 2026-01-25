import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/tools.js";

describe("TOOLS definitions", () => {
  it("exports an array of tools", () => {
    expect(Array.isArray(TOOLS)).toBe(true);
    expect(TOOLS.length).toBe(8);
  });

  describe("summarize_video tool", () => {
    const tool = TOOLS.find((t) => t.name === "summarize_video");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("summarize_video");
    });

    it("has description", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("summarize");
    });

    it("has inputSchema with youtube_url required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
    });

    it("has detail_level property with enum values", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      const detailLevel = props.detail_level as { enum: string[] };
      expect(detailLevel.enum).toEqual(["brief", "medium", "detailed"]);
    });

    it("does not require detail_level", () => {
      expect(tool?.inputSchema.required).not.toContain("detail_level");
    });
  });

  describe("ask_about_video tool", () => {
    const tool = TOOLS.find((t) => t.name === "ask_about_video");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("ask_about_video");
    });

    it("has description", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("question");
    });

    it("has inputSchema with both required fields", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
      expect(tool?.inputSchema.required).toContain("question");
    });

    it("has youtube_url and question properties", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.youtube_url).toBeDefined();
      expect(props.question).toBeDefined();
    });
  });

  describe("extract_screenshots tool", () => {
    const tool = TOOLS.find((t) => t.name === "extract_screenshots");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("extract_screenshots");
    });

    it("has description", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("screenshot");
    });

    it("has inputSchema with youtube_url required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
    });

    it("has count, output_dir, and focus properties", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.youtube_url).toBeDefined();
      expect(props.count).toBeDefined();
      expect(props.output_dir).toBeDefined();
      expect(props.focus).toBeDefined();
    });

    it("has count with min/max constraints", () => {
      const props = tool?.inputSchema.properties as Record<string, { minimum?: number; maximum?: number }>;
      expect(props.count?.minimum).toBe(1);
      expect(props.count?.maximum).toBe(20);
    });

    it("does not require count, output_dir, or focus", () => {
      expect(tool?.inputSchema.required).not.toContain("count");
      expect(tool?.inputSchema.required).not.toContain("output_dir");
      expect(tool?.inputSchema.required).not.toContain("focus");
    });

    it("has resolution property with enum values", () => {
      const props = tool?.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.resolution?.enum).toEqual(["thumbnail", "small", "medium", "large", "full"]);
    });
  });

  describe("get_video_timestamps tool", () => {
    const tool = TOOLS.find((t) => t.name === "get_video_timestamps");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("get_video_timestamps");
    });

    it("has description mentioning preview", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("preview");
    });

    it("has inputSchema with youtube_url required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
    });

    it("has count and focus properties but no output_dir or resolution", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.youtube_url).toBeDefined();
      expect(props.count).toBeDefined();
      expect(props.focus).toBeDefined();
      expect(props.output_dir).toBeUndefined();
      expect(props.resolution).toBeUndefined();
    });
  });

  describe("extract_frames tool", () => {
    const tool = TOOLS.find((t) => t.name === "extract_frames");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("extract_frames");
    });

    it("has description mentioning specific timestamps", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("timestamp");
    });

    it("has inputSchema with youtube_url and timestamps required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
      expect(tool?.inputSchema.required).toContain("timestamps");
    });

    it("has timestamps as array of numbers", () => {
      const props = tool?.inputSchema.properties as Record<string, { type?: string; items?: { type?: string } }>;
      expect(props.timestamps?.type).toBe("array");
      expect(props.timestamps?.items?.type).toBe("number");
    });

    it("has resolution property with enum values", () => {
      const props = tool?.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.resolution?.enum).toEqual(["thumbnail", "small", "medium", "large", "full"]);
    });

    it("does not require output_dir or resolution", () => {
      expect(tool?.inputSchema.required).not.toContain("output_dir");
      expect(tool?.inputSchema.required).not.toContain("resolution");
    });
  });

  describe("get_transcript tool", () => {
    const tool = TOOLS.find((t) => t.name === "get_transcript");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("get_transcript");
    });

    it("has description mentioning transcript", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("transcript");
    });

    it("has inputSchema with youtube_url required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
    });

    it("has format property with enum values", () => {
      const props = tool?.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.format?.enum).toEqual(["text", "json", "srt", "vtt"]);
    });

    it("has include_timestamps and language properties", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.youtube_url).toBeDefined();
      expect(props.include_timestamps).toBeDefined();
      expect(props.format).toBeDefined();
      expect(props.language).toBeDefined();
    });

    it("does not require optional parameters", () => {
      expect(tool?.inputSchema.required).not.toContain("include_timestamps");
      expect(tool?.inputSchema.required).not.toContain("format");
      expect(tool?.inputSchema.required).not.toContain("language");
    });
  });

  describe("search_in_video tool", () => {
    const tool = TOOLS.find((t) => t.name === "search_in_video");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("search_in_video");
    });

    it("has description mentioning search", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("search");
    });

    it("has inputSchema with youtube_url and query required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("youtube_url");
      expect(tool?.inputSchema.required).toContain("query");
    });

    it("has search_type property with enum values", () => {
      const props = tool?.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.search_type?.enum).toEqual(["visual", "audio", "both"]);
    });

    it("has youtube_url, query, and search_type properties", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.youtube_url).toBeDefined();
      expect(props.query).toBeDefined();
      expect(props.search_type).toBeDefined();
    });

    it("does not require search_type", () => {
      expect(tool?.inputSchema.required).not.toContain("search_type");
    });
  });

  describe("search_youtube tool", () => {
    const tool = TOOLS.find((t) => t.name === "search_youtube");

    it("exists", () => {
      expect(tool).toBeDefined();
    });

    it("has correct name", () => {
      expect(tool?.name).toBe("search_youtube");
    });

    it("has description mentioning search", () => {
      expect(tool?.description).toBeTruthy();
      expect(tool?.description.toLowerCase()).toContain("search");
    });

    it("has inputSchema with query required", () => {
      expect(tool?.inputSchema.type).toBe("object");
      expect(tool?.inputSchema.required).toContain("query");
    });

    it("has query and max_results properties", () => {
      const props = tool?.inputSchema.properties as Record<string, unknown>;
      expect(props.query).toBeDefined();
      expect(props.max_results).toBeDefined();
    });

    it("has max_results with min/max constraints", () => {
      const props = tool?.inputSchema.properties as Record<
        string,
        { minimum?: number; maximum?: number }
      >;
      expect(props.max_results?.minimum).toBe(1);
      expect(props.max_results?.maximum).toBe(25);
    });

    it("does not require max_results", () => {
      expect(tool?.inputSchema.required).not.toContain("max_results");
    });

    it("does not require youtube_url (searches across YouTube)", () => {
      expect(tool?.inputSchema.required).not.toContain("youtube_url");
    });
  });
});
