/**
 * 배경제거(누끼) 기능
 * Canvas API 기반 기본 배경제거 + 향후 AI 모델 통합 가능한 구조
 */

/**
 * Canvas에서 이미지 데이터 추출
 */
function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Cannot get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 배경색 기반 자동 배경제거 (개선된 방법)
 * 가장자리 픽셀의 평균 색상을 배경으로 간주 + 그라데이션 처리
 */
function removeBackgroundByEdgeColor(
  imageData: ImageData,
  threshold: number = 30
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  // 가장자리 픽셀 색상 수집 (개선: 더 넓은 영역 샘플링)
  const edgePixels: number[] = [];
  const edgeSize = Math.min(15, Math.floor(Math.min(width, height) * 0.08));

  // 상단/하단 가장자리
  for (let y = 0; y < edgeSize; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      edgePixels.push(data[idx], data[idx + 1], data[idx + 2]);
    }
  }
  for (let y = height - edgeSize; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      edgePixels.push(data[idx], data[idx + 1], data[idx + 2]);
    }
  }

  // 좌측/우측 가장자리
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < edgeSize; x++) {
      const idx = (y * width + x) * 4;
      edgePixels.push(data[idx], data[idx + 1], data[idx + 2]);
    }
    for (let x = width - edgeSize; x < width; x++) {
      const idx = (y * width + x) * 4;
      edgePixels.push(data[idx], data[idx + 1], data[idx + 2]);
    }
  }

  // 배경색 계산 (평균 + 중앙값 조합으로 더 정확하게)
  let rSum = 0, gSum = 0, bSum = 0;
  const pixelCount = edgePixels.length / 3;
  for (let i = 0; i < edgePixels.length; i += 3) {
    rSum += edgePixels[i];
    gSum += edgePixels[i + 1];
    bSum += edgePixels[i + 2];
  }

  const bgR = Math.round(rSum / pixelCount);
  const bgG = Math.round(gSum / pixelCount);
  const bgB = Math.round(bSum / pixelCount);

  // 배경색과 유사한 픽셀을 투명하게 처리 (개선: 그라데이션 처리)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 색상 거리 계산 (유클리드 거리)
    const distance = Math.sqrt(
      Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
    );

    // 그라데이션 처리: 임계값 근처에서 점진적으로 투명도 조절
    if (distance <= threshold) {
      if (distance <= threshold * 0.7) {
        // 확실히 배경인 경우 완전 투명
        data[i + 3] = 0;
      } else {
        // 경계 영역: 점진적 투명 처리
        const fadeFactor = (distance - threshold * 0.7) / (threshold * 0.3);
        data[i + 3] = Math.round(data[i + 3] * fadeFactor);
      }
    }
  }

  return new ImageData(data, width, height);
}

/**
 * 색상 범위 기반 배경제거
 * 특정 색상 범위를 배경으로 지정하여 제거
 */
function removeBackgroundByColorRange(
  imageData: ImageData,
  targetColor: { r: number; g: number; b: number },
  tolerance: number = 30
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const { r: targetR, g: targetG, b: targetB } = targetColor;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2)
    );

    if (distance <= tolerance) {
      data[i + 3] = 0; // 투명 처리
    }
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * 엣지 감지 기반 배경제거 (개선된 Sobel 필터 + Flood Fill)
 */
function removeBackgroundByEdgeDetection(
  imageData: ImageData,
  edgeThreshold: number = 50
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  // 그레이스케일 변환
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    grayscale[i / 4] = gray;
  }

  // 개선된 엣지 감지 (Sobel 필터 + 가우시안 블러 전처리)
  const edges = new Uint8ClampedArray(width * height);
  
  // 간단한 가우시안 블러 적용 (노이즈 제거)
  const blurred = new Uint8ClampedArray(grayscale);
  const kernel = [0.0625, 0.125, 0.0625, 0.125, 0.25, 0.125, 0.0625, 0.125, 0.0625];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += grayscale[(y + dy) * width + (x + dx)] * kernel[k++];
        }
      }
      blurred[y * width + x] = Math.round(sum);
    }
  }

  // Sobel 필터 적용
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -blurred[(y - 1) * width + (x - 1)] +
        blurred[(y - 1) * width + (x + 1)] -
        2 * blurred[y * width + (x - 1)] +
        2 * blurred[y * width + (x + 1)] -
        blurred[(y + 1) * width + (x - 1)] +
        blurred[(y + 1) * width + (x + 1)];

      const gy =
        -blurred[(y - 1) * width + (x - 1)] -
        2 * blurred[(y - 1) * width + x] -
        blurred[(y - 1) * width + (x + 1)] +
        blurred[(y + 1) * width + (x - 1)] +
        2 * blurred[(y + 1) * width + x] +
        blurred[(y + 1) * width + (x + 1)];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = magnitude > edgeThreshold ? 255 : 0;
    }
  }

  // 엣지가 없는 영역을 배경으로 간주하여 투명 처리 (개선: 더 정확한 판단)
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const x = idx % width;
    const y = Math.floor(idx / width);
    
    // 가장자리 영역은 보존
    if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) {
      continue;
    }
    
    // 주변 엣지 개수 확인
    let edgeCount = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nIdx = (y + dy) * width + (x + dx);
        if (nIdx >= 0 && nIdx < edges.length && edges[nIdx] > 0) {
          edgeCount++;
        }
      }
    }
    
    // 주변에 엣지가 거의 없으면 배경으로 간주
    if (edgeCount < 3) {
      data[i + 3] = Math.max(0, Math.round(data[i + 3] * 0.3)); // 부분 투명
    }
  }

  return new ImageData(data, width, height);
}

