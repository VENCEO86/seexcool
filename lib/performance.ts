/**
 * 성능 모니터링 및 최적화 유틸리티
 */

/**
 * 성능 측정을 위한 유틸리티
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  /**
   * 함수 실행 시간 측정
   */
  static measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const end = performance.now();
      const duration = end - start;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);

      // 개발 환경에서만 로그 출력 (브라우저 환경 체크)
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * 비동기 함수 실행 시간 측정
   */
  static async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);

      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * 평균 실행 시간 가져오기
   */
  static getAverage(name: string): number {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) return 0;
    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  }

  /**
   * 모든 측정값 초기화
   */
  static clear(): void {
    this.measurements.clear();
  }
}

/**
 * 이미지 크기 최적화
 */
export function optimizeImageSize(
  width: number,
  height: number,
  maxDimension: number = 8192
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * 메모리 사용량 추정 (대략적)
 */
export function estimateMemoryUsage(
  width: number,
  height: number,
  channels: number = 4
): number {
  // RGBA = 4 bytes per pixel
  // Canvas ImageData = width * height * 4 bytes
  // Additional overhead for processing = ~20%
  const baseMemory = width * height * channels;
  const overhead = baseMemory * 0.2;
  return (baseMemory + overhead) / (1024 * 1024); // MB
}

/**
 * 안전한 이미지 크기인지 확인
 */
export function isSafeImageSize(
  width: number,
  height: number,
  maxMemoryMB: number = 500
): boolean {
  const estimatedMemory = estimateMemoryUsage(width, height);
  return estimatedMemory <= maxMemoryMB;
}

/**
 * 모바일 디바이스 감지
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * 모바일 이미지 최적화 (리사이즈 및 압축)
 * 모바일에서 업로드 전 이미지 크기 및 품질 조정
 */
export async function optimizeImageForMobile(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // 비율 유지하며 리사이즈
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // JPEG로 압축 (품질 조정)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * 이미지 해시 생성 (캐싱용)
 */
export async function generateImageHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

