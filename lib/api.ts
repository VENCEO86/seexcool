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
 * API 요청 헬퍼
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // 프로덕션에서는 logger 사용, 개발 환경에서는 console.error
    if (process.env.NODE_ENV === "development") {
      console.error(`API request failed (${endpoint}):`, error);
    }
    throw error;
  }
}

/**
 * 문의 API
 */
export const inquiryApi = {
  /**
   * 문의 목록 조회
   */
  async getAll(): Promise<Inquiry[]> {
    const response = await apiRequest<Inquiry[]>("/api/inquiries", {
      method: "GET",
    });
    return response.data || [];
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
   * 문의 상태 업데이트
   */
  async updateStatus(id: string, status: Inquiry["status"]): Promise<Inquiry> {
    const response = await apiRequest<Inquiry>(`/api/inquiries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!response.data) {
      throw new Error(response.error || "문의 상태 업데이트에 실패했습니다.");
    }
    return response.data;
  },
};

/**
 * 설정 API
 */
export const configApi = {
  /**
   * 설정 조회
   */
  async get(): Promise<SectionAdConfig> {
    const response = await apiRequest<SectionAdConfig>("/api/config", {
      method: "GET",
    });
    if (!response.data) {
      throw new Error(response.error || "설정을 불러오는데 실패했습니다.");
    }
    return response.data;
  },

  /**
   * 설정 저장
   */
  async save(config: SectionAdConfig): Promise<SectionAdConfig> {
    const response = await apiRequest<SectionAdConfig>("/api/config", {
      method: "POST",
      body: JSON.stringify({ config }),
    });
    if (!response.data) {
      throw new Error(response.error || "설정 저장에 실패했습니다.");
    }
    return response.data;
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

