import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
async function launch(page: Page, name: string) {
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Search applications and commands" })
    .fill(name);
  await page.keyboard.press("Enter");
  return page.getByRole("region", { name: name + " window" }).last();
}
function pdfFixture() {
  const content = "BT /F1 24 Tf 60 700 Td (DeskOS creative suite) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>
stream
${content}
endstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(source.length);
    source += `${i + 1} 0 obj
${o}
endobj
`;
  });
  const xref = source.length;
  source += `xref
0 6
0000000000 65535 f 
${offsets
  .slice(1)
  .map((n) => String(n).padStart(10, "0") + " 00000 n ")
  .join("\n")}
trailer << /Size 6 /Root 1 0 R >>
startxref
${xref}
%%EOF`;
  return Buffer.from(source);
}
function audioFixture() {
  const rate = 8000,
    seconds = 20,
    b = Buffer.alloc(44 + rate * seconds * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i / rate) * 440 * Math.PI * 2) * 3000),
      44 + i * 2,
    );
  return b;
}
test("Photos changes exported pixels and Canvas reopens editable projects", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 100;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#cc5533";
    ctx.fillRect(0, 0, 200, 100);
    return c.toDataURL().split(",")[1];
  });
  const photos = await launch(page, "Photos");
  await photos
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Original.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await photos
    .getByRole("button", { name: /Original.png/ })
    .filter({ has: page.locator("strong") })
    .click();
  await photos.getByRole("button", { name: "Edit photo", exact: true }).click();
  await photos
    .getByRole("slider", { name: "brightness", exact: true })
    .fill("50");
  await photos.getByRole("combobox", { name: "Crop preset" }).selectOption("1");
  const result = await photos
    .locator('canvas[aria-label="Photo preview"]')
    .evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height,
        pixel: [...canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data],
      };
    });
  expect(result.width).toBe(result.height);
  expect(result.pixel[0]).toBeLessThan(150);
  await photos.getByRole("button", { name: "Save Copy", exact: true }).click();
  await expect(
    page.getByText("Edited copy saved to Pictures", { exact: true }).first(),
  ).toBeVisible();
  await photos.getByRole("button", { name: "Canvas", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Canvas window" }).last();
  await expect(canvas.locator(".layer-row")).toHaveCount(1);
  await canvas.getByRole("button", { name: "New layer", exact: true }).click();
  await expect(canvas.locator(".layer-row")).toHaveCount(2);
  await canvas.getByRole("textbox", { name: "Project name" }).fill("Artwork");
  await canvas.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Canvas project saved to Pictures", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Canvas", exact: true }).click();
  const files = await launch(page, "Files");
  await files.getByRole("button", { name: "Pictures", exact: true }).click();
  await files
    .locator(".file-item")
    .filter({ hasText: "Artwork.deskcanvas" })
    .dblclick();
  await expect(
    page
      .getByRole("region", { name: "Canvas window" })
      .last()
      .locator(".layer-row"),
  ).toHaveCount(2);
  await page.screenshot({ path: "docs/phase4-canvas.png" });
  expect(errors).toEqual([]);
});
test("Music plays real audio through minimization and PDF search/bookmarks persist", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const music = await launch(page, "Music");
  await music
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Tone.wav",
      mimeType: "audio/wav",
      buffer: audioFixture(),
    });
  await music.locator(".media-open").filter({ hasText: "Tone.wav" }).click();
  await expect
    .poll(() =>
      music
        .locator("audio")
        .evaluate((a) => (a as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await music.getByRole("button", { name: "Create collection" }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Listening");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await music.getByRole("button", { name: "Library", exact: true }).click();
  await music.getByRole("checkbox", { name: "Select Tone.wav" }).check();
  await music
    .getByRole("combobox", { name: "Add selected to collection" })
    .selectOption({ label: "Listening" });
  await page
    .getByRole("button", { name: "Minimize Music", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a) => (a as HTMLAudioElement).paused),
    )
    .toBe(false);
  const reader = await launch(page, "PDF Studio");
  await reader
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Read.pdf",
      mimeType: "application/pdf",
      buffer: pdfFixture(),
    });
  await reader.locator(".media-open").filter({ hasText: "Read.pdf" }).click();
  await expect(reader.locator(".pdf-pages .textLayer")).toContainText(
    "DeskOS creative suite",
    { timeout: 30000 },
  );
  await reader.getByRole("textbox", { name: "Search PDF" }).fill("creative");
  await expect(
    reader.getByText("1 matching pages", { exact: true }),
  ).toBeVisible();
  await reader.getByRole("button", { name: "Bookmark page" }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Opening");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("button", { name: "Close PDF Studio", exact: true })
    .click();
  const second = await launch(page, "PDF Studio");
  await second.locator(".media-open").filter({ hasText: "Read.pdf" }).click();
  await second
    .getByRole("combobox", { name: "PDF navigation" })
    .selectOption("bookmarks");
  await expect(second.getByRole("button", { name: /Opening/ })).toBeVisible();
  await page.screenshot({ path: "docs/phase4-pdf.png" });
  expect(errors).toEqual([]);
});

test("Cinema plays video, loads WebVTT and offers saved resume", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const data = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const result = new Promise<string>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
      };
    });
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = frame++ % 2 ? "#795da8" : "#36a096";
      ctx.fillRect(0, 0, 160, 90);
    }, 100);
    await new Promise((r) => setTimeout(r, 18000));
    clearInterval(timer);
    recorder.stop();
    return result;
  });
  const cinema = await launch(page, "Cinema");
  await cinema
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Clip.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(data, "base64"),
    });
  await cinema.locator(".media-open").filter({ hasText: "Clip.webm" }).click();
  await cinema.getByRole("button", { name: "Play video", exact: true }).click();
  await expect
    .poll(() =>
      cinema
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await cinema
    .locator('input[type="file"]')
    .setInputFiles({
      name: "captions.vtt",
      mimeType: "text/vtt",
      buffer: Buffer.from(
        "WEBVTT\n\n00:00.000 --> 00:10.000\nA real subtitle\n",
      ),
    });
  await expect
    .poll(() =>
      cinema
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).textTracks[0]?.cues?.length),
    )
    .toBe(1);
  await cinema.locator("video").evaluate((v) => {
    (v as HTMLVideoElement).currentTime = 6;
  });
  await expect
    .poll(() =>
      cinema
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(5);
  await page.getByRole("button", { name: "Close Cinema", exact: true }).click();
  const second = await launch(page, "Cinema");
  await second.locator(".media-open").filter({ hasText: "Clip.webm" }).click();
  await expect(
    second.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(() =>
      second
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(5);
  await page.screenshot({ path: "docs/phase4-cinema.png" });
  expect(errors).toEqual([]);
});
