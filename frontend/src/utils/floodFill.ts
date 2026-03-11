/**
 * Scanline flood fill — efficient for large areas.
 * Returns true if any pixels were changed.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance = 32
): boolean {
  const canvas = ctx.canvas;
  const W = canvas.width;
  const H = canvas.height;

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) return false;

  // Parse fill color
  const fillRGB = hexToRgb(fillColorHex);
  if (!fillRGB) return false;
  const [fr, fg, fb] = fillRGB;

  // Sample target color at start pixel
  const startIdx = (sy * W + sx) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const ta = data[startIdx + 3];

  // Already that color?
  if (tr === fr && tg === fg && tb === fb && ta === 255) return false;

  function matches(idx: number): boolean {
    return (
      Math.abs(data[idx] - tr) <= tolerance &&
      Math.abs(data[idx + 1] - tg) <= tolerance &&
      Math.abs(data[idx + 2] - tb) <= tolerance &&
      Math.abs(data[idx + 3] - ta) <= tolerance
    );
  }

  function setPixel(idx: number): void {
    data[idx] = fr;
    data[idx + 1] = fg;
    data[idx + 2] = fb;
    data[idx + 3] = 255;
  }

  // Scanline fill
  const stack: [number, number][] = [[sx, sy]];
  const visited = new Uint8Array(W * H);

  while (stack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [x, y] = stack.pop()!;

    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    if (visited[y * W + x]) continue;

    const idx = (y * W + x) * 4;
    if (!matches(idx)) continue;

    // Scan left
    let left = x;
    while (left > 0 && !visited[y * W + (left - 1)] && matches((y * W + (left - 1)) * 4)) {
      left--;
    }

    // Scan right
    let right = x;
    while (right < W - 1 && !visited[y * W + (right + 1)] && matches((y * W + (right + 1)) * 4)) {
      right++;
    }

    // Fill the span and mark visited, check above/below
    for (let i = left; i <= right; i++) {
      const spanIdx = (y * W + i) * 4;
      setPixel(spanIdx);
      visited[y * W + i] = 1;

      if (y > 0 && !visited[(y - 1) * W + i] && matches(((y - 1) * W + i) * 4)) {
        stack.push([i, y - 1]);
      }
      if (y < H - 1 && !visited[(y + 1) * W + i] && matches(((y + 1) * W + i) * 4)) {
        stack.push([i, y + 1]);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return true;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}
