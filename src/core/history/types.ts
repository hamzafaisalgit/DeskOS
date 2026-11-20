export type FileVersion = {
  id: string;
  fileId: string;
  name: string;
  mime: string;
  created: number;
  revision: number;
  size: number;
  blob: Blob;
};
export type RestorePoint = {
  id: string;
  name: string;
  description: string;
  created: number;
  categories: string[];
  size: number;
  archive: Blob;
  automatic: boolean;
};
export type RecoveryJournal = {
  id: string;
  created: number;
  state: "applying" | "failed" | "complete";
  message: string;
  checkpoint?: string;
};
