import { google } from "googleapis";
import { extractVideoId } from "./validators.js";

export interface VideoMetadata {
  title: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface SearchResult {
  videoId: string;
  url: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export class YouTubeMetadataClient {
  private youtube;

  constructor(apiKey: string) {
    this.youtube = google.youtube({
      version: "v3",
      auth: apiKey,
    });
  }

  async getMetadata(youtubeUrl: string): Promise<VideoMetadata> {
    try {
      const videoId = extractVideoId(youtubeUrl);

      const response = await this.youtube.videos.list({
        part: ["snippet"],
        id: [videoId],
      });

      const video = response.data.items?.[0];
      if (!video?.snippet) {
        throw new Error(`No metadata found for video: ${videoId}`);
      }

      const snippet = video.snippet;

      return {
        title: snippet.title || "Unknown",
        channelTitle: snippet.channelTitle || "Unknown",
        description: snippet.description || "",
        publishedAt: snippet.publishedAt || "",
        thumbnailUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.default?.url ||
          "",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch YouTube metadata: ${message}`);
    }
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      const response = await this.youtube.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults: maxResults,
      });

      const items = response.data.items || [];

      return items.map((item) => {
        const snippet = item.snippet;
        const videoId = item.id?.videoId || "";

        return {
          videoId,
          url: `https://youtube.com/watch?v=${videoId}`,
          title: snippet?.title || "Unknown",
          description: snippet?.description || "",
          channelTitle: snippet?.channelTitle || "Unknown",
          publishedAt: snippet?.publishedAt || "",
          thumbnailUrl:
            snippet?.thumbnails?.high?.url ||
            snippet?.thumbnails?.default?.url ||
            "",
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search YouTube: ${message}`);
    }
  }
}
