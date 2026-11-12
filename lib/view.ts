// Design Ref: §3.1, §5.3 — 출처별 원본(Company)을 화면용 조회 항목 7개(CompanyView)로 정리한다.
// 규칙: 값이 없으면 "확인 불가"(unknown), 출처 간 값이 다르면 "불일치"(conflict)로 두 값을 모두 담는다.
//       한쪽 출처만 있는 값은 그대로 쓰고, 추측해서 채우지 않는다.
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import type {
  Company,
  CompanyView,
  FieldValue,
  SourceMeta,
} from "./types";
import { formatBizNo } from "./bizNo";

/** 출처 정보만 뽑는다 (원본 레코드 전체가 화면으로 나가지 않게) */
function metaOf(record: SourceMeta | null | undefined): SourceMeta | undefined {
  if (!record) return undefined;
  return { source: record.source, label: record.label, baseDate: record.baseDate };
}

interface Candidate<T> {
  value: T | null;
  /** 값을 가진(또는 가져야 할) 출처 */
  source: SourceMeta | undefined;
}

/**
 * 출처별 후보 값들을 항목 1개로 합친다.
 * - 값이 하나도 없음 → 확인 불가
 * - 값이 있는 출처가 하나, 또는 여러 출처가 같은 값 → 정상 값
 * - 값이 있는 출처끼리 서로 다름 → 불일치 (모두 보여줌)
 */
function merge<T>(
  candidates: Candidate<T>[],
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): FieldValue<T> {
  const found = candidates.filter(
    (c): c is { value: T; source: SourceMeta } =>
      c.value !== null && c.source !== undefined,
  );
  if (found.length === 0) {
    return { kind: "unknown", source: candidates.find((c) => c.source)?.source };
  }
  const first = found[0];
  if (found.every((f) => same(first.value, f.value))) {
    return { kind: "value", value: first.value, source: first.source };
  }
  return {
    kind: "conflict",
    values: found.map((f) => ({ value: f.value, source: f.source })),
  };
}

/** 상호 비교용: 공백과 "(주)"·"주식회사" 표기 차이는 같은 값으로 본다 */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.replace(/\s+/g, "").replace(/\(주\)|㈜|주식회사/g, "");
  return norm(a) === norm(b);
}

/** 주소 비교용: 공백 차이는 같은 값으로 본다 */
function sameText(a: string, b: string): boolean {
  return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
}

/** 원본 업체 데이터 → 화면용 조회 항목 7개 */
export function buildCompanyView(company: Company): CompanyView {
  const k = company.kiscon;
  const p = company.pps;
  const km = metaOf(k);
  const pm = metaOf(p);

  return {
    id: company.id,
    bizNo: formatBizNo(company.bizNo),
    basic: {
      companyName: merge(
        [
          { value: k?.companyName ?? null, source: km },
          { value: p?.companyName ?? null, source: pm },
        ],
        sameName,
      ),
      bizType: merge([{ value: k?.bizType ?? null, source: km }]),
      bizStatus: merge([{ value: k?.bizStatus ?? null, source: km }]),
    },
    address: merge(
      [
        { value: k?.address ?? null, source: km },
        { value: p?.address ?? null, source: pm },
      ],
      sameText,
    ),
    licenses: merge([{ value: k?.licenses ?? null, source: km }]),
    procurement: merge([{ value: p?.registration ?? null, source: pm }]),
    contracts: merge([{ value: k?.contracts ?? null, source: km }]),
    credit: merge([{ value: p?.credit ?? null, source: pm }]),
    sanctions: merge([{ value: k?.sanctions ?? null, source: km }]),
  };
}
