import { z } from "zod";

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;

export const YouTubeUrlSchema = z
  .string()
  .trim()
  .refine((url) => YOUTUBE_URL_REGEX.test(url), {
    message:
      "Invalid YouTube URL. Expected format: youtube.com/watch?v=ID, youtu.be/ID, or youtube.com/shorts/ID",
  });

export const DetailLevelSchema = z
  .enum(["brief", "medium", "detailed"])
  .default("medium");

export const ResolutionSchema = z
  .enum(["thumbnail", "small", "medium", "large", "full"])
  .default("large");

export const SummarizeInputSchema = z.object({
  youtube_url: YouTubeUrlSchema,
  detail_level: DetailLevelSchema,
});

export const AskInputSchema = z.object({
  youtube_url: YouTubeUrlSchema,
  question: z.string().min(1, "Question cannot be empty"),
});

export const ExtractScreenshotsInputSchema = z.object({
  youtube_url: YouTubeUrlSchema,
  count: z.number().int().min(1).max(20).default(5),
  output_dir: z.string().optional(),
  focus: z.string().optional(),
  resolution: ResolutionSchema,
});

export const GetVideoTimestampsInputSchema = z.object({
  youtube_url: YouTubeUrlSchema,
  count: z.number().int().min(1).max(20).default(5),
  focus: z.string().optional(),
});

export const ExtractFramesInputSchema = z.object({
  youtube_url: YouTubeUrlSchema,
  timestamps: z.array(z.number().min(0)).min(1).max(20),
  output_dir: z.string().optional(),
  resolution: ResolutionSchema,
});

export type SummarizeInput = z.infer<typeof SummarizeInputSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;
export type ExtractScreenshotsInput = z.infer<typeof ExtractScreenshotsInputSchema>;
export type GetVideoTimestampsInput = z.infer<typeof GetVideoTimestampsInputSchema>;
export type ExtractFramesInput = z.infer<typeof ExtractFramesInputSchema>;
export type DetailLevel = z.infer<typeof DetailLevelSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;

export function validateYouTubeUrl(url: string): string {
  return YouTubeUrlSchema.parse(url);
}

export function extractVideoId(url: string): string {
  const validUrl = validateYouTubeUrl(url);
  const urlObj = new URL(validUrl);

  if (urlObj.hostname === "youtu.be") {
    return urlObj.pathname.slice(1);
  }

  if (
    urlObj.hostname === "www.youtube.com" ||
    urlObj.hostname === "youtube.com"
  ) {
    if (urlObj.pathname === "/watch") {
      const videoId = urlObj.searchParams.get("v");
      if (videoId) return videoId;
    }
    if (urlObj.pathname.startsWith("/shorts/")) {
      return urlObj.pathname.split("/")[2];
    }
  }

  throw new Error(`Cannot extract video ID from: ${url}`);
}
