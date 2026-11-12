// Design Ref: §7.2 — 업체 1곳의 조회 항목 7개(CompanyView)와 판정 결과(Judgment)를 함께 만든다.
// 같은 자리에서 데이터를 꺼내 판정해야 화면과 판정이 서로 다른 데이터를 볼 일이 없다. (Design §4.2)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { COMPANIES } from "./data/companies";
import { todayString } from "./data/dates";
import { LICENSE_REQUIRED_MESSAGE, isLicenseName } from "./data/licenses";
import { judge } from "./eligibility";
import { NO_COMPANY_MESSAGE } from "./messages";
import type { CompanyView, Judgment } from "./types";
import { buildCompanyView } from "./view";

export type DetailOutcome =
  | { ok: true; company: CompanyView; judgment: Judgment }
  | { ok: false; status: 400 | 404; code: "INVALID_LICENSE" | "NOT_FOUND"; message: string };

/**
 * @param id 업체 id (예: "c01")
 * @param license 담당자가 고른 면허 이름 (면허 목록 5개 중 하나여야 함)
 * @param today 판정 기준일 — 기본은 요청 시점의 오늘(한국 시간)
 */
export function getCompanyDetail(
  id: string,
  license: string | null,
  today: string = todayString(),
): DetailOutcome {
  // PRD: 검색 전에 필요한 면허를 먼저 고르게 한다 → 면허가 없거나 목록에 없으면 거부
  if (!isLicenseName(license)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_LICENSE",
      message: LICENSE_REQUIRED_MESSAGE,
    };
  }

  const company = COMPANIES.find((c) => c.id === id);
  if (!company) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: NO_COMPANY_MESSAGE,
    };
  }

  return {
    ok: true,
    company: buildCompanyView(company),
    judgment: judge(company, license, today),
  };
}
