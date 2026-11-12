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

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    allow(key, now = Date.now()) {
      // 오래된 항목 정리 (메모리가 계속 늘지 않게)
      if (buckets.size > 1000) {
        for (const [k, b] of buckets) if (now - b.windowStart >= windowMs) buckets.delete(k);
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
