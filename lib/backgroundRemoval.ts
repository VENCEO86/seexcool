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
  threshold: number = 35 // 기본값 상향 조정
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  // 가장자리 픽셀 색상 수집 (개선: 더 넓은 영역 샘플링 + 코너 영역 강조)
  const edgePixels: number[] = [];
  const edgeSize = Math.min(20, Math.floor(Math.min(width, height) * 0.1)); // 샘플링 영역 확대

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

  // 배경색 계산 (개선: 중앙값 사용으로 이상치 제거 + 가중 평균)
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];
  
  for (let i = 0; i < edgePixels.length; i += 3) {
    rValues.push(edgePixels[i]);
    gValues.push(edgePixels[i + 1]);
    bValues.push(edgePixels[i + 2]);
  }
  
  // 중앙값 계산 (이상치 제거)
  const getMedian = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };
  
  const medianR = getMedian(rValues);
  const medianG = getMedian(gValues);
  const medianB = getMedian(bValues);
  
  // 중앙값 기준으로 가중 평균 계산 (중앙값에 가까운 픽셀에 더 높은 가중치)
  let rSum = 0, gSum = 0, bSum = 0;
  let weightSum = 0;
  const pixelCount = edgePixels.length / 3;
  
  for (let i = 0; i < edgePixels.length; i += 3) {
    const r = edgePixels[i];
    const g = edgePixels[i + 1];
    const b = edgePixels[i + 2];
    
    // 중앙값과의 거리 기반 가중치 (가까울수록 높은 가중치)
    const dist = Math.sqrt(
      Math.pow(r - medianR, 2) + Math.pow(g - medianG, 2) + Math.pow(b - medianB, 2)
    );
    const weight = 1 / (1 + dist / 30); // 거리 기반 가중치
    
    rSum += r * weight;
    gSum += g * weight;
    bSum += b * weight;
    weightSum += weight;
  }
  
  const bgR = Math.round(rSum / weightSum);
  const bgG = Math.round(gSum / weightSum);
  const bgB = Math.round(bSum / weightSum);

  // 배경색과 유사한 픽셀을 투명하게 처리 (개선: 그라데이션 처리)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 색상 거리 계산 (개선: Lab 색상 공간 근사 사용)
    // RGB를 Lab로 변환하는 대신, 가중 유클리드 거리 사용 (인간의 색상 인식에 더 가까움)
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    
    // 가중 거리 (녹색에 더 민감하게 반응 - 인간의 시각 특성)
    const distance = Math.sqrt(
      dr * dr * 2 + dg * dg * 4 + db * db * 3
    ) / Math.sqrt(9); // 정규화

    // 그라데이션 처리: 임계값 근처에서 점진적으로 투명도 조절 (개선: 더 부드러운 전환)
    if (distance <= threshold) {
      if (distance <= threshold * 0.6) {
        // 확실히 배경인 경우 완전 투명
        data[i + 3] = 0;
      } else {
        // 경계 영역: 점진적 투명 처리 (더 부드러운 곡선)
        const normalizedDist = (distance - threshold * 0.6) / (threshold * 0.4);
        // 부드러운 전환을 위한 ease-out 곡선
        const fadeFactor = 1 - Math.pow(1 - normalizedDist, 2);
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

  // 엣지가 없는 영역을 배경으로 간주하여 투명 처리 (개선: 객체 중심 영역 보존)
  // Flood Fill 기반 객체 영역 탐지
  const visited = new Uint8Array(width * height);
  const objectRegions: Set<number> = new Set();
  
  // 엣지가 많은 영역을 객체로 간주
  for (let y = 3; y < height - 3; y++) {
    for (let x = 3; x < width - 3; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      
      let edgeCount = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nIdx = (y + dy) * width + (x + dx);
          if (nIdx >= 0 && nIdx < edges.length && edges[nIdx] > 0) {
            edgeCount++;
          }
        }
      }
      
      // 엣지가 많은 영역은 객체로 간주 (Flood Fill로 확장)
      if (edgeCount >= 5) {
        const queue: number[] = [idx];
        visited[idx] = 1;
        objectRegions.add(idx);
        
        // Flood Fill로 객체 영역 확장
        while (queue.length > 0) {
          const currentIdx = queue.shift()!;
          const cx = currentIdx % width;
          const cy = Math.floor(currentIdx / width);
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              
              const nIdx = ny * width + nx;
              if (visited[nIdx]) continue;
              
              // 주변에 엣지가 있으면 객체 영역으로 간주
              let localEdgeCount = 0;
              for (let ddy = -2; ddy <= 2; ddy++) {
                for (let ddx = -2; ddx <= 2; ddx++) {
                  const nnIdx = (ny + ddy) * width + (nx + ddx);
                  if (nnIdx >= 0 && nnIdx < edges.length && edges[nnIdx] > 0) {
                    localEdgeCount++;
                  }
                }
              }
              
              if (localEdgeCount >= 3) {
                visited[nIdx] = 1;
                objectRegions.add(nIdx);
                queue.push(nIdx);
              }
            }
          }
        }
      }
    }
  }
  
  // 객체 영역이 아닌 곳을 배경으로 처리
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const x = idx % width;
    const y = Math.floor(idx / width);
    
    // 가장자리 영역은 보존
    if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) {
      continue;
    }
    
    // 객체 영역이 아니면 배경으로 간주
    if (!objectRegions.has(idx)) {
      // 점진적 투명 처리 (거리에 따라)
      const centerX = width / 2;
      const centerY = height / 2;
      const distFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
      const centerWeight = 1 - (distFromCenter / maxDist) * 0.5; // 중심에 가까울수록 보존
      
      data[i + 3] = Math.max(0, Math.round(data[i + 3] * 0.2 * centerWeight));
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
      // 자동: 다단계 처리 (거친 처리 → 정밀 처리)
      // 1단계: 가장자리 색상 기반 배경 제거
      result = removeBackgroundByEdgeColor(imageData, threshold);
      
      // 2단계: 엣지 감지로 객체 영역 보존 강화
      const edgeResult = removeBackgroundByEdgeDetection(result, threshold * 1.5);
      
      // 3단계: 두 결과를 블렌딩 (더 정확한 결과)
      const blended = new Uint8ClampedArray(edgeResult.data);
      const colorData = result.data;
      for (let i = 0; i < blended.length; i += 4) {
        const edgeAlpha = edgeResult.data[i + 3];
        const colorAlpha = colorData[i + 3];
        
        // 더 보수적인 접근: 둘 다 투명해야만 완전 투명
        if (edgeAlpha === 0 && colorAlpha === 0) {
          blended[i + 3] = 0;
        } else if (edgeAlpha < 50 && colorAlpha < 50) {
          // 둘 다 거의 투명하면 투명 처리
          blended[i + 3] = Math.min(edgeAlpha, colorAlpha);
        } else {
          // 하나라도 불투명하면 평균값 사용 (객체 보존)
          blended[i + 3] = Math.max(edgeAlpha, colorAlpha * 0.7);
        }
      }
      
      result = new ImageData(blended, imageData.width, imageData.height);
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

