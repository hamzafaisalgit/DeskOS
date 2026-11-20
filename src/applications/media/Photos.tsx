import { matches } from "../../core/media/formats";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Undo,
  Redo,
  Maximize,
  Palette,
  Download,
  Save,
} from "lucide-react";
import { Library } from "./Shared";
import { useFilesystem } from "../../core/filesystem/hooks";
import { filesystem as fs } from "../../core/filesystem/service";
import { folderId, formatBytes } from "../../core/filesystem/types";
import { useActiveFile, useMediaUrl, report } from "../../core/media/hooks";
import {
  originalAdjustments,
  renderPhoto,
  canvasBlob,
} from "../../core/media/image";
import type { Adjustments } from "../../core/media/image";
import { download } from "../../core/filesystem/transfers";
import { useDesk } from "../../core/store";
import { useDirtyGuard } from "./DirtyGuard";
import { useMediaState, editableTarget } from "../../core/media/state";
export default function Photos() {
  const { entries } = useFilesystem(),
    [id, select] = useActiveFile();
  const entry = entries.find((e) => e.id === id && !e.trashed);
  const originalUrl = useMediaUrl(
    entry?.extension === "gif" ? entry : undefined,
  );
  const [image, setImage] = useState<ImageBitmap | null>(null),
    [error, setError] = useState(""),
    [history, setHistory] = useState<Adjustments[]>([originalAdjustments]),
    [index, setIndex] = useState(0),
    [saved, setSaved] = useState(JSON.stringify(originalAdjustments)),
    [compare, setCompare] = useState(false),
    [zoom, setZoom] = useState(1),
    [format, setFormat] = useState("png"),
    [name, setName] = useState("Edited image"),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [edit, setEdit] = useState(false),
    [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number } | null>(null);
  const quality = useMediaState(
    (s) => Number(s.preferences.photoQuality) || 0.92,
  );
  const a = history[index],
    dirty = JSON.stringify(a) !== saved;
  useEffect(() => {
    if (!id) return;
    let alive = true,
      bitmap: ImageBitmap | undefined;
    fs.getEntry(id)
      .then(async (e) => {
        if (e.trashed) throw Error("This image is in Trash.");
        const blob = await fs.getFileContent(id);
        if (blob.size > 40 * 1024 * 1024)
          throw Error("Images above 40 MB must be resized before editing.");
        bitmap = await createImageBitmap(blob);
        if (bitmap.width * bitmap.height > 40_000_000) {
          bitmap.close();
          throw Error(
            "Images above 40 megapixels must be resized before editing.",
          );
        }
        if (alive) {
          setImage(bitmap);
          setHistory([originalAdjustments]);
          setIndex(0);
          setSaved(JSON.stringify(originalAdjustments));
          setName(e.name.replace(/\.[^.]+$/, "") + " edited");
          setPan({ x: 0, y: 0 });
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
      bitmap?.close();
    };
  }, [id]);
  useEffect(() => {
    if (image && canvas.current)
      renderPhoto(image, canvas.current, compare ? originalAdjustments : a);
  }, [image, a, compare]);
  const change = (patch: Partial<Adjustments>) => {
    const next = [...history.slice(0, index + 1), { ...a, ...patch }].slice(
      -30,
    );
    setHistory(next);
    setIndex(next.length - 1);
  };
  const exportImage = async (save: boolean) => {
    if (!image) throw Error("Open a valid image first.");
    setSaving(true);
    try {
      const out = document.createElement("canvas");
      renderPhoto(image, out, a);
      const blob = await canvasBlob(
        out,
        "image/" + (format === "jpg" ? "jpeg" : format),
        quality,
      );
      const filename = (name.trim() || "Edited image") + "." + format;
      if (save) {
        await fs.createFile(folderId("Pictures"), filename, blob, true);
        setSaved(JSON.stringify(a));
        useDesk.getState().notify("Edited copy saved to Pictures");
      } else download(blob, filename);
    } finally {
      setSaving(false);
    }
  };
  const guard = useDirtyGuard(dirty, () => exportImage(true));
  const next = (delta: number) => {
    const list = entries.filter((e) => matches(e, "photos")),
      i = list.findIndex((e) => e.id === id);
    if (list.length)
      guard.request(() =>
        select(list[(i + delta + list.length) % list.length].id),
      );
  };
  return (
    <div
      className="media-app"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          void exportImage(true).catch(report);
          return;
        }
        if (editableTarget(e.target)) return;
        if (e.key === "ArrowRight") next(1);
        if (e.key === "ArrowLeft") next(-1);
        if (e.key === "+") setZoom((z) => Math.min(4, z + 0.25));
        if (e.key === "-") setZoom((z) => Math.max(0.25, z - 0.25));
      }}
    >
      {!id ? (
        <Library kind="photos" onOpen={(e) => select(e.id)} />
      ) : (
        <>
          <header className="media-topbar">
            <button
              aria-label="Back to photo library"
              onClick={() => guard.request(() => select(""))}
            >
              <ArrowLeft size={16} />
            </button>
            <strong>
              {entry?.name || "Unavailable image"}
              {dirty ? " ?" : ""}
            </strong>
            <button aria-label="Previous image" onClick={() => next(-1)}>
              <ChevronLeft size={17} />
            </button>
            <button aria-label="Next image" onClick={() => next(1)}>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => setEdit(!edit)}>
              {edit ? "Hide adjustments" : "Edit photo"}
            </button>
            <button
              aria-label="Fullscreen image"
              onClick={() =>
                void stage.current?.requestFullscreen().catch(report)
              }
            >
              <Maximize size={16} />
            </button>
            <button
              onClick={() =>
                guard.request(() => useDesk.getState().open("canvas", id))
              }
            >
              <Palette size={16} />
              Canvas
            </button>
          </header>
          {(error || !entry) && (
            <p className="media-error" role="alert">
              {error ||
                "This image is missing or in Trash. You can still save an edited copy."}
            </p>
          )}
          <div className="media-workspace">
            <div
              ref={stage}
              className="media-stage photo-stage"
              onPointerDown={(e) => {
                drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (drag.current)
                  setPan({
                    x: e.clientX - drag.current.x,
                    y: e.clientY - drag.current.y,
                  });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              {entry?.extension === "gif" &&
              !edit &&
              !dirty &&
              originalUrl.url ? (
                <img
                  src={originalUrl.url}
                  alt={entry.name}
                  style={{
                    maxWidth: "90%",
                    maxHeight: "90%",
                    transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                  }}
                />
              ) : image ? (
                <canvas
                  ref={canvas}
                  aria-label="Photo preview"
                  style={{
                    transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                  }}
                />
              ) : (
                <p>Loading image...</p>
              )}
            </div>
            {edit && (
              <aside className="media-properties">
                <small>MAKE IT YOURS</small>
                <h3>Light & color</h3>
                {(
                  [
                    "brightness",
                    "contrast",
                    "saturation",
                    "exposure",
                    "warmth",
                    "grayscale",
                    "sepia",
                    "blur",
                  ] as const
                ).map((key) => (
                  <label className="adjustment" key={key}>
                    {key}
                    <button
                      title={"Reset " + key}
                      onClick={() =>
                        change({ [key]: originalAdjustments[key] })
                      }
                    >
                      Reset
                    </button>
                    <input
                      aria-label={key}
                      type="range"
                      min={
                        key === "exposure" ? -2 : key === "warmth" ? -100 : 0
                      }
                      max={
                        key === "blur"
                          ? 12
                          : key === "exposure"
                            ? 2
                            : ["grayscale", "sepia", "warmth"].includes(key)
                              ? 100
                              : 200
                      }
                      step={key === "exposure" ? 0.1 : 1}
                      value={a[key]}
                      onChange={(e) =>
                        change({ [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
                <h3>Transform</h3>
                <button
                  aria-label="Rotate photo"
                  onClick={() => change({ rotation: (a.rotation + 90) % 360 })}
                >
                  <RotateCw size={16} />
                </button>
                <button
                  aria-label="Flip horizontal"
                  onClick={() => change({ flipX: !a.flipX })}
                >
                  <FlipHorizontal size={16} />
                </button>
                <button
                  aria-label="Flip vertical"
                  onClick={() => change({ flipY: !a.flipY })}
                >
                  <FlipVertical size={16} />
                </button>
                <h3>Crop</h3>
                <select
                  aria-label="Crop preset"
                  defaultValue="free"
                  onChange={(e) => {
                    if (!image) return;
                    const ratio = Number(e.target.value);
                    if (!ratio) {
                      change({ x: 0, y: 0, width: 100, height: 100 });
                      return;
                    }
                    const w = Math.min(image.width, image.height * ratio),
                      h = w / ratio;
                    change({
                      x: ((image.width - w) / image.width) * 50,
                      y: ((image.height - h) / image.height) * 50,
                      width: (w / image.width) * 100,
                      height: (h / image.height) * 100,
                    });
                  }}
                >
                  <option value="free">Original / reset</option>
                  <option value="1">Square 1:1</option>
                  <option value="1.7777778">Widescreen 16:9</option>
                  <option value=".8">Portrait 4:5</option>
                </select>
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    {key} %
                    <input
                      type="number"
                      min={key === "x" || key === "y" ? 0 : 1}
                      max="100"
                      value={a[key]}
                      onChange={(e) =>
                        change({
                          [key]: Math.max(
                            key === "x" || key === "y" ? 0 : 1,
                            Math.min(100, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button onClick={() => change(originalAdjustments)}>
                  Reset all
                </button>
                <h3>Save a copy</h3>
                <label>
                  Filename
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Image format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option>png</option>
                  <option>jpg</option>
                  <option>webp</option>
                </select>
                <button
                  disabled={saving}
                  onClick={() => void exportImage(true).catch(report)}
                >
                  <Save size={14} />
                  Save Copy
                </button>
                <button
                  disabled={saving}
                  onClick={() => void exportImage(false).catch(report)}
                >
                  <Download size={14} />
                  Export
                </button>
              </aside>
            )}
          </div>
          <div className="media-topbar">
            <button disabled={!index} onClick={() => setIndex((i) => i - 1)}>
              <Undo size={15} />
            </button>
            <button
              disabled={index >= history.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              <Redo size={15} />
            </button>
            <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
              {compare ? "Original" : "Compare original"}
            </button>
            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              +
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Fit
            </button>
          </div>
          <footer className="media-status">
            <span>
              {image?.width} / {image?.height} /{" "}
              {entry && formatBytes(entry.size)} / {entry?.mime}
            </span>
            <span>
              {entry && new Date(entry.modified).toLocaleDateString()} /{" "}
              {dirty ? "Unsaved adjustments" : "Original preserved"}
            </span>
          </footer>
        </>
      )}
      {guard.dialog}
    </div>
  );
}
