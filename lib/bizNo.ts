// Design Ref: §4.1, §7.1 — 사업자등록번호 정리·검사 (브라우저·서버 공용이라 server-only 아님)
// PRD 규칙: 하이픈(-)이 있든 없든 똑같이 인식하고, 숫자가 10자리가 아니면 검색하지 않고 형식 오류를 알린다.
// 브라우저에서 먼저 검사해 바로 알려주고, 서버도 같은 함수로 한 번 더 검사한다(우회 방지).

/** 검색어 최대 길이 (Design §10) — 검색창과 서버가 같은 값을 쓴다 */
export const MAX_QUERY_LENGTH = 50;

/** 형식 오류 안내 문구 (화면·API 공용) */
export const BIZ_NO_FORMAT_ERROR = "사업자등록번호는 숫자 10자리여야 합니다.";

/**
 * 검색어가 "사업자등록번호처럼" 보이는지 — 숫자와 하이픈만 있고 숫자가 1개 이상.
 * 이런 검색어는 업체명이 아니라 번호로 취급한다.
 */
export function looksLikeBizNo(query: string): boolean {
  const q = query.trim();
  return /^[0-9-]+$/.test(q) && /[0-9]/.test(q);
}

/**
 * 사업자등록번호를 숫자 10자리 문자열로 정리한다.
 * - "000-00-00001", "0000000001" → "0000000001"
 * - 숫자가 10자리가 아니거나 숫자·하이픈 외 문자가 섞여 있으면 null
 */
export function normalizeBizNo(input: string): string | null {
  const q = input.trim();
  if (!/^[0-9-]+$/.test(q)) return null;
  const digits = q.replace(/-/g, "");
  return /^[0-9]{10}$/.test(digits) ? digits : null;
}

/** 숫자 10자리 → 표시용 "000-00-00001" (10자리가 아니면 그대로 돌려준다) */
export function formatBizNo(digits: string): string {
  if (!/^[0-9]{10}$/.test(digits)) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** 검색어를 해석한 결과 */
export type ParsedQuery =
  | { kind: "bizNo"; bizNo: string } // 올바른 번호 → 번호로 검색
  | { kind: "invalidBizNo"; message: string } // 번호처럼 보이지만 10자리가 아님 → 검색하지 않음
  | { kind: "name"; name: string } // 업체명으로 검색
  | { kind: "empty" }; // 비어 있음

/** 검색어 하나를 번호 검색 / 형식 오류 / 업체명 검색 / 빈 값 중 하나로 가른다 */
export function parseSearchQuery(query: string): ParsedQuery {
  const q = query.trim();
  if (q === "") return { kind: "empty" };
  if (looksLikeBizNo(q)) {
    const bizNo = normalizeBizNo(q);
    return bizNo
      ? { kind: "bizNo", bizNo }
      : { kind: "invalidBizNo", message: BIZ_NO_FORMAT_ERROR };
  }
  return { kind: "name", name: q };
}
