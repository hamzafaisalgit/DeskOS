import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test("dock, launcher, desktop and command palette open apps without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Launch Files", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Files window" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open application launcher" }).click();
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill("notes");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Notes window" }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill("calculator");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Calculator window" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Close Notes", exact: true }).click();
  await page.getByRole("button", { name: "Close Files", exact: true }).click();
  await page
    .locator(".desktop-icon")
    .filter({ hasText: "Terminal" })
    .dblclick();
  await expect(
    page.getByRole("region", { name: "Terminal window" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("window dragging, resizing, minimize, maximize, snap and reload restoration", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Launch Files", exact: true }).click();
  const win = page.locator(".window");
  const before = (await win.boundingBox())!;
  await page.locator(".window-title").hover({ position: { x: 100, y: 20 } });
  await page.mouse.down();
  await page.mouse.move(before.x + 180, before.y + 90, { steps: 10 });
  await page.mouse.up();
  const moved = (await win.boundingBox())!;
  expect(moved.x).toBeGreaterThan(before.x + 20);
  await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height - 2);
  await page.mouse.down();
  await page.mouse.move(
    moved.x + moved.width + 50,
    moved.y + moved.height + 35,
    { steps: 10 },
  );
  await page.mouse.up();
  expect((await win.boundingBox())!.width).toBeGreaterThan(moved.width);
  const normal = (await win.boundingBox())!;
  await page
    .getByRole("button", { name: "Snap Files left", exact: true })
    .click();
  expect((await win.boundingBox())!.x).toBeLessThan(2);
  await page.getByRole("button", { name: "Maximize or restore Files" }).click();
  expect((await win.boundingBox())!.width).toBeCloseTo(normal.width, 0);
  await page.getByRole("button", { name: "Maximize or restore Files" }).click();
  expect((await win.boundingBox())!.width).toBe(1366);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Files window" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Maximize or restore Files" }).click();
  expect((await win.boundingBox())!.width).toBeCloseTo(normal.width, 0);
  await page
    .getByRole("button", { name: "Minimize Files", exact: true })
    .click();
  await expect(win).toBeHidden();
  await page.getByRole("button", { name: "Launch Files", exact: true }).click();
  await expect(win).toBeVisible();
  await page.getByRole("button", { name: "Close Files", exact: true }).click();
  await expect(win).toHaveCount(0);
});
test("notes create, rename, autosave, reload, cancel delete and confirm delete", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Launch Notes", exact: true }).click();
  await page.getByRole("button", { name: "Create a note" }).click();
  await page
    .getByRole("textbox", { name: "Note title", exact: true })
    .fill("My persisted note");
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("A real saved thought.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note text", exact: true }),
  ).toHaveValue("A real saved thought.");
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Note title", exact: true }),
  ).toHaveValue("My persisted note");
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create a note" }),
  ).toBeVisible();
});
test("terminal commands, history, errors and calculator keyboard", async ({
  page,
}) => {
  await page.keyboard.press("Control+Alt+t");
  const input = page.getByRole("textbox", { name: "Terminal command" });
  await input.fill("echo hello");
  await input.press("Enter");
  await expect(
    page.locator("pre").filter({ hasText: /^hello$/ }),
  ).toBeVisible();
  await input.press("ArrowUp");
  await expect(input).toHaveValue("echo hello");
  await input.fill("open calculator");
  await input.press("Enter");
  const calc = page.getByLabel("Calculator keypad");
  await calc.focus();
  await page.keyboard.type("(2+3)*4");
  await page.keyboard.press("Enter");
  await expect(page.locator("output")).toHaveText("20");
  await page
    .getByRole("button", { name: "Close Calculator", exact: true })
    .click();
  await input.fill("invalidcommand");
  await input.press("Enter");
  await expect(
    page.locator("pre").filter({ hasText: "Command not found:" }),
  ).toBeVisible();
  await input.fill("clear");
  await input.press("Enter");
  await expect(page.locator("pre")).toHaveCount(0);
});
test("settings change appearance, wallpaper preview, dock and persistence", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Open Settings", exact: true })
    .click();
  const settings = page.getByRole("region", { name: "Settings window" });
  await settings.getByRole("button", { name: "light", exact: true }).click();
  await expect(page.locator("main")).toHaveClass(/light/);
  const old = await page
    .locator(".wallpaper-layer")
    .nth(1)
    .getAttribute("style");
  await page.getByRole("button", { name: "Preview Dune", exact: true }).click();
  expect(
    await page.locator(".wallpaper-layer").nth(1).getAttribute("style"),
  ).toBe(old);
  await page.getByRole("button", { name: "Apply wallpaper" }).click();
  expect(
    await page.locator(".wallpaper-layer").nth(1).getAttribute("style"),
  ).not.toBe(old);
  await settings.getByRole("button", { name: "Taskbar", exact: true }).click();
  await settings.getByRole("combobox").selectOption("full");
  await expect(page.getByRole("navigation", { name: "Taskbar" })).toHaveClass(
    /full/,
  );
  await page.reload();
  await expect(page.locator("main")).toHaveClass(/light/);
  await expect(page.getByRole("navigation", { name: "Taskbar" })).toHaveClass(
    /full/,
  );
});
test("context menus, app information, pinning and notifications", async ({
  page,
}) => {
  const notes = page.locator(".desktop-icon").filter({ hasText: "Notes" });
  await notes.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Application information" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "A quiet place for your thoughts",
  );
  await page.keyboard.press("Escape");
  await notes.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Unpin from taskbar" }).click();
  await expect(
    page.getByRole("button", { name: "Launch Notes", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Notes unpinned");
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByRole("dialog")).toContainText("All caught up.");
  await page.keyboard.press("Escape");
  await page
    .locator(".workspace")
    .click({ button: "right", position: { x: 1100, y: 650 } });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
});
test("narrow viewport and malformed persisted data recover", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("deskos.v1.preferences", "{broken");
    localStorage.setItem("deskos.v1.windows", '[null,{"appId":"unknown"}]');
  });
  await page.setViewportSize({ width: 600, height: 700 });
  await page.reload();
  await page
    .getByRole("button", { name: "Launch Settings", exact: true })
    .click();
  const bounds = (await page.locator(".window").boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(600);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(628);
  await expect(
    page.getByRole("button", { name: "Close Settings", exact: true }),
  ).toBeInViewport();
});
test("search empty state, action execution, Escape focus return and show desktop", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Launch Files", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const input = page.getByRole("textbox", {
    name: "Search applications and commands",
  });
  await input.fill("nothing matches xyz");
  await expect(page.getByText("No matches", { exact: true })).toBeVisible();
  await input.fill("switch theme");
  await input.press("Enter");
  await expect(page.locator("main")).toHaveClass(/light/);
  await page.keyboard.press("Control+Alt+d");
  await expect(page.locator(".window")).toBeHidden();
  await page.keyboard.press("Control+Alt+d");
  await expect(page.locator(".window")).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeFocused();
});

