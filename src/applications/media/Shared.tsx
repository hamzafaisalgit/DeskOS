import { useTags, readTags } from "../../core/media/tags";
import { matches } from "../../core/media/formats";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Music2,
  Image,
  Film,
  FileText,
  Star,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  ListMusic,
} from "lucide-react";
import { useFilesystem } from "../../core/filesystem/hooks";
import { filesystem as fs } from "../../core/filesystem/service";
import { folderId, formatBytes } from "../../core/filesystem/types";
import type { Entry } from "../../core/filesystem/types";
import { importFiles } from "../../core/filesystem/transfers";
import { useMediaState } from "../../core/media/state";
import { report } from "../../core/media/hooks";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import "./media.css";
export type MediaKind = "music" | "photos" | "cinema" | "pdf";
export function ImportButton({ kind }: { kind: MediaKind }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="primary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload size={15} />
        {busy ? "Importing..." : "Import"}
      </button>
      <input
        hidden
        ref={input}
        type="file"
        multiple
        aria-label={"Import " + kind}
        accept={
          kind === "pdf"
            ? ".pdf"
            : kind === "photos"
              ? "image/png,image/jpeg,image/webp,image/gif"
              : kind === "music"
                ? "audio/*"
                : "video/*"
        }
        onChange={async (e) => {
          setBusy(true);
          try {
            await importFiles(
              folderId(
                {
                  music: "Music",
                  photos: "Pictures",
                  cinema: "Videos",
                  pdf: "Documents",
                }[kind],
              ),
              Array.from(e.target.files || []),
            );
          } catch (err) {
            report(err);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </>
  );
}
export function MediaArtwork({
  entry,
  kind,
}: {
  entry?: Entry;
  kind: MediaKind;
}) {
  const Icon = { music: Music2, photos: Image, cinema: Film, pdf: FileText }[
    kind
  ];
  return (
    <div className={"media-art " + kind}>
      <Icon size={48} strokeWidth={1} />
      <span>{entry ? entry.extension.toUpperCase() : "YOUR COLLECTION"}</span>
    </div>
  );
}
export function Thumbnail({ entry }: { entry: Entry }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    let disposed = false,
      url = "";
    const observer = new IntersectionObserver(async ([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      try {
        const blob = await fs.getFileContent(entry.id);
        if (blob.size > 40 * 1024 * 1024) return;
        const image = await createImageBitmap(blob, {
          resizeWidth: 240,
          resizeQuality: "medium",
        });
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d")!.drawImage(image, 0, 0);
        image.close();
        canvas.toBlob(
          (b) => {
            if (b && !disposed) {
              url = URL.createObjectURL(b);
              setUrl(url);
            }
          },
          "image/webp",
          0.75,
        );
      } catch {
        /* Icon remains for unsupported or corrupt files. */
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      disposed = true;
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.id, entry.revision]);
  return (
    <div ref={ref} className="media-thumbnail">
      {url ? <img src={url} alt={entry.name} /> : <Image size={30} />}
    </div>
  );
}
export function Library({
  kind,
  active,
  onOpen,
  onQueue,
}: {
  kind: MediaKind;
  active?: string;
  onOpen: (e: Entry, ids: string[]) => void;
  onQueue?: (id: string) => void;
}) {
  const { entries, error, loading } = useFilesystem();
  const meta = useMediaState();
  const tags = useTags((s) => s.tracks);
  const [group, setGroup] = useState(""),
    [indexing, setIndexing] = useState(false);
  const [view, setView] = useState("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [selected, setSelected] = useState<string[]>([]),
    [dialog, setDialog] = useState<FileDialog | null>(null),
    [limit, setLimit] = useState(100),
    [location, setLocation] = useState("");
  const lists = meta.collections.filter((c) => c.kind === kind),
    list = lists.find((c) => c.id === view);
  const inLocation = (e: Entry) => {
    if (!location) return true;
    let parent = e.parentId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (parent === location) return true;
      seen.add(parent);
      parent = entries.find((p) => p.id === parent)?.parentId || null;
    }
    return false;
  };
  const all = entries.filter((e) => matches(e, kind) && inLocation(e));
  const visible = all
    .filter(
      (e) =>
        (view === "favorites"
          ? e.favorite
          : view === "recent"
            ? kind === "photos" || !!meta.progress[e.id] || !!e.accessed
            : view === "continue"
              ? meta.progress[e.id]?.position > 5 &&
                meta.progress[e.id]?.position <
                  meta.progress[e.id]?.duration - 10
              : list
                ? list.files.includes(e.id)
                : true) &&
        (
          e.name +
          " " +
          (tags[e.id]?.title || "") +
          " " +
          (tags[e.id]?.artist || "") +
          " " +
          (tags[e.id]?.album || "")
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!["albums", "artists"].includes(view) ||
          !group ||
          (view === "albums" ? tags[e.id]?.album : tags[e.id]?.artist) ===
            group),
    )
    .sort((a, b) =>
      list
        ? list.files.indexOf(a.id) - list.files.indexOf(b.id)
        : sort === "newest" || view === "recent"
          ? view === "recent" && kind !== "photos"
            ? (meta.progress[b.id]?.opened || b.accessed || 0) -
              (meta.progress[a.id]?.opened || a.accessed || 0)
            : b.created - a.created
          : a.name.localeCompare(b.name),
    );
  const update = (files: string[]) =>
    list && meta.collection({ ...list, files });
  const reorder = (id: string, offset: number) => {
    if (!list) return;
    const files = [...list.files],
      i = files.indexOf(id),
      j = i + offset;
    if (j >= 0 && j < files.length) {
      [files[i], files[j]] = [files[j], files[i]];
      update(files);
    }
  };
  const title = {
    music: "Your soundtrack.",
    photos: "A new perspective.",
    cinema: "Make it a movie night.",
    pdf: "Room to read.",
  }[kind];
  return (
    <div className="media-library">
      <aside className="media-sidebar">
        <small>YOUR SPACE</small>
        {[
          "all",
          "favorites",
          "recent",
          ...(kind === "cinema" ? ["continue"] : []),
          ...(kind === "music" ? ["albums", "artists"] : []),
        ].map((v) => (
          <button
            className={v === view ? "selected" : ""}
            key={v}
            onClick={() => {
              setView(v);
              setGroup("");
            }}
          >
            {v === "favorites" ? <Star size={15} /> : <ListMusic size={15} />}
            {
              {
                all: "Library",
                recent:
                  kind === "photos" ? "Recently added" : "Recently played",
                continue: "Continue watching",
                albums: "Albums",
                artists: "Artists",
                favorites: "Favorites",
              }[v]
            }
          </button>
        ))}
        {kind !== "pdf" && (
          <>
            <div className="media-section-label">
              <small>{kind === "photos" ? "ALBUMS" : "PLAYLISTS"}</small>
              <button
                aria-label="Create collection"
                onClick={() =>
                  setDialog({
                    title: kind === "photos" ? "New album" : "New playlist",
                    label: "Name",
                    initial: "Untitled",
                    run: async (name) => {
                      if (!name.trim()) throw Error("Enter a name.");
                      const id = crypto.randomUUID();
                      meta.collection({ id, name, kind, files: [] });
                      setView(id);
                    },
                  })
                }
              >
                <Plus size={14} />
              </button>
            </div>
            {lists.map((c) => (
              <button
                key={c.id}
                className={view === c.id ? "selected" : ""}
                onClick={() => setView(c.id)}
              >
                {c.name}
                <small>{c.files.length}</small>
              </button>
            ))}
          </>
        )}
      </aside>
      <section className="media-library-body">
        <header className="media-heading">
          <div>
            <small>{kind.toUpperCase()} / DESKOS</small>
            <h2>{list?.name || title}</h2>
            <p>
              {all.length}{" "}
              {kind === "photos"
                ? "images"
                : kind === "pdf"
                  ? "documents"
                  : "files"}{" "}
              in your virtual library
            </p>
          </div>
          <ImportButton kind={kind} />
        </header>
        <div className="media-toolbar">
          <select
            aria-label="Library folder"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">All virtual folders</option>
            {entries
              .filter((e) => e.kind === "directory" && !e.trashed)
              .map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
          <input
            aria-label="Search library"
            placeholder="Search your collection..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Sort library"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
          {list && (
            <>
              <button
                aria-label="Rename collection"
                onClick={() =>
                  setDialog({
                    title: "Rename collection",
                    label: "Name",
                    initial: list.name,
                    run: async (name) => {
                      if (!name.trim()) throw Error("Enter a name.");
                      meta.collection({ ...list, name });
                    },
                  })
                }
              >
                <Pencil size={14} />
              </button>
              <button
                aria-label="Delete collection"
                onClick={() =>
                  setDialog({
                    title: "Delete collection?",
                    confirm:
                      "Only this collection is removed. Your files remain in the filesystem.",
                    run: async () => {
                      meta.removeCollection(list.id);
                      setView("all");
                    },
                  })
                }
              >
                <Trash2 size={14} />
              </button>
              {kind !== "photos" && (
                <>
                  <button
                    disabled={!visible.length}
                    onClick={() =>
                      onOpen(
                        visible[0],
                        visible.map((e) => e.id),
                      )
                    }
                  >
                    Play all
                  </button>
                  <button
                    disabled={!visible.length}
                    onClick={() => {
                      const ids = visible
                        .map((e) => e.id)
                        .sort(() => Math.random() - 0.5);
                      onOpen(
                        visible.find((e) => e.id === ids[0])!,
                        ids,
                      );
                    }}
                  >
                    Shuffle
                  </button>
                </>
              )}
            </>
          )}
          {selected.length > 0 && kind !== "pdf" && (
            <select
              aria-label="Add selected to collection"
              value=""
              onChange={(e) => {
                const c = lists.find((c) => c.id === e.target.value);
                if (c)
                  meta.collection({
                    ...c,
                    files: [...new Set([...c.files, ...selected])],
                  });
                setSelected([]);
              }}
            >
              <option value="">Add {selected.length} selected to...</option>
              {lists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {kind === "music" && (
          <div className="media-toolbar">
            <button
              disabled={indexing}
              onClick={async () => {
                setIndexing(true);
                try {
                  for (const e of all
                    .filter((e) => tags[e.id]?.revision !== (e.revision ?? 0))
                    .slice(0, 200)) {
                    try {
                      await readTags(e);
                    } catch {
                      useTags.getState().put(e.id, {
                        revision: e.revision ?? 0,
                        title: e.name,
                        artist: "",
                        album: "",
                      });
                    }
                  }
                } finally {
                  setIndexing(false);
                }
              }}
            >
              {indexing ? "Reading tags..." : "Read audio metadata"}
            </button>
            {["albums", "artists"].includes(view) && (
              <select
                aria-label="Metadata group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">All {view}</option>
                {[
                  ...new Set(
                    all
                      .map(
                        (e) =>
                          (view === "albums"
                            ? tags[e.id]?.album
                            : tags[e.id]?.artist) || "",
                      )
                      .filter(Boolean),
                  ),
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
            <small>
              Missing tags use filenames. Metadata is read locally, up to 200
              tracks per batch.
            </small>
          </div>
        )}

        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p>Reading your library...</p>
        ) : !visible.length ? (
          <div className="media-empty">
            <MediaArtwork kind={kind} />
            <h2>Your collection starts here.</h2>
            <p>
              Import files or find them in Files. Everything stays in your
              browser.
            </p>
            <ImportButton kind={kind} />
          </div>
        ) : (
          <div className={kind === "photos" ? "media-grid" : "media-rows"}>
            {visible.slice(0, limit).map((e, i) => (
              <div
                key={e.id}
                className={"media-item " + (active === e.id ? "selected" : "")}
                draggable={!!list}
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/deskos-media", e.id)
                }
                onDragOver={(event) => {
                  if (list) event.preventDefault();
                }}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData("text/deskos-media");
                  if (list && list.files.includes(id)) {
                    const ids = list.files.filter((x) => x !== id);
                    ids.splice(ids.indexOf(e.id), 0, id);
                    update(ids);
                  }
                }}
              >
                <input
                  type="checkbox"
                  aria-label={"Select " + e.name}
                  checked={selected.includes(e.id)}
                  onChange={(ev) =>
                    setSelected(
                      ev.target.checked
                        ? [...selected, e.id]
                        : selected.filter((id) => id !== e.id),
                    )
                  }
                />
                <button
                  className="media-open"
                  onClick={() =>
                    onOpen(
                      e,
                      visible.map((x) => x.id),
                    )
                  }
                >
                  {kind === "photos" ? (
                    <Thumbnail entry={e} />
                  ) : (
                    <span className="media-row-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                  <span>
                    <strong>
                      {kind === "music" ? tags[e.id]?.title || e.name : e.name}
                    </strong>
                    <small>
                      {kind === "music" && tags[e.id]?.artist
                        ? tags[e.id].artist + " / "
                        : ""}
                      {formatBytes(e.size)} / {e.extension.toUpperCase()}
                    </small>
                  </span>
                </button>
                <button
                  aria-label={"Favorite " + e.name}
                  aria-pressed={e.favorite}
                  onClick={() =>
                    void fs.favorite(e.id, !e.favorite).catch(report)
                  }
                >
                  <Star size={15} fill={e.favorite ? "currentColor" : "none"} />
                </button>
                {onQueue && (
                  <button
                    aria-label={"Queue " + e.name}
                    onClick={() => onQueue(e.id)}
                  >
                    <Plus size={14} />
                  </button>
                )}
                {list && (
                  <>
                    <button
                      aria-label={"Move up " + e.name}
                      onClick={() => reorder(e.id, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      aria-label={"Move down " + e.name}
                      onClick={() => reorder(e.id, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      aria-label={"Remove " + e.name}
                      onClick={() =>
                        update(list.files.filter((id) => id !== e.id))
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {visible.length > limit && (
          <button onClick={() => setLimit((n) => n + 100)}>Show more</button>
        )}
      </section>
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}
