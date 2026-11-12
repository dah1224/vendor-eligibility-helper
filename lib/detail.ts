// Design Ref: §7.2 — 업체 1곳의 조회 항목(CompanyView)과 판정 결과(Judgment)를 함께 만든다.
// 같은 자리에서 데이터를 꺼내 판정해야 화면과 판정이 서로 다른 데이터를 볼 일이 없다. (Design §4.2)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { normalizeBizNo } from "./bizNo";
import { todayString } from "./data/dates";
import { judge } from "./eligibility";
import { NO_COMPANY_MESSAGE, PPS_FAILED_MESSAGE } from "./messages";
import { lookupPpsCompany } from "./pps";
import type { CompanyView, Judgment } from "./types";
import { buildCompanyView } from "./view";

export type DetailOutcome =
  | { ok: true; company: CompanyView; judgment: Judgment }
  | { ok: false; status: 404 | 502; code: "NOT_FOUND" | "PPS_FAILED"; message: string };

/**
 * @param id 업체 식별자 = 사업자등록번호 (하이픈 유무 무관, 숫자 10자리)
 * @param today 판정 기준일 — 기본은 요청 시점의 오늘(한국 시간)
 */
export async function getCompanyDetail(id: string, today: string = todayString()): Promise<DetailOutcome> {
  const bizNo = normalizeBizNo(id);
  // 번호 모양이 아니면 조달청을 부르지 않고 "없는 업체"로 처리한다 (이상한 값이 외부 호출로 새어 나가지 않게)
  if (bizNo === null) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: NO_COMPANY_MESSAGE };
  }

  const found = await lookupPpsCompany(bizNo, today);
  if (found.status === "error") {
    return { ok: false, status: 502, code: "PPS_FAILED", message: PPS_FAILED_MESSAGE };
  }
  if (found.status === "notFound") {
    return { ok: false, status: 404, code: "NOT_FOUND", message: NO_COMPANY_MESSAGE };
  }

  return {
    ok: true,
    company: buildCompanyView(found.company),
    judgment: judge(found.company, today),
  };
}
