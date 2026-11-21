import { createContext, useContext } from "react";
export const LaunchContext = createContext<{
  appId?: string;
  entryId?: string;
  windowId?: string;
}>({});
export const useLaunchData = () => useContext(LaunchContext);
