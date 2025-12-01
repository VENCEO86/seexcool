/**
 * 설정 데이터 임시 저장소
 * 실제 운영 환경에서는 데이터베이스 사용 권장
 * 주의: 서버 재시작 시 데이터가 초기화됩니다
 */

import type { SectionAdConfig } from "@/lib/sectionAdConfig";

let _configStore: SectionAdConfig | null = null;

export const configStore = {
  get(): SectionAdConfig | null {
    return _configStore;
  },
  set(value: SectionAdConfig | null): void {
    _configStore = value;
  },
};

/**
 * 저장소 초기화 (테스트용)
 */
export function resetStore(): void {
  _configStore = null;
}

