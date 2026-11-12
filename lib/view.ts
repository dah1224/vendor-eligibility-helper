// Design Ref: §3.1, §5.3 — 조달청에서 받은 업체(PpsCompany)를 화면용 조회 항목(CompanyView)으로 정리한다.
// 규칙: 값이 없으면 "확인 불가"(unknown)로 두고, 추측해서 채우지 않는다.
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { formatBizNo } from "./bizNo";
import type { CompanyView, FieldValue, PpsCompany, SourceMeta } from "./types";

/** 이 앱이 쓰는 유일한 출처 */
export function ppsSource(baseDate: string): SourceMeta {
  return { source: "PPS", label: "조달청", baseDate };
}

/** 값이 있으면 정상 값, 없으면 확인 불가 */
function field<T>(value: T | null, source: SourceMeta): FieldValue<T> {
  return value === null ? { kind: "unknown", source } : { kind: "value", value, source };
}

export function buildCompanyView(company: PpsCompany): CompanyView {
  const source = ppsSource(company.baseDate);
  return {
    id: company.bizNo,
    bizNo: formatBizNo(company.bizNo),
    basic: {
      companyName: field(company.name, source),
      bizDivision: field(company.bizDivision, source),
      openedAt: field(company.openedAt, source),
    },
    address: field(company.region, source),
    procurement: field(company.industries === null ? null : { industries: company.industries }, source),
    sanctions: field(company.sanctions === null ? null : { sanctions: company.sanctions }, source),
  };
}