test("shortcut movement persists and keyboard activation launches it", async ({
  page,
}) => {
  const icon = page.locator(".desktop-icon").filter({ hasText: "Notes" });
  const original = (await icon.boundingBox())!;
  await icon.hover();
  await page.mouse.down();
  await page.mouse.move(original.x + 180, original.y + 90, { steps: 10 });
  await page.mouse.up();
  const moved = (await icon.boundingBox())!;
  expect(moved.x).toBeGreaterThan(original.x + 50);
  await page.reload();
  expect((await icon.boundingBox())!.x).toBeCloseTo(moved.x, 0);
  await icon.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Notes window" }),
  ).toBeVisible();
});
test("multiple windows retain state through minimize and focus switches", async ({
  page,
}) => {
  await page.keyboard.press("Control+Alt+t");
  const first = page.getByRole("textbox", { name: "Terminal command" });
  await first.fill("echo preserved");
  await first.press("Enter");
  await first.fill("open terminal");
  await first.press("Enter");
  await expect(
    page.getByRole("region", { name: "Terminal window" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Minimize Terminal", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("region", { name: "Terminal window" }),
  ).toHaveCount(1);
  await expect(
    page.locator("pre").filter({ hasText: /^preserved$/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Launch Terminal", exact: true })
    .hover();
  await expect(page.locator(".window-list button")).toHaveCount(2);
  await page.locator(".window-list button").last().click();
  await expect(
    page.getByRole("region", { name: "Terminal window" }),
  ).toHaveCount(2);
});
test("storage failure is visible while notes stay editable in memory", async ({
  page,
}) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Launch Notes", exact: true }).click();
  await page.getByRole("button", { name: "Create a note" }).click();
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("Keep this text");
  await expect(
    page.getByText("Storage unavailable — copy your text before closing"),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Note text", exact: true }),
  ).toHaveValue("Keep this text");
  await expect(page.locator(".toast.error").first()).toBeVisible();
});
