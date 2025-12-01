/**
 * 고급 이미지 화질 개선 유틸리티
 * Lanczos 보간, Unsharp Masking, 샤프닝 등을 활용한 화질 개선
 */

/**
 * Lanczos 보간 함수
 */
function lanczos(x: number, a: number = 3): number {
  if (x === 0) return 1;
  if (Math.abs(x) >= a) return 0;
  return (a * Math.sin(Math.PI * x) * Math.sin(Math.PI * x / a)) / (Math.PI * Math.PI * x * x);
}

/**
 * Lanczos 보간을 사용한 고품질 업스케일링 (최적화 버전)
 * 큰 이미지의 경우 성능을 위해 간소화된 버전 사용
 */
export function lanczosUpscale(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  
  // 큰 이미지의 경우 고품질 Canvas API 사용 (성능 최적화)
  if (sourceWidth * sourceHeight > 500000) {
    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: false });
    if (!targetCtx) throw new Error("Cannot get target context");
    
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = "high";
    targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return targetCanvas;
  }

  // 작은 이미지의 경우 Lanczos 보간 적용
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Cannot get source context");

  const sourceImageData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const sourceData = sourceImageData.data;

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!targetCtx) throw new Error("Cannot get target context");

  const targetImageData = targetCtx.createImageData(targetWidth, targetHeight);
  const targetData = targetImageData.data;

  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;
  const a = 3; // Lanczos 파라미터

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = x * scaleX;
      const srcY = y * scaleY;

      const x1 = Math.floor(srcX);
      const y1 = Math.floor(srcY);

      let r = 0, g = 0, b = 0, alpha = 0;
      let weightSum = 0;

      // Lanczos 커널 적용 (최적화: 필요한 영역만)
      for (let j = -a + 1; j <= a; j++) {
        for (let i = -a + 1; i <= a; i++) {
          const px = x1 + i;
          const py = y1 + j;

          if (px >= 0 && px < sourceWidth && py >= 0 && py < sourceHeight) {
            const dx = srcX - px;
            const dy = srcY - py;
            const weight = lanczos(dx, a) * lanczos(dy, a);

            const idx = (py * sourceWidth + px) * 4;
            r += sourceData[idx] * weight;
            g += sourceData[idx + 1] * weight;
            b += sourceData[idx + 2] * weight;
            alpha += sourceData[idx + 3] * weight;
            weightSum += weight;
          }
        }
      }

      if (weightSum > 0) {
        const idx = (y * targetWidth + x) * 4;
        targetData[idx] = Math.round(r / weightSum);
        targetData[idx + 1] = Math.round(g / weightSum);
        targetData[idx + 2] = Math.round(b / weightSum);
        targetData[idx + 3] = Math.round(alpha / weightSum);
      }
    }
  }

  targetCtx.putImageData(targetImageData, 0, 0);
  return targetCanvas;
}

/**
 * Unsharp Masking (샤프닝 필터)
 */
export function applyUnsharpMask(
  canvas: HTMLCanvasElement,
  amount: number = 1.5,
  radius: number = 1,
  threshold: number = 0
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Cannot get context");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // 가우시안 블러 적용 (원본 복사)
  const blurred = new Uint8ClampedArray(data);
  const kernel = createGaussianKernel(radius);
  applyGaussianBlur(data, blurred, width, height, kernel);

  // Unsharp masking 적용
  for (let i = 0; i < data.length; i += 4) {
    const diffR = data[i] - blurred[i];
    const diffG = data[i + 1] - blurred[i + 1];
    const diffB = data[i + 2] - blurred[i + 2];

    if (Math.abs(diffR) > threshold || Math.abs(diffG) > threshold || Math.abs(diffB) > threshold) {
      data[i] = Math.min(255, Math.max(0, data[i] + diffR * amount));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + diffG * amount));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + diffB * amount));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * 가우시안 커널 생성
 */
function createGaussianKernel(radius: number): number[] {
  const size = Math.ceil(radius * 2) + 1;
  const kernel: number[] = [];
  const sigma = radius / 3;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - Math.floor(size / 2);
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  return kernel.map(v => v / sum);
}

/**
 * 가우시안 블러 적용
 */
function applyGaussianBlur(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[]
): void {
  const temp = new Uint8ClampedArray(source.length);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);

  // 수평 블러
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let weightSum = 0;

      for (let k = 0; k < kernelSize; k++) {
        const px = x + k - halfKernel;
        if (px >= 0 && px < width) {
          const idx = (y * width + px) * 4;
          const weight = kernel[k];
          r += source[idx] * weight;
          g += source[idx + 1] * weight;
          b += source[idx + 2] * weight;
          a += source[idx + 3] * weight;
          weightSum += weight;
        }
      }

      const idx = (y * width + x) * 4;
      temp[idx] = r / weightSum;
      temp[idx + 1] = g / weightSum;
      temp[idx + 2] = b / weightSum;
      temp[idx + 3] = a / weightSum;
    }
  }

  // 수직 블러
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let weightSum = 0;

      for (let k = 0; k < kernelSize; k++) {
        const py = y + k - halfKernel;
        if (py >= 0 && py < height) {
          const idx = (py * width + x) * 4;
          const weight = kernel[k];
          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
          weightSum += weight;
        }
      }

      const idx = (y * width + x) * 4;
      target[idx] = r / weightSum;
      target[idx + 1] = g / weightSum;
      target[idx + 2] = b / weightSum;
      target[idx + 3] = a / weightSum;
    }
  }
}

/**
 * 고품질 화질 개선 (Lanczos + 샤프닝)
 */
export function enhanceImageQuality(
  sourceCanvas: HTMLCanvasElement,
  scale: number
): HTMLCanvasElement {
  if (scale <= 1.0) {
    return sourceCanvas;
  }

  const targetWidth = Math.round(sourceCanvas.width * scale);
  const targetHeight = Math.round(sourceCanvas.height * scale);

  // 단계별 업스케일링 (2배씩)
  let currentCanvas = sourceCanvas;
  let currentScale = 1.0;

  while (currentScale * 2 <= scale) {
    const nextWidth = Math.min(
      Math.round(sourceCanvas.width * currentScale * 2),
      targetWidth
    );
    const nextHeight = Math.min(
      Math.round(sourceCanvas.height * currentScale * 2),
      targetHeight
    );

    currentCanvas = lanczosUpscale(currentCanvas, nextWidth, nextHeight);
    currentScale *= 2;
  }

  // 최종 크기 조정
  if (currentCanvas.width !== targetWidth || currentCanvas.height !== targetHeight) {
    currentCanvas = lanczosUpscale(currentCanvas, targetWidth, targetHeight);
  }

  // 샤프닝 적용 (선명도 향상)
  applyUnsharpMask(currentCanvas, 1.2, 0.8, 5);

  return currentCanvas;
}

