// Design Ref: §7.1 — 사업자등록번호로 조달청에서 업체를 찾는다. (업체명 검색은 하지 않는다)
// 번호: 하이픈 유무와 관계없이 숫자 10자리가 아니면 검색하지 않고 형식 오류를 알린다.
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { BIZ_NO_FORMAT_ERROR, MAX_QUERY_LENGTH, normalizeBizNo } from "./bizNo";
import { todayString } from "./data/dates";
import { PPS_FAILED_MESSAGE } from "./messages";
import { lookupPpsCompany } from "./pps";

// 입력 최대 길이(Design §10)는 브라우저 검색창도 같이 써야 해서 lib/bizNo.ts에 둔다. 기존 import 경로가 깨지지 않게 다시 내보낸다.
export { MAX_QUERY_LENGTH };

/** 검색 결과 목록의 한 줄 */
export interface SearchResultItem {
  /** 업체 식별자 = 사업자등록번호 숫자 10자리 */
  id: string;
  /** 표시용 000-00-00001 */
  bizNo: string;
  companyName: string | null;
  address: string | null;
}

export type SearchOutcome =
  | { ok: true; results: SearchResultItem[] }
  | {
      ok: false;
      status: 400 | 502;
      code: "EMPTY_QUERY" | "QUERY_TOO_LONG" | "INVALID_BIZ_NO" | "PPS_FAILED";
      message: string;
    };

export async function searchCompanies(rawBizNo: string, today: string = todayString()): Promise<SearchOutcome> {
  const text = rawBizNo.trim();

  if (text === "") {
    return { ok: false, status: 400, code: "EMPTY_QUERY", message: "사업자등록번호를 입력해 주세요." };
  }
  if (text.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      status: 400,
      code: "QUERY_TOO_LONG",
      message: `입력은 ${MAX_QUERY_LENGTH}자 이내로 해 주세요.`,
    };
  }
  const bizNo = normalizeBizNo(text);
  if (bizNo === null) {
    return { ok: false, status: 400, code: "INVALID_BIZ_NO", message: BIZ_NO_FORMAT_ERROR };
  }

  const found = await lookupPpsCompany(bizNo, today);
  if (found.status === "error") {
    return { ok: false, status: 502, code: "PPS_FAILED", message: PPS_FAILED_MESSAGE };
  }
  if (found.status === "notFound") return { ok: true, results: [] };

  const c = found.company;
  return {
    ok: true,
    results: [{ id: c.bizNo, bizNo: c.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3"), companyName: c.name, address: c.region }],
  };
}
