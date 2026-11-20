import { test, expect } from "@playwright/test";
test("Spaces preserve unsaved editors, move windows, restore snapshots and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Launch Notes", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a note", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Note text" })
    .fill("Unsaved across Spaces");
  await page.getByRole("button", { name: "Open Spaces overview" }).click();
  await page.getByRole("button", { name: "New Space", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Work");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch to Work", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Notes window" })).toBeHidden();
  await page.keyboard.press("Control+Alt+1");
  await expect(page.getByRole("textbox", { name: "Note text" })).toHaveValue(
    "Unsaved across Spaces",
  );
  await page.getByRole("button", { name: "Open Spaces overview" }).click();
  await page
    .getByRole("combobox", { name: "Move Notes to Space" })
    .selectOption({ label: "Work" });
  await page
    .getByRole("button", { name: "Switch to Work", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Note text" })).toHaveValue(
    "Unsaved across Spaces",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Open Spaces overview" }).click();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "snapshots", exact: true }).click();
  await page.getByRole("button", { name: "Layout only", exact: true }).click();
  await page.getByRole("button", { name: "Close Spaces overview" }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Note text" })).toHaveValue(
    "Unsaved across Spaces",
  );
  await page.getByRole("button", { name: "Open Spaces overview" }).click();
  await expect(page.locator(".spaces-overview")).toHaveCSS("opacity","1");
  await page.screenshot({ path: "docs/phase5-spaces.png" });
  expect(errors).toEqual([]);
});
