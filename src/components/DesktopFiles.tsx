import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { useFilesystem } from "../core/filesystem/hooks";
import { filesystem } from "../core/filesystem/service";
import { folderId } from "../core/filesystem/types";
import { dragType } from "../core/filesystem/clipboard";
import { importFiles } from "../core/filesystem/transfers";
import { useDesk } from "../core/store";
import { FileIcon, FilePreview } from "../applications/files/FilePreview";
import { OperationDialog } from "../applications/files/OperationDialog";
import type { FileDialog } from "../applications/files/OperationDialog";
import { ContextMenu } from "./Overlays";
import type { MenuItem } from "./Overlays";
import "../applications/files/files.css";
export function DesktopFiles() {
  const { entries } = useFilesystem();
  const [preview, setPreview] = useState<string | null>(null);
  const [dialog, setDialog] = useState<FileDialog | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const desktop = folderId("Desktop");
  const files = entries.filter((e) => e.parentId === desktop && !e.trashed);
  const notify = (e: unknown) => useDesk.getState().notify(String(e), "error");
  function create(kind: "file" | "directory") {
    setDialog({
      title: kind === "file" ? "New desktop document" : "New desktop folder",
      label: "Name",
      initial: kind === "file" ? "Untitled.txt" : "Untitled folder",
      run: (name) =>
        kind === "file"
          ? filesystem.createFile(desktop, name)
          : filesystem.createDirectory(desktop, name),
    });
  }
  return (
    <div className="desktop-files">
      <button
        className="desktop-create"
        onClick={(e) =>
          setMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: "New desktop folder", run: () => create("directory") },
              { label: "New desktop text file", run: () => create("file") },
              {
                label: "Open Desktop folder",
                run: () => useDesk.getState().open("files", desktop),
              },
            ],
          })
        }
      >
        <Plus size={14} />
        Desktop files
      </button>
      <div
        className="desktop-files-hint"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length)
            void importFiles(desktop, Array.from(e.dataTransfer.files)).catch(
              notify,
            );
          else {
            try {
              const ids: unknown = JSON.parse(e.dataTransfer.getData(dragType));
              if (
                Array.isArray(ids) &&
                ids.every((id) => typeof id === "string")
              )
                void filesystem.transfer(ids, desktop).catch(notify);
            } catch {
              notify("Invalid drop");
            }
          }
        }}
      >
        Drop here to add to Desktop
      </div>
      {files.map((entry, i) => {
        const x = Math.max(
          110,
          Math.min(
            entry.position?.x ?? 125 + Math.floor(i / 5) * 100,
            window.innerWidth - 100,
          ),
        );
        const y = Math.max(
          10,
          Math.min(
            entry.position?.y ?? 20 + (i % 5) * 102,
            window.innerHeight - 250,
          ),
        );
        return (
          <button
            key={entry.id}
            className="desktop-file"
            style={{ left: x, top: y }}
            draggable
            onClick={(e) => e.currentTarget.focus()}
            onDragOver={(e) => {
              if (entry.kind === "directory") {
                e.preventDefault();
                e.currentTarget.classList.add("drop-target");
              }
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("drop-target");
              if (entry.kind !== "directory") return;
              if (e.dataTransfer.files.length) {
                void importFiles(
                  entry.id,
                  Array.from(e.dataTransfer.files),
                ).catch(notify);
                return;
              }
              try {
                const ids: unknown = JSON.parse(
                  e.dataTransfer.getData(dragType),
                );
                if (
                  Array.isArray(ids) &&
                  ids.every((id) => typeof id === "string")
                )
                  void filesystem.transfer(ids, entry.id).catch(notify);
              } catch {
                notify("Invalid drop");
              }
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData(dragType, JSON.stringify([entry.id]));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={(e) => {
              if (e.clientX > 0 && e.clientY > 40)
                void filesystem
                  .position(entry.id, { x: e.clientX - 40, y: e.clientY - 80 })
                  .catch(notify);
            }}
            onDoubleClick={() => {
              if (entry.kind === "directory")
                useDesk.getState().open("files", entry.id);
              else setPreview(entry.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (entry.kind === "directory")
                  useDesk.getState().open("files", entry.id);
                else setPreview(entry.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  {
                    label: "Open",
                    run: () => {
                      if (entry.kind === "directory")
                        useDesk.getState().open("files", entry.id);
                      else setPreview(entry.id);
                    },
                  },
                  {
                    label: "Rename",
                    run: () =>
                      setDialog({
                        title: "Rename desktop item",
                        label: "Name",
                        initial: entry.name,
                        run: (name) => filesystem.renameEntry(entry.id, name),
                      }),
                  },
                  {
                    label: "Move to Trash",
                    run: () =>
                      void filesystem.deleteEntry(entry.id).catch(notify),
                  },
                ],
              });
            }}
          >
            <FileIcon entry={entry} size={33} />
            <span>{entry.name}</span>
          </button>
        );
      })}
      {menu && <ContextMenu {...menu} close={closeMenu} />}
      {dialog && <OperationDialog dialog={dialog} close={closeDialog} />}
      {preview && entries.find((e) => e.id === preview && !e.trashed) && (
        <FilePreview
          entry={entries.find((e) => e.id === preview)!}
          close={closePreview}
        />
      )}
    </div>
  );
}
