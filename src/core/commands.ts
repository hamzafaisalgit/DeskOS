import { useDesk } from "./store";
export type CommandEntry = {
  id: string;
  name: string;
  group: string;
  run: () => void;
};
export function systemCommands(): CommandEntry[] {
  const s = useDesk.getState;
  return [
    {
      id: "spaces",
      name: "Open Spaces overview",
      group: "Spaces",
      run: () => useDesk.setState({ overview: true }),
    },
    {
      id: "new-space",
      name: "Create Space",
      group: "Spaces",
      run: () => {
        s().createSpace("Desktop " + (s().spaces.length + 1));
      },
    },
    {
      id: "save-workspace",
      name: "Save workspace snapshot",
      group: "Spaces",
      run: () =>
        s().saveLayout(
          s().spaces.find((x) => x.id === s().activeSpace)!.name,
          "snapshot",
        ),
    },
    ...s().spaces.map((space) => ({
      id: "space-" + space.id,
      name: "Switch to " + space.name,
      group: "Spaces",
      run: () => s().switchSpace(space.id),
    })),
    ...(["cascade", "side", "grid", "center", "bounds"] as const).map(
      (mode) => ({
        id: "arrange-" + mode,
        name: "Arrange windows: " + mode,
        group: "Window actions",
        run: () => s().arrange(mode),
      }),
    ),

    {
      id: "theme",
      name: "Switch theme",
      group: "System actions",
      run: () => {
        s().setPrefs({ theme: s().prefs.theme === "light" ? "dark" : "light" });
        s().notify("Theme updated", "success");
      },
    },
    {
      id: "wallpaper",
      name: "Change wallpaper",
      group: "System actions",
      run: () => {
        s().setPrefs({ wallpaper: (s().prefs.wallpaper + 1) % 6 });
        s().notify("Wallpaper changed", "success");
      },
    },
    ...(s().active
      ? [
          {
            id: "minimize",
            name: "Minimize active window",
            group: "Window actions",
            run: () => {
              if (s().active) s().minimize(s().active!);
            },
          },
          {
            id: "maximize",
            name: "Maximize / restore active window",
            group: "Window actions",
            run: () => {
              if (s().active) s().maximize(s().active!);
            },
          },
          {
            id: "close",
            name: "Close active window",
            group: "Window actions",
            run: () => {
              if (s().active) s().close(s().active!);
            },
          },
        ]
      : []),
  ];
}
