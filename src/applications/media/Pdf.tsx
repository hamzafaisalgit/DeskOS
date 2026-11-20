import { useDesk } from "../../core/store";
import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize,
  Download,
  Printer,
  Bookmark,
  PanelLeft,
} from "lucide-react";
import { Library } from "./Shared";
import { PdfPage } from "./PdfPage";
import { filesystem as fs } from "../../core/filesystem/service";
import { useFilesystem } from "../../core/filesystem/hooks";
import { useActiveFile, report } from "../../core/media/hooks";
import { useMediaState, editableTarget } from "../../core/media/state";
import { download } from "../../core/filesystem/transfers";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function Pdf() {
  const [id, select] = useActiveFile(),
    { entries } = useFilesystem();
  const entry = entries.find((e) => e.id === id && !e.trashed);
  const meta = useMediaState();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [scale, setScale] = useState(Number(meta.preferences.pdfZoom) || 1),
    [rotation, setRotation] = useState(0),
    [continuous, setContinuous] = useState(
      meta.preferences.pdfContinuous !== false,
    ),
    [sidebar, setSidebar] = useState(true),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState<number[]>([]),
    [hit, setHit] = useState(0),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(""),
    [outline, setOutline] = useState<{ title: string; dest: unknown }[]>([]),
    [dialog, setDialog] = useState<FileDialog | null>(null),
    [tab, setTab] = useState("pages");
  const scrollDriven = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    [],
  );
  const root = useRef<HTMLDivElement>(null),
    pages = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null),
    blobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let task: ReturnType<typeof getDocument> | undefined;
    void fs
      .getEntry(id)
      .then(async (e) => {
        if (e.trashed) throw Error("This PDF is in Trash.");
        const blob = await fs.getFileContent(id);
        if (blob.size > 100 * 1024 * 1024)
          throw Error("PDFs above 100 MB should be opened externally.");
        blobRef.current = blob;
        task = getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          cMapUrl: "/pdf-assets/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdf-assets/standard_fonts/",
          wasmUrl: "/pdf-assets/wasm/",
        });
        task.onPassword = (update: (password: string) => void) => {
          if (alive)
            setDialog({
              title: "Password protected PDF",
              label: "Password",
              run: async (value) => update(value),
            });
        };
        const doc = await task.promise;
        if (!alive) {
          void task.destroy();
          return;
        }
        if (doc.numPages > 2000)
          throw Error("This reader supports up to 2,000 pages per document.");
        setPdf(doc);
        setError("");
        setPage(
          Math.min(
            doc.numPages,
            Math.max(
              1,
              Math.floor(useMediaState.getState().progress[id]?.position || 1),
            ),
          ),
        );
        const items = await doc.getOutline();
        const flat: { title: string; dest: unknown }[] = [];
        const visit = (rows: NonNullable<typeof items>) =>
          rows.forEach((item) => {
            flat.push({ title: item.title, dest: item.dest });
            if (item.items) visit(item.items);
          });
        if (items) visit(items);
        if (alive) setOutline(flat);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
      void task?.destroy();
    };
  }, [id]);
  useEffect(() => {
    if (!pdf || !id) return;
    useMediaState.getState().progressFor(id, {
      position: page,
      duration: pdf.numPages,
      opened: Date.now(),
    });
  }, [id, page, pdf]);
  useEffect(() => {
    if (scrollDriven.current) {
      scrollDriven.current = false;
      return;
    }
    if (continuous)
      pages.current
        ?.querySelector<HTMLElement>('[data-page="' + page + '"]')
        ?.scrollIntoView({ block: "start" });
  }, [page, continuous, pdf]);
  useEffect(() => {
    let cancelled = false;
    if (!pdf || !query.trim()) {
      const t = setTimeout(() => setHits([]), 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const found: number[] = [];
      try {
        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) return;
          const content = await (await pdf.getPage(n)).getTextContent();
          const value = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .toLowerCase();
          if (value.includes(query.toLowerCase())) found.push(n);
        }
        if (!cancelled) {
          setHits(found);
          setHit(0);
          if (found.length) setPage(found[0]);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pdf, query]);
  const zoom = (n: number) => {
    const value = Math.max(0.25, Math.min(3, n));
    setScale(value);
    meta.preference("pdfZoom", value);
  };
  const fit = async (mode: "width" | "page") => {
    if (!pdf || !pages.current) return;
    const p = await pdf.getPage(page),
      v = p.getViewport({ scale: 1, rotation });
    zoom(
      mode === "width"
        ? (pages.current.clientWidth - 48) / v.width
        : Math.min(
            (pages.current.clientWidth - 48) / v.width,
            (pages.current.clientHeight - 48) / v.height,
          ),
    );
  };
  const print = () => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    window.open(url, "_blank", "noopener");
    useDesk
      .getState()
      .notify(
        "Print from the browser PDF tab. If popups are blocked, download the original PDF.",
      );
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const mark = () =>
    setDialog({
      title: "Bookmark this page",
      label: "Name",
      initial: "Page " + page,
      run: async (name) => {
        if (!name.trim()) throw Error("Enter a name.");
        meta.bookmark(id, [...(meta.bookmarks[id] || []), { page, name }]);
      },
    });
  const navigate = (n: number) =>
    setPage(Math.max(1, Math.min(pdf?.numPages || 1, n)));
  return (
    <div
      className="media-app"
      ref={root}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault();
          search.current?.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "p") {
          e.preventDefault();
          print();
        }
        if (editableTarget(e.target)) return;
        if (e.key === "PageDown") {
          e.preventDefault();
          navigate(page + 1);
        }
        if (e.key === "PageUp") {
          e.preventDefault();
          navigate(page - 1);
        }
        if (e.key === "+") zoom(scale + 0.1);
        if (e.key === "-") zoom(scale - 0.1);
      }}
    >
      {!id ? (
        <Library kind="pdf" onOpen={(e) => select(e.id)} />
      ) : (
        <>
          <header className="media-topbar">
            <button
              aria-label="PDF library"
              onClick={() => {
                select("");
                setPdf(null);
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              aria-label="Toggle PDF sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              <PanelLeft size={16} />
            </button>
            <strong>{entry?.name || "PDF Studio"}</strong>
            <button
              onClick={() => navigate(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="Page number"
              type="number"
              min="1"
              max={pdf?.numPages || 1}
              value={page}
              onChange={(e) => navigate(Number(e.target.value))}
              style={{ width: 60 }}
            />
            <span>/ {pdf?.numPages || "?"}</span>
            <button onClick={() => navigate(page + 1)} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => zoom(scale - 0.1)}>-</button>
            <button onClick={() => zoom(1)}>{Math.round(scale * 100)}%</button>
            <button onClick={() => zoom(scale + 0.1)}>+</button>
            <button onClick={() => void fit("width")}>Fit width</button>
            <button onClick={() => void fit("page")}>Fit page</button>
            <button
              aria-label="Rotate PDF"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw size={15} />
            </button>
            <button
              onClick={() => {
                setContinuous(!continuous);
                meta.preference("pdfContinuous", !continuous);
              }}
            >
              {continuous ? "Continuous" : "Single page"}
            </button>
            <button
              aria-label="Fullscreen PDF"
              onClick={() =>
                void root.current?.requestFullscreen().catch(report)
              }
            >
              <Maximize size={15} />
            </button>
          </header>
          <div className="media-topbar">
            <input
              ref={search}
              aria-label="Search PDF"
              placeholder="Find in document..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span>
              {searching
                ? "Searching..."
                : query
                  ? hits.length + " matching pages"
                  : ""}
            </span>
            <button
              disabled={!hits.length}
              onClick={() => {
                const n = (hit - 1 + hits.length) % hits.length;
                setHit(n);
                navigate(hits[n]);
              }}
            >
              Previous match
            </button>
            <button
              disabled={!hits.length}
              onClick={() => {
                const n = (hit + 1) % hits.length;
                setHit(n);
                navigate(hits[n]);
              }}
            >
              Next match
            </button>
            <button aria-label="Bookmark page" onClick={mark}>
              <Bookmark size={15} />
            </button>
            <button
              aria-label="Download PDF"
              onClick={() => {
                if (blobRef.current)
                  download(blobRef.current, entry?.name || "document.pdf");
              }}
            >
              <Download size={15} />
            </button>
            <button
              aria-label="Print PDF"
              title="Open original in browser PDF viewer to print"
              onClick={print}
            >
              <Printer size={15} />
            </button>
          </div>
          {(error || !entry) && (
            <p role="alert" className="media-error">
              {error || "This file is missing or in Trash."}
            </p>
          )}
          {query && !searching && !hits.length && (
            <p className="media-notice">
              No text matches. Scanned pages require OCR, which is not included.
            </p>
          )}
          {pdf ? (
            <div className="pdf-layout">
              {sidebar && (
                <aside className="pdf-sidebar">
                  <select
                    aria-label="PDF navigation"
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                  >
                    <option value="pages">Pages</option>
                    <option value="outline">Outline</option>
                    <option value="bookmarks">Bookmarks</option>
                  </select>
                  {tab === "pages" &&
                    Array.from({ length: pdf.numPages }, (_, i) => (
                      <button
                        key={i}
                        className={page === i + 1 ? "selected" : ""}
                        onClick={() => navigate(i + 1)}
                        style={{ display: "block" }}
                      >
                        <PdfPage
                          pdf={pdf}
                          number={i + 1}
                          scale={0.16}
                          rotation={0}
                          thumbnail
                        />
                        {i + 1}
                      </button>
                    ))}
                  {tab === "outline" &&
                    (outline.length ? (
                      outline.map((o, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            void (async () => {
                              const dest =
                                typeof o.dest === "string"
                                  ? await pdf.getDestination(o.dest)
                                  : o.dest;
                              if (Array.isArray(dest)) {
                                const n =
                                  typeof dest[0] === "number"
                                    ? dest[0]
                                    : await pdf.getPageIndex(dest[0]);
                                navigate(n + 1);
                              }
                            })().catch(report);
                          }}
                        >
                          {o.title}
                        </button>
                      ))
                    ) : (
                      <p>No document outline.</p>
                    ))}
                  {tab === "bookmarks" &&
                    (meta.bookmarks[id] || []).map((b, i) => (
                      <div key={i}>
                        <button onClick={() => navigate(b.page)}>
                          {b.name} / {b.page}
                        </button>
                        <button
                          onClick={() =>
                            meta.bookmark(
                              id,
                              (meta.bookmarks[id] || []).filter(
                                (_, j) => i !== j,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </aside>
              )}
              <div
                className="pdf-pages"
                ref={pages}
                onScroll={() => {
                  if (!continuous || !pages.current) return;
                  if (scrollTimer.current) clearTimeout(scrollTimer.current);
                  scrollTimer.current = setTimeout(() => {
                    const container = pages.current;
                    if (!container) return;
                    const top = container.getBoundingClientRect().top;
                    const sheets = [
                      ...container.querySelectorAll<HTMLElement>("[data-page]"),
                    ];
                    const current = sheets.find(
                      (node) => node.getBoundingClientRect().bottom > top + 50,
                    );
                    const n = Number(current?.dataset.page);
                    if (n && n !== page) {
                      scrollDriven.current = true;
                      setPage(n);
                    }
                  }, 200);
                }}
              >
                {(continuous
                  ? Array.from({ length: pdf.numPages }, (_, i) => i + 1)
                  : [page]
                ).map((n) => (
                  <PdfPage
                    key={n}
                    pdf={pdf}
                    number={n}
                    scale={scale}
                    rotation={rotation}
                    query={query}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="media-empty">
              {error ? "Unable to load this PDF." : "Opening document..."}
            </div>
          )}
        </>
      )}
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}