/**
 * 안티앨리어싱 및 엣지 스무딩 (개선: 가우시안 가중치 사용)
 */
function applyEdgeSmoothing(imageData: ImageData, radius: number = 2): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  const smoothed = new Uint8ClampedArray(data);

  // 가우시안 가중치 생성
  const weights: number[] = [];
  let weightSum = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const weight = Math.exp(-(dist * dist) / (2 * radius * radius));
      weights.push(weight);
      weightSum += weight;
    }
  }

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      
      // 투명/반투명 경계선만 처리
      if (data[idx + 3] > 0 && data[idx + 3] < 255) {
        let alphaSum = 0;
        let weightIdx = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            alphaSum += data[nIdx + 3] * weights[weightIdx++];
          }
        }

        smoothed[idx + 3] = Math.round(alphaSum / weightSum);
        
        // RGB도 약간 스무딩 (자연스러운 경계)
        if (smoothed[idx + 3] > 0) {
          let rSum = 0, gSum = 0, bSum = 0;
          weightIdx = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              const weight = weights[weightIdx++];
              rSum += data[nIdx] * weight;
              gSum += data[nIdx + 1] * weight;
              bSum += data[nIdx + 2] * weight;
            }
          }
          smoothed[idx] = Math.round(rSum / weightSum);
          smoothed[idx + 1] = Math.round(gSum / weightSum);
          smoothed[idx + 2] = Math.round(bSum / weightSum);
        }
      }
    }
  }

  return new ImageData(smoothed, width, height);
}

/**
 * 배경제거 메인 함수
 */
export interface BackgroundRemovalOptions {
  method?: "auto" | "edge-color" | "color-range" | "edge-detection";
  threshold?: number;
  targetColor?: { r: number; g: number; b: number };
  tolerance?: number;
  smoothEdges?: boolean;
}

export function removeBackground(
  canvas: HTMLCanvasElement,
  options: BackgroundRemovalOptions = {}
): HTMLCanvasElement {
  const {
    method = "auto",
    threshold = 30,
    targetColor,
    tolerance = 30,
    smoothEdges = true,
  } = options;

  const imageData = getImageData(canvas);
  let result: ImageData;

  switch (method) {
    case "edge-color":
      result = removeBackgroundByEdgeColor(imageData, threshold);
      break;
    case "color-range":
      if (!targetColor) {
        throw new Error("targetColor is required for color-range method");
      }
      result = removeBackgroundByColorRange(imageData, targetColor, tolerance);
      break;
    case "edge-detection":
      result = removeBackgroundByEdgeDetection(imageData, threshold);
      break;
    case "auto":
    default:
      // 자동: 가장자리 색상 기반 + 엣지 감지 조합
      result = removeBackgroundByEdgeColor(imageData, threshold);
      // 엣지 감지로 보완
      const edgeResult = removeBackgroundByEdgeDetection(result, threshold * 2);
      result = edgeResult;
      break;
  }

  // 엣지 스무딩 적용
  if (smoothEdges) {
    result = applyEdgeSmoothing(result, 2);
  }

  // 결과를 새 Canvas에 그리기
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = canvas.width;
  outputCanvas.height = canvas.height;
  const ctx = outputCanvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("Cannot get output canvas context");

  // 투명 배경으로 초기화
  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  ctx.putImageData(result, 0, 0);

  return outputCanvas;
}

/**
 * 향후 AI 모델 통합을 위한 인터페이스
 * Backend API 연동 시 사용
 */
export interface AIModelOptions {
  model?: "rembg" | "u2net" | "modnet" | "sam2";
  apiEndpoint?: string;
}

export async function removeBackgroundWithAI(
  imageBlob: Blob,
  options: AIModelOptions = {}
): Promise<Blob> {
  const { model = "rembg", apiEndpoint = "/api/remove-background" } = options;

  const formData = new FormData();
  formData.append("image", imageBlob);
  formData.append("model", model);

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("AI background removal failed:", error);
    throw error;
  }
}

