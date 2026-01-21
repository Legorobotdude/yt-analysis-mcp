import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/tools.js";

describe("TOOLS definitions", () => {
  it("exports an array of tools", () => {
    expect(Array.isArray(TOOLS)).toBe(true);
    expect(TOOLS.length).toBe(3);
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
  });
});
