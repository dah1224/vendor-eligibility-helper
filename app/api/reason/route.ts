// Design Ref: §7.3 — POST /api/reason : AI가 정리한 판정 사유 문장
// 요청: { id, license } (판정·사유 문장은 받지 않는다 — 서버가 다시 계산한다)
// 200: { text } / 400: INVALID_REQUEST·INVALID_LICENSE / 403: FORBIDDEN_ORIGIN / 404: NOT_FOUND / 415: UNSUPPORTED_MEDIA_TYPE / 429: RATE_LIMITED / 502: AI_FAILED
import type { NextRequest } from "next/server";
import { GLOBAL_KEY, reasonGlobalLimiter, reasonRateLimiter } from "@/lib/rateLimit";
import { generateReason } from "@/lib/reason";

const MAX_ID_LENGTH = 10;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 접속자 구분용 주소. 프록시(Vercel 등)가 붙이는 헤더의 첫 값을 쓴다 */
function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/**
 * 다른 사이트가 방문자의 브라우저로 대신 호출하는 것을 막는다. (CHECK.md 우선순위 1)
 *  · Content-Type이 application/json이 아니면 거부 — text/plain 형태의 "단순 요청"은 브라우저가 사전 확인 없이 보낸다.
 *  · Origin 또는 Sec-Fetch-Site가 다른 사이트를 가리키면 거부. 헤더가 없는 호출(curl 등)은 허용한다.
 */
function checkRequestSource(request: NextRequest): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "요청 형식이 올바르지 않습니다.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return errorResponse(403, "FORBIDDEN_ORIGIN", "허용되지 않은 요청입니다.");
  }
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* 형식이 이상한 Origin은 아래에서 거부 */
    }
    if (!host || originHost !== host) {
      return errorResponse(403, "FORBIDDEN_ORIGIN", "허용되지 않은 요청입니다.");
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rejected = checkRequestSource(request);
  if (rejected) return rejected;

  // 전체 합계 → 접속자별 순서로 검사한다 (접속자 구분이 위조되어도 전체 호출량은 제한된다)
  if (!reasonGlobalLimiter.allow(GLOBAL_KEY) || !reasonRateLimiter.allow(clientKey(request))) {
    return errorResponse(429, "RATE_LIMITED", "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "요청 형식이 올바르지 않습니다.");
  }

  // 허용하는 것은 id(최대 10자)와 license 두 값뿐. 그 밖의 값은 무시한다.
  const { id, license } = (body ?? {}) as { id?: unknown; license?: unknown };
  if (typeof id !== "string" || id === "" || id.length > MAX_ID_LENGTH || typeof license !== "string") {
    return errorResponse(400, "INVALID_REQUEST", "요청 형식이 올바르지 않습니다.");
  }

  const outcome = await generateReason(id, license);
  if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.message);
  return Response.json({ text: outcome.text });
}
