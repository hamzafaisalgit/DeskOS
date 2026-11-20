import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("Capsule download validates and merges without replacing originals; Time Machine restores a copy", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.keyboard.press("Control+Alt+t");
  const command = page.getByRole("textbox", { name: "Terminal command" });
  for (const text of [
    'echo "first saved version" > Documents/Recovered.txt',
    'echo "current saved version" > Documents/Recovered.txt',
  ]) {
    await command.fill(text);
    await command.press("Enter");
    await expect(command).toBeEnabled();
  }
  const launch = async (name: string) => {
    await page.keyboard.press("Control+k");
    await page
      .getByRole("textbox", { name: "Search applications and commands" })
      .fill(name);
    await page.keyboard.press("Enter");
    return page.getByRole("region", { name: name + " window" });
  };
  const capsule = await launch("Capsule");
  await capsule
    .getByRole("button", { name: "Files only", exact: true })
    .click();
  await capsule
    .getByRole("button", { name: "Review selection", exact: false })
    .click();
  const download = page.waitForEvent("download");
  await capsule
    .getByRole("button", { name: "Generate .deskpack", exact: true })
    .click();
  const archive = await download;
  expect(archive.suggestedFilename()).toMatch(/\.deskpack$/);
  const path = await archive.path();
  const bytes = await readFile(path!);
  await capsule
    .getByRole("button", { name: "Import & restore", exact: true })
    .click();
  await capsule
    .getByLabel("Import Capsule")
    .setInputFiles({
      name: "Backup.deskpack",
      mimeType: "application/zip",
      buffer: bytes,
    });
  await expect(
    capsule.getByText("Validated Capsule", { exact: true }),
  ).toBeVisible();
  await capsule
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await capsule
    .getByRole("button", { name: "Confirm restore...", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    capsule.getByText("File import completed. Existing files preserved.", {
      exact: true,
    }),
  ).toBeVisible();
  const time = await launch("Time Machine");
  await time.locator(".version-list button").first().click();
  await expect(time.locator(".text-diff")).toContainText("first saved version");
  await time
    .getByRole("button", { name: "Restore as Copy", exact: true })
    .click();
  await expect(
    time.getByText("Recovered copy saved without changing the original file.", {
      exact: true,
    }),
  ).toBeVisible();
  await time
    .getByRole("button", { name: "Restore points", exact: true })
    .click();
  await time
    .getByRole("button", { name: "Workspace only", exact: true })
    .click();
  await time
    .getByRole("textbox", { name: "Restore point name", exact: true })
    .fill("Browser verified");
  await time
    .getByRole("button", { name: "Create verified point", exact: true })
    .click();
  await expect(
    time.locator(".point-card").filter({ hasText: "Browser verified" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/phase6-recovery.png" });
  expect(errors).toEqual([]);
});
