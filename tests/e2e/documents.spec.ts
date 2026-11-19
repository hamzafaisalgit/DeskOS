import { expect, test } from "@playwright/test";
test("Notes Code Studio and Terminal share files and protect dirty edits", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Launch Notes", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a note", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Integrated.md");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const notes = page.getByRole("region", { name: "Notes window" });
  await notes
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("# Shared document\nFrom Notes");
  await notes.getByRole("button", { name: "Save", exact: true }).click();
  await page.keyboard.press("Control+Alt+t");
  const terminal = page.getByRole("textbox", { name: "Terminal command" });
  await terminal.fill("cat /Home/Documents/Integrated.md");
  await terminal.press("Enter");
  await expect(
    page.locator("pre").filter({ hasText: "From Notes" }),
  ).toBeVisible();
  await terminal.fill("open code");
  await terminal.press("Enter");
  const code = page.getByRole("region", { name: "Code Studio window" });
  await code.getByRole("button", { name: "all", exact: true }).click();
  await code
    .locator(".document-file-list button")
    .filter({ hasText: "Integrated.md" })
    .click();
  await expect(code.locator(".monaco-editor")).toBeVisible({ timeout: 45000 });
  await code.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("# Shared document\nFrom Code Studio");
  await code.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Launch Notes", exact: true }).click();
  await expect(
    notes.getByText("This file changed in another application.", {
      exact: false,
    }),
  ).toBeVisible();
  await notes.getByRole("button", { name: "Reload latest" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(notes.getByRole("textbox", { name: "Note text" })).toHaveValue(
    "# Shared document\nFrom Code Studio",
  );
  await notes.getByRole("textbox", { name: "Note text" }).fill("unsaved");
  await page.getByRole("button", { name: "Close Notes", exact: true }).click();
  await expect(
    page.getByText("Save your changes?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(notes.getByRole("textbox", { name: "Note text" })).toHaveValue(
    "unsaved",
  );
  await page.screenshot({ path: "docs/phase3-notes-preview.png" });
  expect(errors).toEqual([]);
});

test("saved web projects run local CSS and scripts in an isolated preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Control+Alt+t");
  const input = page.getByRole("textbox", { name: "Terminal command" });
  for (const command of [
    "cd Projects",
    `echo 'h1 { color: rgb(255, 0, 0); }' > style.css`,
    `echo 'document.querySelector("h1").textContent="Running"; try { parent.document.body; } catch { document.body.dataset.isolated="yes"; }' > app.js`,
    `echo '<link rel="stylesheet" href="style.css"><h1>Ready</h1><script src="app.js"></script>' > index.html`,
    "open index.html",
  ]) {
    await input.fill(command);
    await input.press("Enter");
    await expect(input).toBeEnabled();
  }
  const code = page.getByRole("region", { name: "Code Studio window" });
  await code.getByRole("button", { name: "Run preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Project preview"]');
  await expect(frame.locator("h1")).toHaveText("Running");
  await expect(frame.locator("h1")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(frame.locator("body")).toHaveAttribute("data-isolated", "yes");
  await expect(page.locator('iframe[title="Project preview"]')).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
  await page.screenshot({ path: "docs/phase3-code-preview.png" });
});
