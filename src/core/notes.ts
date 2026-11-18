import { create } from "zustand";
import { readStorage, writeStorage } from "./storage";
export type Note = { id: string; title: string; text: string; updated: number };
const raw = readStorage("notes");
export const useNotes = create<{
  notes: Note[];
  save: (note: Note) => boolean;
  remove: (id: string) => boolean;
}>((set, get) => ({
  notes: Array.isArray(raw)
    ? raw.filter(
        (n): n is Note =>
          n &&
          typeof n.id === "string" &&
          typeof n.title === "string" &&
          typeof n.text === "string" &&
          typeof n.updated === "number",
      )
    : [],
  save: (note) => {
    const notes = [note, ...get().notes.filter((n) => n.id !== note.id)];
    set({ notes });
    return writeStorage("notes", notes);
  },
  remove: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    set({ notes });
    return writeStorage("notes", notes);
  },
}));
