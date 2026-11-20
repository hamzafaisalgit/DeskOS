export type CanvasProject = {
  format: "deskos-canvas";
  version: 1;
  width: number;
  height: number;
  scene: Record<string, unknown>;
};
export function parseProject(source: string): CanvasProject {
  if (source.length > 24 * 1024 * 1024)
    throw Error("Canvas projects are limited to 24 MB.");
  const p = JSON.parse(source) as CanvasProject;
  if (
    p.format !== "deskos-canvas" ||
    p.version !== 1 ||
    !Number.isInteger(p.width) ||
    !Number.isInteger(p.height) ||
    p.width < 1 ||
    p.height < 1 ||
    p.width > 4096 ||
    p.height > 4096 ||
    !p.scene ||
    !Array.isArray(p.scene.objects)
  )
    throw Error("Invalid or unsupported DeskCanvas project.");
  let count = 0;
  const visit = (value: unknown, depth = 0) => {
    if (depth > 20 || ++count > 50000) throw Error("Project is too complex.");
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (
        key === "src" &&
        (typeof v !== "string" ||
          !/^data:image\/(png|jpeg|webp);base64,/.test(v))
      )
        throw Error("Project images must be embedded PNG, JPEG or WebP data.");
      if (
        key === "type" &&
        typeof v === "string" &&
        ![
          "Rect",
          "Ellipse",
          "Line",
          "Path",
          "IText",
          "Textbox",
          "Text",
          "Image",
          "Group",
          "rect",
          "ellipse",
          "line",
          "path",
          "i-text",
          "textbox",
          "text",
          "image",
          "group",
        ].includes(v)
      )
        throw Error("Unsupported project object: " + v);
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw Error("Invalid project property.");
      visit(v, depth + 1);
    }
  };
  visit(p.scene);
  return p;
}
export function serializeProject(
  width: number,
  height: number,
  scene: Record<string, unknown>,
) {
  const source = JSON.stringify({
    format: "deskos-canvas",
    version: 1,
    width,
    height,
    scene,
  });
  parseProject(source);
  return source;
}
