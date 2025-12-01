/**
 * Edge Detection (엣지 감지) 기능
 * Canny Edge Detection 기반
 */

export interface EdgeDetectionResult {
  edges: ImageData;
  contours: Array<Array<{ x: number; y: number }>>;
}

/**
 * Canny Edge Detection 적용
 */
export function detectEdges(
  imageData: ImageData,
  lowThreshold: number = 50,
  highThreshold: number = 150
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  
  // 그레이스케일 변환
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    grayscale[i / 4] = gray;
  }

  // 가우시안 블러 적용 (노이즈 제거)
  const blurred = applyGaussianBlur(grayscale, width, height, 1.4);

  // Sobel 필터로 그래디언트 계산
  const { magnitude, direction } = sobelOperator(blurred, width, height);

  // Non-maximum suppression
  const suppressed = nonMaximumSuppression(magnitude, direction, width, height);

  // Double threshold 및 Hysteresis
  const edges = doubleThreshold(suppressed, width, height, lowThreshold, highThreshold);

  // 결과를 RGBA로 변환
  const result = new ImageData(width, height);
  for (let i = 0; i < edges.length; i++) {
    const value = edges[i];
    result.data[i * 4] = value;
    result.data[i * 4 + 1] = value;
    result.data[i * 4 + 2] = value;
    result.data[i * 4 + 3] = 255;
  }

  return result;
}

/**
 * 가우시안 블러 적용
 */
function applyGaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number
): Uint8ClampedArray {
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[] = [];
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - Math.floor(kernelSize / 2);
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  const normalizedKernel = kernel.map(v => v / sum);
  const result = new Uint8ClampedArray(data.length);

  // 수평 블러
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const px = x + k - Math.floor(kernelSize / 2);
        if (px >= 0 && px < width) {
          value += data[y * width + px] * normalizedKernel[k];
        }
      }
      result[y * width + x] = value;
    }
  }

  // 수직 블러
  const final = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const py = y + k - Math.floor(kernelSize / 2);
        if (py >= 0 && py < height) {
          value += result[py * width + x] * normalizedKernel[k];
        }
      }
      final[y * width + x] = value;
    }
  }

  return final;
}

/**
 * Sobel Operator
 */
function sobelOperator(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { magnitude: Float32Array; direction: Float32Array } {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += data[idx] * sobelX[kernelIdx];
          gy += data[idx] * sobelY[kernelIdx];
        }
      }

      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  return { magnitude, direction };
}

/**
 * Non-maximum suppression
 */
function nonMaximumSuppression(
  magnitude: Float32Array,
  direction: Float32Array,
  width: number,
  height: number
): Float32Array {
  const result = new Float32Array(magnitude.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx];
      const mag = magnitude[idx];

      let neighbor1 = 0, neighbor2 = 0;

      // 각도에 따라 이웃 픽셀 선택
      if ((angle >= -Math.PI / 8 && angle < Math.PI / 8) || 
          (angle >= 7 * Math.PI / 8 || angle < -7 * Math.PI / 8)) {
        neighbor1 = magnitude[idx - 1];
        neighbor2 = magnitude[idx + 1];
      } else if ((angle >= Math.PI / 8 && angle < 3 * Math.PI / 8) ||
                 (angle >= -7 * Math.PI / 8 && angle < -5 * Math.PI / 8)) {
        neighbor1 = magnitude[(y - 1) * width + (x + 1)];
        neighbor2 = magnitude[(y + 1) * width + (x - 1)];
      } else if ((angle >= 3 * Math.PI / 8 && angle < 5 * Math.PI / 8) ||
                 (angle >= -5 * Math.PI / 8 && angle < -3 * Math.PI / 8)) {
        neighbor1 = magnitude[(y - 1) * width + x];
        neighbor2 = magnitude[(y + 1) * width + x];
      } else {
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }

      result[idx] = (mag >= neighbor1 && mag >= neighbor2) ? mag : 0;
    }
  }

  return result;
}

/**
 * Double threshold 및 Hysteresis
 */
function doubleThreshold(
  data: Float32Array,
  width: number,
  height: number,
  lowThreshold: number,
  highThreshold: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height);

  // Double threshold
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= highThreshold) {
      result[i] = 255; // Strong edge
    } else if (data[i] >= lowThreshold) {
      result[i] = 128; // Weak edge
    } else {
      result[i] = 0; // No edge
    }
  }

  // Hysteresis: Weak edge를 Strong edge와 연결
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (result[idx] === 128) {
        let connected = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (result[(y + dy) * width + (x + dx)] === 255) {
              connected = true;
              break;
            }
          }
          if (connected) break;
        }
        result[idx] = connected ? 255 : 0;
      }
    }
  }

  return result;
}

/**
 * Contour 찾기 (간단한 버전)
 */
export function findContours(edges: ImageData): Array<Array<{ x: number; y: number }>> {
  const width = edges.width;
  const height = edges.height;
  const data = edges.data;
  const visited = new Set<string>();
  const contours: Array<Array<{ x: number; y: number }>> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const key = `${x},${y}`;

      if (data[idx] > 128 && !visited.has(key)) {
        const contour: Array<{ x: number; y: number }> = [];
        const stack: Array<{ x: number; y: number }> = [{ x, y }];

        while (stack.length > 0) {
          const point = stack.pop()!;
          const pointKey = `${point.x},${point.y}`;

          if (visited.has(pointKey)) continue;
          visited.add(pointKey);

          const pointIdx = (point.y * width + point.x) * 4;
          if (data[pointIdx] > 128) {
            contour.push(point);

            // 8-connectivity
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = point.x + dx;
                const ny = point.y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const neighborKey = `${nx},${ny}`;
                  if (!visited.has(neighborKey)) {
                    stack.push({ x: nx, y: ny });
                  }
                }
              }
            }
          }
        }

        if (contour.length > 10) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

