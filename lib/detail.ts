// Design Ref: §7.2 — 업체 1곳의 조회 항목 7개(CompanyView)와 판정 결과(Judgment)를 함께 만든다.
// 같은 자리에서 데이터를 꺼내 판정해야 화면과 판정이 서로 다른 데이터를 볼 일이 없다. (Design §4.2)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { COMPANIES } from "./data/companies";
import { todayString } from "./data/dates";
import { judge } from "./eligibility";
import { NO_COMPANY_MESSAGE } from "./messages";
import type { CompanyView, Judgment } from "./types";
import { buildCompanyView } from "./view";

export type DetailOutcome =
  | { ok: true; company: CompanyView; judgment: Judgment }
  | { ok: false; status: 404; code: "NOT_FOUND"; message: string };

/**
 * @param id 업체 id (예: "c01")
 * @param today 판정 기준일 — 기본은 요청 시점의 오늘(한국 시간)
 */
export function getCompanyDetail(id: string, today: string = todayString()): DetailOutcome {
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
    judgment: judge(company, today),
  };
}
