// Design Ref: §7.1 — 샘플 업체를 업체명·사업자등록번호로 찾는다.
// 업체명이나 사업자등록번호 중 하나만 입력해도 찾고, 둘 다 입력하면 둘 다 맞는 업체만 찾는다. (번호: 정확 일치 / 업체명: 공백을 무시한 부분 일치)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { BIZ_NO_FORMAT_ERROR, MAX_QUERY_LENGTH, normalizeBizNo } from "./bizNo";
import { COMPANIES } from "./data/companies";
import { buildCompanyView } from "./view";
import type { FieldValue } from "./types";

// 검색어 최대 길이(Design §10)는 브라우저 검색창도 같이 써야 해서 lib/bizNo.ts에 둔다. 기존 import 경로가 깨지지 않게 다시 내보낸다.
export { MAX_QUERY_LENGTH };

/** 검색 결과 목록의 한 줄 */
export interface SearchResultItem {
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
      code: "EMPTY_QUERY" | "QUERY_TOO_LONG" | "INVALID_BIZ_NO";
      message: string;
    };

/** 비교용: 공백을 모두 없애고 소문자로 */
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 항목 값에서 목록에 보여줄 글자 하나를 고른다 (불일치면 첫 출처 값, 확인 불가면 null) */
function firstText(field: FieldValue<string>): string | null {
  if (field.kind === "value") return field.value;
  if (field.kind === "conflict") return field.values[0]?.value ?? null;
  return null;
}

/**
 * 업체명·사업자등록번호 중 하나 이상을 받아 찾는다. 둘 다 입력하면 둘 다 맞는 업체만 나온다. (같은 이름의 업체는 번호를 함께 넣으면 가려진다)
 *  · 사업자등록번호: 하이픈 유무와 관계없이 정확히 일치 (숫자 10자리가 아니면 검색하지 않고 형식 오류)
 *  · 업체명: 공백·대소문자를 무시한 부분 일치 (두 출처의 상호 중 하나라도 맞으면 됨)
 */
export function searchCompanies(rawName: string, rawBizNo: string): SearchOutcome {
  const name = rawName.trim();
  const bizNoText = rawBizNo.trim();

  if (name === "" && bizNoText === "") {
    return { ok: false, code: "EMPTY_QUERY", message: "업체명이나 사업자등록번호를 입력해 주세요." };
  }
  if (name.length > MAX_QUERY_LENGTH || bizNoText.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      code: "QUERY_TOO_LONG",
      message: `입력은 ${MAX_QUERY_LENGTH}자 이내로 해 주세요.`,
    };
  }
  // 번호를 입력했다면 10자리여야 한다 (비어 있으면 업체명만으로 찾는다)
  let bizNo: string | null = null;
  if (bizNoText !== "") {
    bizNo = normalizeBizNo(bizNoText);
    if (bizNo === null) {
      return { ok: false, code: "INVALID_BIZ_NO", message: BIZ_NO_FORMAT_ERROR };
    }
  }

  // 입력한 조건은 모두 맞아야 한다 (둘 다 입력하면 둘 다 일치, 하나만 입력하면 그 하나만 일치)
  const needle = squash(name);
  const matched = COMPANIES.filter(
    (company) =>
      (bizNo === null || company.bizNo === bizNo) &&
      (name === "" ||
        [company.kiscon?.companyName, company.pps?.companyName].some(
          (n) => n != null && squash(n).includes(needle),
        )),
  );

  const results = matched.map((company) => {
    const view = buildCompanyView(company);
    return {
      id: company.id,
      bizNo: view.bizNo,
      companyName: firstText(view.basic.companyName),
      address: firstText(view.address),
    };
  });

  return { ok: true, results };
}
