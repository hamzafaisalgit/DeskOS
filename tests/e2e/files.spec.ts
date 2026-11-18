import { expect, test } from "@playwright/test";
test("filesystem create edit export trash restore and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Launch Files", exact: true }).click();
  const files = page.getByRole("region", { name: "Files window" }).last();
  await files.getByRole("button", { name: "Documents", exact: true }).click();
  await files.getByRole("button", { name: "New folder", exact: true }).click();
  const name = `Browser check ${Date.now()}`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await files.locator(".file-item").filter({ hasText: name }).dblclick();
  await files
    .getByRole("combobox", { name: "New file type" })
    .selectOption("txt");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("sample.txt");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await files
    .locator(".file-item")
    .filter({ hasText: "sample.txt" })
    .dblclick();
  await page
    .getByRole("textbox", { name: "File text", exact: true })
    .fill("Persistent virtual content");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  const item = files.locator(".file-item").filter({ hasText: "sample.txt" });
  await item.click();
  const download = page.waitForEvent("download");
  await files.getByRole("button", { name: "Export selection" }).click();
  expect((await download).suggestedFilename()).toBe("sample.txt");
  await files.getByRole("button", { name: "Trash selection" }).click();
  await expect(item).toHaveCount(0);
  await files.getByRole("button", { name: /^Trash/ }).click();
  await files.locator(".file-item").filter({ hasText: "sample.txt" }).click();
  await files.getByRole("button", { name: "Restore", exact: true }).click();
  await files.getByRole("textbox", { name: "Search files" }).fill("sample.txt");
  await files
    .getByRole("button", { name: "Home", exact: true })
    .first()
    .click();
  await files.getByRole("textbox", { name: "Search files" }).fill("sample.txt");
  await files
    .locator(".file-item")
    .filter({ hasText: "sample.txt" })
    .dblclick();
  await expect(
    page.getByRole("textbox", { name: "File text", exact: true }),
  ).toHaveValue("Persistent virtual content");
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Files window" }).last(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
