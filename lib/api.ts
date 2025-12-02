/**
 * API 클라이언트 유틸리티
 * 프론트엔드에서 백엔드 API와 통신하기 위한 헬퍼 함수
 */

import type { SectionAdConfig } from "@/lib/sectionAdConfig";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * API 응답 타입
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

/**
 * 문의 데이터 타입 (lib/sectionAdConfig에서 import)
 */
import type { Inquiry } from "@/lib/sectionAdConfig";
export type { Inquiry };

/**
 * 설정 데이터 타입 (재export)
 */
export type { SectionAdConfig };

/**
 * API 요청 헬퍼 (개선: 재시도 로직 + 타임아웃 + 에러 핸들링 강화)
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = 3,
  timeout: number = 10000
): Promise<ApiResponse<T>> {
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
  
  // 타임아웃을 포함한 fetch 래퍼
  const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      if (!response.ok) {
        // 4xx 에러는 재시도하지 않음
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        // 5xx 에러는 재시도
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // 지수 백오프
          continue;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 네트워크 에러나 타임아웃은 재시도
      if (attempt < retries - 1 && (
        lastError.message.includes("timeout") ||
        lastError.message.includes("network") ||
        lastError.message.includes("fetch")
      )) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      
      // 마지막 시도 실패 시
      if (attempt === retries - 1) {
        if (process.env.NODE_ENV === "development") {
          console.error(`API request failed (${endpoint}) after ${retries} attempts:`, lastError);
        }
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error("Unknown error");
}

/**
 * 문의 API (개선: 에러 핸들링 강화)
 */
let inquiryCache: { data: Inquiry[]; timestamp: number } | null = null;
const INQUIRY_CACHE_DURATION = 3000; // 3초 캐시

export const inquiryApi = {
  /**
   * 문의 목록 조회 (캐싱 적용)
   */
  async getAll(useCache: boolean = true): Promise<Inquiry[]> {
    // 캐시 확인
    if (useCache && inquiryCache && Date.now() - inquiryCache.timestamp < INQUIRY_CACHE_DURATION) {
      return inquiryCache.data;
    }
    
    try {
      const response = await apiRequest<Inquiry[]>("/api/inquiries", {
        method: "GET",
        cache: "no-store",
      }, 2, 5000);
      
      const data = response.data || [];
      
      // 캐시 업데이트
      inquiryCache = {
        data,
        timestamp: Date.now(),
      };
      
      return data;
    } catch (error) {
      // 캐시가 있으면 캐시 반환
      if (inquiryCache) {
        console.warn("API 실패, 캐시된 데이터 사용:", error);
        return inquiryCache.data;
      }
      return [];
    }
  },

  /**
   * 문의 생성
   */
  async create(inquiry: Omit<Inquiry, "id" | "createdAt" | "updatedAt">): Promise<Inquiry> {
    const response = await apiRequest<Inquiry>("/api/inquiries", {
      method: "POST",
      body: JSON.stringify(inquiry),
    });
    if (!response.data) {
      throw new Error(response.error || "문의 생성에 실패했습니다.");
    }
    return response.data;
  },

  /**
   * 문의 조회
   */
  async getById(id: string): Promise<Inquiry> {
    const response = await apiRequest<Inquiry>(`/api/inquiries/${id}`, {
      method: "GET",
    });
    if (!response.data) {
      throw new Error(response.error || "문의를 찾을 수 없습니다.");
    }
    return response.data;
  },

  /**
   * 문의 상태 업데이트 (캐시 무효화)
   */
  async updateStatus(id: string, status: Inquiry["status"]): Promise<Inquiry> {
    try {
      const response = await apiRequest<Inquiry>(`/api/inquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, 2, 10000);
      
      if (!response.data) {
        throw new Error(response.error || "문의 상태 업데이트에 실패했습니다.");
      }
      
      // 캐시 무효화
      inquiryCache = null;
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * 캐시 무효화
   */
  clearCache(): void {
    inquiryCache = null;
  },
};

/**
 * 설정 API (개선: 캐싱 + 에러 핸들링 강화)
 */
let configCache: { data: SectionAdConfig; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5초 캐시

export const configApi = {
  /**
   * 설정 조회 (캐싱 적용)
   */
  async get(useCache: boolean = true): Promise<SectionAdConfig> {
    // 캐시 확인
    if (useCache && configCache && Date.now() - configCache.timestamp < CACHE_DURATION) {
      return configCache.data;
    }
    
    try {
      const response = await apiRequest<SectionAdConfig>("/api/config", {
        method: "GET",
        cache: "no-store", // 항상 최신 데이터
      }, 2, 5000); // 2회 재시도, 5초 타임아웃
      
      if (!response.data) {
        throw new Error(response.error || "설정을 불러오는데 실패했습니다.");
      }
      
      // 캐시 업데이트
      configCache = {
        data: response.data,
        timestamp: Date.now(),
      };
      
      return response.data;
    } catch (error) {
      // 캐시가 있으면 캐시 반환
      if (configCache) {
        console.warn("API 실패, 캐시된 데이터 사용:", error);
        return configCache.data;
      }
      throw error;
    }
  },

  /**
   * 설정 저장 (캐시 무효화)
   */
  async save(config: SectionAdConfig): Promise<SectionAdConfig> {
    try {
      const response = await apiRequest<SectionAdConfig>("/api/config", {
        method: "POST",
        body: JSON.stringify({ config }),
      }, 2, 10000); // 2회 재시도, 10초 타임아웃
      
      if (!response.data) {
        throw new Error(response.error || "설정 저장에 실패했습니다.");
      }
      
      // 캐시 무효화 및 업데이트
      configCache = {
        data: response.data,
        timestamp: Date.now(),
      };
      
      return response.data;
    } catch (error) {
      // 저장 실패 시에도 캐시는 유지 (이전 상태 보존)
      throw error;
    }
  },
  
  /**
   * 캐시 무효화
   */
  clearCache(): void {
    configCache = null;
  },
};

/**
 * 배경제거 API
 */
export const backgroundRemovalApi = {
  /**
   * AI 모델을 사용한 배경제거 (향후 구현)
   */
  async removeBackground(
    imageBlob: Blob,
    model: "rembg" | "u2net" | "modnet" | "sam2" = "rembg"
  ): Promise<Blob> {
    const formData = new FormData();
    formData.append("image", imageBlob);
    formData.append("model", model);

    try {
      const url = API_BASE_URL ? `${API_BASE_URL}/api/remove-background` : "/api/remove-background";
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      // 프로덕션에서는 logger 사용, 개발 환경에서는 console.error
      if (process.env.NODE_ENV === "development") {
        console.error("Background removal API error:", error);
      }
      throw error;
    }
  },
};

