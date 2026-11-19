import { createContext, useContext } from "react";
export const LaunchContext = createContext<{
  entryId?: string;
  windowId?: string;
}>({});
export const useLaunchData = () => useContext(LaunchContext);
