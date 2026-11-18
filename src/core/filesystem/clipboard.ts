import { create } from "zustand";
export const useFileClipboard = create<{
  ids: string[];
  cut: boolean;
  set: (ids: string[], cut: boolean) => void;
}>((set) => ({ ids: [], cut: false, set: (ids, cut) => set({ ids, cut }) }));
export const dragType = "application/x-deskos-files";
