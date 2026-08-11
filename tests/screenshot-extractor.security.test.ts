import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => {
  const exec = vi.fn();
  const execAsync = vi.fn();

  Object.defineProperty(exec, Symbol.for("nodejs.util.promisify.custom"), {
    value: execAsync,
  });

  return {
    exec,
    execAsync,
    spawn: vi.fn(),
  };
});

vi.mock("child_process", () => ({
  exec: childProcessMocks.exec,
  spawn: childProcessMocks.spawn,
}));

import { ScreenshotExtractor } from "../src/screenshot-extractor.js";

function successfulProcess(stdout = "") {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();

  queueMicrotask(() => {
    if (stdout) {
      process.stdout.emit("data", Buffer.from(stdout));
    }
    process.emit("close", 0);
  });

  return process;
}

describe("ScreenshotExtractor process execution security", () => {
  beforeEach(() => {
    childProcessMocks.exec.mockClear();
    childProcessMocks.execAsync.mockReset();
    childProcessMocks.spawn.mockReset();
  });

  it("passes yt-dlp and ffmpeg inputs as argument vectors without using a shell", async () => {
    const ytdlpPath = "/usr/local/bin/yt-dlp";
    const ffmpegPath = "/usr/local/bin/ffmpeg";
    const youtubeUrl =
      "https://youtube.com/watch?v=abc123;touch${IFS}/tmp/pwned";
    const streamUrl = "https://media.example/video.mp4?token=a;b|c";
    const outputPath = "/tmp/frame;touch pwned.jpg";

    childProcessMocks.execAsync.mockResolvedValue({
      stdout: `${streamUrl}\n`,
      stderr: "",
    });
    childProcessMocks.spawn.mockImplementation((command: string) =>
      successfulProcess(command === ytdlpPath ? `${streamUrl}\n` : "")
    );

    const extractor = new ScreenshotExtractor();
    Object.assign(extractor, { ytdlpPath, ffmpegPath });

    await extractor.extractFrame(youtubeUrl, 5, outputPath);

    expect(
      childProcessMocks.execAsync,
      "child_process.exec must not be used for yt-dlp or ffmpeg"
    ).not.toHaveBeenCalled();

    const ytdlpCall = childProcessMocks.spawn.mock.calls.find(
      ([command]) => command === ytdlpPath
    );
    expect(ytdlpCall?.[1]).toEqual(
      expect.arrayContaining(["-g", youtubeUrl])
    );
    expect(ytdlpCall?.[2]).not.toEqual(expect.objectContaining({ shell: true }));

    const ffmpegCall = childProcessMocks.spawn.mock.calls.find(
      ([command]) => command === ffmpegPath
    );
    expect(ffmpegCall?.[1]).toEqual(
      expect.arrayContaining(["-i", streamUrl, "-y", outputPath])
    );
    expect(ffmpegCall?.[2]).not.toEqual(expect.objectContaining({ shell: true }));
  });
});
