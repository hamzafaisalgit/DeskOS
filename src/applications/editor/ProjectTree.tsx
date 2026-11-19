import { useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import type { Entry } from "../../core/filesystem/types";
import { ContextMenu } from "../../components/Overlays";
import type { MenuItem } from "../../components/Overlays";
type Props = {
  entries: Entry[];
  root: string;
  active: string;
  open: (id: string) => void;
  folder: (id: string) => void;
  rename: (entry: Entry) => void;
  trash: (entry: Entry) => void;
};
export function ProjectTree(props: Props) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  function branch(parent: string, depth = 0) {
    if (depth > 30) return null;
    return props.entries
      .filter((e) => e.parentId === parent && !e.trashed)
      .sort(
        (a, b) =>
          Number(b.kind === "directory") - Number(a.kind === "directory") ||
          a.name.localeCompare(b.name),
      )
      .map((e) => {
        const context = (event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
              {
                label:
                  e.kind === "directory" ? "Use as project folder" : "Open",
                run: () =>
                  e.kind === "directory"
                    ? props.folder(e.id)
                    : props.open(e.id),
              },
              {
                label: "Rename",

                run: () => props.rename(e),
              },
              {
                label: "Move to Trash",

                run: () => props.trash(e),
              },
            ],
          });
        };
        return e.kind === "directory" ? (
          <details key={e.id} className="project-tree-folder">
            <summary onContextMenu={context}>
              <FolderOpen size={14} />
              {e.name}
            </summary>
            <div>{branch(e.id, depth + 1)}</div>
          </details>
        ) : (
          <button
            key={e.id}
            className={props.active === e.id ? "selected" : ""}
            onClick={() => props.open(e.id)}
            onContextMenu={context}
          >
            <FileText size={15} />
            <span>{e.name}</span>
          </button>
        );
      });
  }
  return (
    <>
      <div className="project-tree">{branch(props.root)}</div>
      {menu && <ContextMenu {...menu} close={() => setMenu(null)} />}
    </>
  );
}
