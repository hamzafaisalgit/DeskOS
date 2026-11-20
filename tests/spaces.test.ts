import { beforeEach, expect, it } from "vitest";
import { useDesk } from "../src/core/store";
import { validateSpaces, DEFAULT_SPACE } from "../src/core/spaces/model";
beforeEach(() =>
  useDesk.setState({
    spaces: validateSpaces(null, 0),
    activeSpace: DEFAULT_SPACE,
    windows: [],
    active: null,
    layouts: [],
    hidden: [],
  }),
);
it("moves windows without changing identity and safely reassigns deleted Spaces", () => {
  const s = useDesk.getState;
  s().open("terminal");
  const id = s().active!;
  const second = s().createSpace("Work");
  expect(s().active).toBeNull();
  s().moveWindowToSpace(id, second, true);
  expect(s().active).toBe(id);
  expect(s().windows[0].spaceId).toBe(second);
  s().deleteSpace(second, DEFAULT_SPACE);
  expect(s().windows[0].id).toBe(id);
  expect(s().windows[0].spaceId).toBe(DEFAULT_SPACE);
  expect(() => s().deleteSpace(DEFAULT_SPACE, DEFAULT_SPACE)).toThrow();
});
it("restores geometry without duplicating current instances", async () => {
  const s = useDesk.getState;
  s().open("files");
  const w = s().windows[0];
  s().saveLayout("Saved", "snapshot");
  s().bounds(w.id, { x: 0, y: 0, width: 400, height: 300 });
  await s().restoreLayout(s().layouts[0].id, "layout");
  expect(s().windows).toHaveLength(1);
  expect(s().windows[0].width).toBe(w.width);
  expect(s().windows[0].id).toBe(w.id);
});
it("migrates invalid Spaces to a usable desktop", () => {
  expect(validateSpaces([null, { name: "bad" }], 2)[0]).toMatchObject({
    id: DEFAULT_SPACE,
    wallpaper: 2,
  });
});
