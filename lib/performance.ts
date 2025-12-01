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

      // 개발 환경에서만 로그 출력
      if (process.env.NODE_ENV === "development") {
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

      if (process.env.NODE_ENV === "development") {
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

