// Design Ref: §7.3 남용 방지 — 같은 접속자가 AI 사유 API를 너무 자주 부르지 못하게 막는다. (분당 10회)
// 샘플 규모의 간단한 메모리 방식이다. 서버가 여러 대로 나뉘거나 다시 시작되면 횟수가 초기화되므로
// 배포 환경에서 더 엄격한 제한이 필요하면 Vercel의 방화벽/호출 제한 기능을 함께 쓴다.
import "server-only";

interface Bucket {
  windowStart: number;
  count: number;
}

export interface RateLimiter {
  /** 허용되면 true. 한도를 넘으면 false */
  allow(key: string, now?: number): boolean;
}

/** 한 제한기가 기억하는 접속자 수의 상한 — 가짜 접속자 키를 대량으로 보내도 메모리가 무한히 늘지 않게 한다 */
const MAX_BUCKETS = 5000;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    allow(key, now = Date.now()) {
      // 오래된 항목 정리 (메모리가 계속 늘지 않게)
      if (buckets.size > 1000) {
        for (const [k, b] of buckets) if (now - b.windowStart >= windowMs) buckets.delete(k);
      }
      // 정리 후에도 상한을 넘으면 가장 먼저 들어온 항목부터 지운다
      while (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
        buckets.delete(buckets.keys().next().value as string);
      }
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
  };
}

/** AI 사유 API용: 접속자당 분당 10회 */
export const reasonRateLimiter = createRateLimiter(10, 60_000);

/**
 * AI 사유 API용: 접속자와 상관없이 서버 전체 합계 제한 (분당 60회).
 * 접속자 구분용 헤더를 바꿔 가며 보내거나 헤더가 없는 경우에도 전체 호출량에는 위쪽이 막혀 있게 한다.
 */
export const reasonGlobalLimiter = createRateLimiter(60, 60_000);
export const GLOBAL_KEY = "all";

/**
 * 실제 OpenAI 호출(저장된 결과를 못 쓴 경우)의 하루 상한 — 어떤 경우에도 하루 요금에 위쪽 한계를 둔다.
 * 샘플 조합이 업체 10 × 면허 5 정도라 평소에는 이 한도에 닿지 않는다.
 */
export const DAILY_AI_CALL_LIMIT = 300;
export const aiDailyLimiter = createRateLimiter(DAILY_AI_CALL_LIMIT, 24 * 60 * 60_000);
