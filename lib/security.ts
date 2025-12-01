/**
 * 보안 유틸리티 함수
 */

/**
 * 입력값 sanitization (XSS 방지)
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // 기본적인 HTML 태그 제거
    .replace(/javascript:/gi, "") // javascript: 프로토콜 제거
    .replace(/on\w+=/gi, ""); // 이벤트 핸들러 제거
}

/**
 * 이메일 형식 검증
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 입력값 길이 검증
 */
export function validateLength(
  value: string,
  min: number = 0,
  max: number = Infinity
): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Rate limiting을 위한 간단한 체크 (실제로는 Redis 등 사용 권장)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1분
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * 정기적으로 오래된 rate limit 레코드 정리
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // 1분마다 정리
}

