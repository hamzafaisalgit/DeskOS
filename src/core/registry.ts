import { lazy } from "react";
import {
  Folder,
  Code2,
  Terminal,
  StickyNote,
  Calculator,
  Settings,
} from "lucide-react";
export type AppId =
  "files" | "terminal" | "notes" | "calculator" | "settings" | "code";
export const apps = [
  {
    id: "files",
    icon: Folder,
    component: lazy(() =>
      import("../applications/files/FileExplorer").then((m) => ({
        default: m.FileExplorer,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Files",
    category: "System",
    description: "Browse, organize and preview your local files",
    color: "#6eacfa",
    width: 1050,
    height: 660,
    minWidth: 360,
    minHeight: 280,
    single: false,
  },
  {
    id: "terminal",
    icon: Terminal,
    component: lazy(() =>
      import("../applications/terminal/Terminal").then((m) => ({
        default: m.TerminalApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Terminal",
    category: "Development",
    description: "Explore your desktop with DeskShell",
    color: "#9e91ed",
    width: 720,
    height: 440,
    minWidth: 340,
    minHeight: 260,
    single: false,
  },
  {
    id: "notes",
    icon: StickyNote,
    component: lazy(() =>
      import("../applications/editor/DocumentEditor").then((m) => ({
        default: m.NotesApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["md", "txt", "markdown"],
    name: "Notes",
    category: "Productivity",
    description: "A quiet place for your thoughts",
    color: "#f4c674",
    width: 780,
    height: 520,
    minWidth: 360,
    minHeight: 300,
    single: true,
  },
  {
    id: "calculator",
    icon: Calculator,
    component: lazy(() =>
      import("../applications/editor/Calculator").then((m) => ({
        default: m.CalculatorApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Calculator",
    category: "Utilities",
    description: "Make room for a little clarity",
    color: "#7bd6b5",
    width: 360,
    height: 500,
    minWidth: 300,
    minHeight: 420,
    single: true,
  },
  {
    id: "settings",
    icon: Settings,
    component: lazy(() =>
      import("../applications/Settings").then((m) => ({
        default: m.SettingsApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Settings",
    category: "System",
    description: "Make this space your own",
    color: "#b5b9ca",
    width: 820,
    height: 580,
    minWidth: 360,
    minHeight: 300,
    single: true,
  },
  {
    id: "code",
    icon: Code2,
    component: lazy(() =>
      import("../applications/editor/DocumentEditor").then((m) => ({
        default: m.CodeStudio,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["html", "css", "js", "ts", "json", "md", "txt"],
    name: "Code Studio",
    category: "Development",
    description: "Edit shared files and preview web projects",
    color: "#76bce7",
    width: 1100,
    height: 700,
    minWidth: 400,
    minHeight: 320,
    single: false,
  },
] as const;
export const appById = (id: AppId) => apps.find((a) => a.id === id)!;
export const searchApps = (query: string) =>
  apps.filter((a) =>
    `${a.name} ${a.description} ${a.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
