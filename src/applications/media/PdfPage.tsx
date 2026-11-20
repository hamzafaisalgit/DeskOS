import { useEffect, useRef, useState } from "react";
import { TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
export function PdfPage({
  pdf,
  number,
  scale,
  rotation,
  query = "",
  thumbnail = false,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  scale: number;
  rotation: number;
  query?: string;
  thumbnail?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    text = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false),
    [size, setSize] = useState({ width: 612 * scale, height: 792 * scale }),
    [error, setError] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: thumbnail ? "100px" : "400px" },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [thumbnail]);
  useEffect(() => {
    let alive = true;
    let task: RenderTask | undefined, layer: TextLayer | undefined;
    const node = canvas.current,
      container = text.current;
    if (!visible || !node) return;
    void pdf
      .getPage(number)
      .then(async (page) => {
        if (!alive) return;
        const viewport = page.getViewport({ scale, rotation });
        setSize({ width: viewport.width, height: viewport.height });
        node.width = viewport.width;
        node.height = viewport.height;
        task = page.render({ canvas: node, viewport });
        await task.promise;
        if (!alive || thumbnail || !container) return;
        container.replaceChildren();
        container.style.setProperty("--scale-factor", String(scale));
        container.style.setProperty("--total-scale-factor", String(scale));
        layer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        await layer.render();
        if (query)
          container.querySelectorAll("span").forEach((span) => {
            if (span.textContent?.toLowerCase().includes(query.toLowerCase()))
              span.classList.add("search-hit");
          });
      })
      .catch((e) => {
        if (alive && e.name !== "RenderingCancelledException")
          setError(String(e));
      });
    return () => {
      alive = false;
      task?.cancel();
      layer?.cancel();
      if (container) container.replaceChildren();
      if (node) {
        node.width = 0;
        node.height = 0;
      }
    };
  }, [pdf, number, scale, rotation, query, thumbnail, visible]);
  return (
    <div
      ref={root}
      className="pdf-sheet"
      data-page={number}
      style={{ width: size.width, height: size.height }}
    >
      {error ? (
        <p>{error}</p>
      ) : (
        <>
          <canvas ref={canvas} aria-label={"PDF page " + number} />
          {!thumbnail && <div ref={text} className="textLayer" />}
        </>
      )}
    </div>
  );
}
