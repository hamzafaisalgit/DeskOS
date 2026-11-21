import { expect, test } from "@playwright/test";
test("App Center installs isolated apps and permissions can be revoked", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Open application launcher" }).click();
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill("App Center");
  await page.keyboard.press("Enter");
  const center = page.getByRole("region", { name: "App Center window" });
  await center
    .locator(".catalog-app")
    .filter({ hasText: "Unit Converter" })
    .click();
  await center.getByRole("button", { name: "Install", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await center.getByRole("button", { name: "Open", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Unit Converter sandbox"]');
  await expect(frame.locator("#result")).toHaveText("0.621371");
  await frame.locator("#value").fill("10");
  await expect(frame.locator("#result")).toHaveText("6.213712");
  await expect(
    page.locator('iframe[title="Unit Converter sandbox"]'),
  ).toHaveAttribute("sandbox", "allow-scripts");
  const isolation = await frame.locator("body").evaluate(() => {
    try {
      void parent.document.body;
      return false;
    } catch {
      return true;
    }
  });
  expect(isolation).toBe(true);
  await page
    .getByRole("button", { name: "Close Unit Converter", exact: true })
    .click();
  await center.getByRole("button", { name: "Catalog", exact: true }).click();
  await center
    .locator(".catalog-app")
    .filter({ hasText: "Color Palette Studio" })
    .click();
  await center.getByRole("button", { name: "Install", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await center.getByRole("button", { name: "Open", exact: true }).click();
  const palette = page.frameLocator(
    'iframe[title="Color Palette Studio sandbox"]',
  );
  await palette.locator("#save").click();
  await expect(
    page.getByText("Requests", { exact: false }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remember", exact: true }).click();
  await expect(palette.locator("#status")).toHaveText(
    "Saved to app-owned storage",
  );
  await page
    .getByRole("button", { name: "Minimize Color Palette Studio", exact: true })
    .click();
  await center
    .getByRole("button", { name: "Revoke all permissions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Launch Color Palette Studio", exact: true })
    .click();
  await palette.locator("#save").click();
  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(palette.locator("#status")).toContainText("Permission denied");
  await page
    .getByRole("button", { name: "Close Color Palette Studio", exact: true })
    .click();
  await center.getByRole("button", { name: "Uninstall", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await center.getByRole("button", { name: "Installed", exact: true }).click();
  await expect(
    center.locator(".catalog-app").filter({ hasText: "Color Palette Studio" }),
  ).toHaveCount(0);
  await page.screenshot({ path: "docs/phase7-app-center.png" });
  expect(errors).toEqual([]);
});

test("Builder previews and installs the same opaque sandbox; undeclared file reads fail", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Open application launcher" }).click();
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill("App Builder");
  await page.keyboard.press("Enter");
  const builder = page.getByRole("region", { name: "App Builder window" });
  await builder
    .getByRole("button", { name: "Run sandboxed preview", exact: true })
    .click();
  const preview = builder.frameLocator('iframe[title="Hello DeskOS sandbox"]');
  await preview.locator("#hello").click();
  await expect(preview.locator("#status")).toHaveText(
    "Hello from Hello DeskOS",
  );
  const denied = await preview.locator("body").evaluate(async () => {
    const api = (
      window as unknown as {
        deskos: { files: { read: (id: string) => Promise<unknown> } };
      }
    ).deskos;
    try {
      await api.files.read("home");
      return "unexpected";
    } catch (e) {
      return String(e);
    }
  });
  expect(denied).toContain("Capability not declared");
  await builder
    .getByRole("button", { name: "Install app", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill("Hello DeskOS");
  await page.keyboard.press("Enter");
  const installed = page
    .getByRole("region", { name: "Hello DeskOS window" })
    .frameLocator("iframe");
  await installed.locator("#hello").click();
  await expect(installed.locator("#status")).toHaveText(
    "Hello from Hello DeskOS",
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Hello DeskOS window" }),
  ).toBeVisible();
  const reopened = page
    .getByRole("region", { name: "Hello DeskOS window" })
    .frameLocator("iframe");
  await reopened.locator("#hello").click();
  await expect(reopened.locator("#status")).toHaveText(
    "Hello from Hello DeskOS",
  );
  expect(errors).toEqual([]);
});
