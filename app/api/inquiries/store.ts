/**
 * 문의 데이터 임시 저장소
 * 실제 운영 환경에서는 데이터베이스 사용 권장
 * 주의: 서버 재시작 시 데이터가 초기화됩니다
 */

import type { Inquiry } from "@/lib/sectionAdConfig";

let _inquiriesStore: Inquiry[] = [];

export const inquiriesStore = {
  get(): Inquiry[] {
    return _inquiriesStore;
  },
  set(value: Inquiry[]): void {
    _inquiriesStore = value;
  },
  push(item: Inquiry): void {
    _inquiriesStore.push(item);
  },
  find(predicate: (item: Inquiry) => boolean): Inquiry | undefined {
    return _inquiriesStore.find(predicate);
  },
  findIndex(predicate: (item: Inquiry) => boolean): number {
    return _inquiriesStore.findIndex(predicate);
  },
  sort(compareFn?: (a: Inquiry, b: Inquiry) => number): Inquiry[] {
    return [..._inquiriesStore].sort(compareFn);
  },
};

/**
 * 저장소 초기화 (테스트용)
 */
export function resetStore(): void {
  _inquiriesStore = [];
}

