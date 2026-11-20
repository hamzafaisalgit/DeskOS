import { describe, it, expect } from "vitest";
import { compatibleApps } from "../src/core/filesystem/openWith";
import { mimeFor } from "../src/core/filesystem/types";
import type { Entry } from "../src/core/filesystem/types";
import {
  parseProject,
  serializeProject,
} from "../src/core/media/canvasProject";
describe("media integration", () => {
  it("routes real file extensions to registered media apps", () => {
    for (const [ext, app] of [
      ["mp3", "music"],
      ["png", "photos"],
      ["mp4", "cinema"],
      ["pdf", "pdf"],
      ["deskcanvas", "canvas"],
    ]) {
      expect(
        compatibleApps({
          kind: "file",
          extension: ext,
          mime: mimeFor("file." + ext),
        } as Entry)[0],
      ).toBe(app);
    }
  });
  it("round trips native artwork and rejects external image sources", () => {
    const source = serializeProject(800, 600, {
      objects: [{ type: "Rect", width: 100, height: 80, fill: "#ff0000" }],
    });
    expect(parseProject(source).scene.objects).toHaveLength(1);
    expect(() =>
      serializeProject(800, 600, {
        objects: [{ type: "Image", src: "https://example.com/image.png" }],
      }),
    ).toThrow();
    expect(() =>
      parseProject('{"format":"deskos-canvas","version":99}'),
    ).toThrow();
  });
});
