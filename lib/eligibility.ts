// Design Ref: §6 — 판정은 코드가 한다. 이 파일이 판정 규칙 전부를 맡는다.
// 조달청에서 가져올 수 있는 정보만으로 판정한다. (면허·영업 상태·행정처분·계약 실적·신용은 조달청에서 받을 수 없어 판정하지 않는다)
//   부적격 조건 → findDisqualifiers : 조달청 등록 업종이 모두 유효기간이 지남
//   검토 필요 조건 → findReviewItems : 등록 업종 없음 / 유효기간 30일 이내 / 확인 불가 항목
//   최종 판정 → judge()  (부적격 > 검토 필요 > 적격 순으로 먼저 해당하는 단계)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import { daysBetween } from "./data/dates";
import type { CompanyView, FieldValue, Judgment, PpsCompany, Verdict } from "./types";
import { buildCompanyView } from "./view";

/** 만료 임박 기준 (일) — PRD: 30일 이내 */
const EXPIRY_WARNING_DAYS = 30;

/** 부적격 사유 문장 목록. 빈 배열이면 부적격 조건이 없다는 뜻. */
export function findDisqualifiers(company: PpsCompany, today: string): string[] {
  const industries = company.industries;
  // 업종 정보가 확인 불가(null)이거나 등록 업종이 없으면([]) 부적격으로 단정하지 않는다 → 검토 필요
  if (!industries || industries.length === 0) return [];

  // 만료일이 없는 업종은 유효하다. 모든 업종이 만료일이 오늘보다 앞서면 조달청 등록이 효력을 잃은 것.
  const allExpired = industries.every((i) => i.expiresAt !== null && i.expiresAt < today);
  if (!allExpired) return [];

  const latest = industries.map((i) => i.expiresAt as string).sort().at(-1);
  return [`조달청에 등록된 업종의 유효기간이 모두 지났습니다(가장 늦은 만료일 ${latest}).`];
}

/** 만료까지 남은 일수를 "N일 뒤(날짜)" 문구로 */
function expiryPhrase(days: number, date: string): string {
  return days === 0 ? `오늘(${date})` : `${days}일 뒤(${date})`;
}

/** 검토 필요 사유 문장 목록. 빈 배열이면 검토 필요 조건이 없다는 뜻. */
export function findReviewItems(company: PpsCompany, view: CompanyView, today: string): string[] {
  const items: string[] = [];

  // 조달청 업체등록: 업종이 없으면 등록 여부를 단정하지 않고 검토로 올린다
  const industries = company.industries;
  if (industries && industries.length === 0) {
    items.push("조달청에 등록된 업종이 없습니다.");
  }
  // 유효한(만료 전) 업종 중 만료일이 가장 이른 것이 30일 이내면 검토 필요.
  // 만료일이 없는 업종이 하나라도 있으면 만료 걱정이 없다고 본다.
  if (industries && industries.length > 0) {
    const valid = industries.filter((i) => i.expiresAt === null || i.expiresAt >= today);
    const hasNoExpiry = valid.some((i) => i.expiresAt === null);
    if (valid.length > 0 && !hasNoExpiry) {
      const latest = valid.map((i) => i.expiresAt as string).sort().at(-1) as string;
      const days = daysBetween(today, latest);
      if (days <= EXPIRY_WARNING_DAYS) {
        items.push(`조달청 업체등록(등록 업종 중 가장 늦은 유효기간)이 ${expiryPhrase(days, latest)} 만료됩니다.`);
      }
    }
  }

  // 확인 불가 항목
  const fields: { label: string; field: FieldValue<unknown> }[] = [
    { label: "상호", field: view.basic.companyName },
    { label: "주소지", field: view.address },
    { label: "조달청 업체등록", field: view.procurement },
  ];
  for (const { label, field } of fields) {
    if (field.kind === "unknown") items.push(`${label} 정보를 확인할 수 없습니다.`);
  }
  return items;
}

/**
 * 업체 1곳을 판정한다.
 * 부적격 조건이 있어도 검토 필요 사유를 함께 모아 담당자가 전체 상황을 볼 수 있게 한다.
 * `today`를 인자로 받아 테스트에서 날짜를 고정할 수 있다.
 */
export function judge(company: PpsCompany, today: string): Judgment {
  const view = buildCompanyView(company);
  const disqualifiers = findDisqualifiers(company, today);
  const reviewItems = findReviewItems(company, view, today);

  const verdict: Verdict =
    disqualifiers.length > 0 ? "부적격" : reviewItems.length > 0 ? "검토 필요" : "적격";

  return { verdict, evaluatedAt: today, disqualifiers, reviewItems };
}
