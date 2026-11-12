// Design Ref: §7.3 — POST /api/reason : AI가 정리한 판정 사유 문장
// 요청: { id, license } (판정·사유 문장은 받지 않는다 — 서버가 다시 계산한다)
// 200: { text } / 400: INVALID_REQUEST·INVALID_LICENSE / 404: NOT_FOUND / 429: RATE_LIMITED / 502: AI_FAILED
import type { NextRequest } from "next/server";
import { reasonRateLimiter } from "@/lib/rateLimit";
import { generateReason } from "@/lib/reason";

const MAX_ID_LENGTH = 10;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 접속자 구분용 주소. 프록시(Vercel 등)가 붙이는 헤더의 첫 값을 쓴다 */
function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function POST(request: NextRequest) {
  if (!reasonRateLimiter.allow(clientKey(request))) {
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
