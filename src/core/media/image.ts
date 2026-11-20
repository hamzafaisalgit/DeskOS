export type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  grayscale: number;
  sepia: number;
  blur: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};
export const originalAdjustments: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  warmth: 0,
  grayscale: 0,
  sepia: 0,
  blur: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};
export function renderPhoto(
  image: CanvasImageSource & { width: number; height: number },
  canvas: HTMLCanvasElement,
  a: Adjustments,
  max = 4096,
) {
  const x = (Math.min(99, Math.max(0, a.x)) / 100) * image.width,
    y = (Math.min(99, Math.max(0, a.y)) / 100) * image.height;
  const w = Math.max(
      1,
      Math.min((a.width / 100) * image.width, image.width - x),
    ),
    h = Math.max(
      1,
      Math.min((a.height / 100) * image.height, image.height - y),
    );
  const rotated = a.rotation % 180 !== 0,
    scale = Math.min(1, max / Math.max(w, h));
  canvas.width = Math.round((rotated ? h : w) * scale);
  canvas.height = Math.round((rotated ? w : h) * scale);
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.translate(canvas.width / 2, canvas.height / 2);
  c.rotate((a.rotation * Math.PI) / 180);
  c.scale(a.flipX ? -1 : 1, a.flipY ? -1 : 1);
  c.filter = `brightness(${a.brightness * Math.pow(2, a.exposure)}%) contrast(${a.contrast}%) saturate(${a.saturation}%) grayscale(${a.grayscale}%) sepia(${a.sepia}%) blur(${a.blur * scale}px)`;
  c.drawImage(
    image,
    x,
    y,
    w,
    h,
    (-w * scale) / 2,
    (-h * scale) / 2,
    w * scale,
    h * scale,
  );
  c.restore();
  if (a.warmth) {
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] += a.warmth * 0.6;
      pixels.data[i + 2] -= a.warmth * 0.6;
    }
    c.putImageData(pixels, 0, 0);
  }
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Image export failed."))),
      type,
      quality,
    ),
  );
}
