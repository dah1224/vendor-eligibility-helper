// Design Ref: §6 — 판정은 코드가 한다. 이 파일이 판정 규칙 전부를 맡는다.
//   부적격 조건 3가지(D2~D4) → findDisqualifiers  (D1 '선택한 면허 없음'은 면허 선택을 없애면서 뺐다)
//   검토 필요 조건 3가지(R2~R4) → findReviewItems  (R1 '선택한 면허 만료 임박'도 같은 이유로 뺐다)
//   최종 판정 → judge()  (부적격 > 검토 필요 > 적격 순으로 먼저 해당하는 단계)
// Design Ref: §10 — 서버에서만 쓴다.
import "server-only";

import type {
  Company,
  CompanyView,
  FieldValue,
  Judgment,
  SourceName,
  Verdict,
} from "./types";
import { daysBetween } from "./data/dates";
import { buildCompanyView } from "./view";

/** 부적격 조건에 해당하는 사유 문장 목록을 돌려준다. 빈 배열이면 부적격 조건이 없다는 뜻. */
export function findDisqualifiers(company: Company, today: string): string[] {
  const reasons: string[] = [];

  const d2 = checkProcurement(company, today);
  if (d2) reasons.push(d2);

  const d3 = checkRecentSanctions(company, today);
  if (d3) reasons.push(d3);

  const d4 = checkBizStatus(company);
  if (d4) reasons.push(d4);

  return reasons;
}

// ───────────── D2: 조달청 미등록 ─────────────
// 등록 안 됨, 또는 등록 만료일이 오늘 이전이면 해당. 정보가 null이면 단정하지 않는다(→ R3).

function checkProcurement(company: Company, today: string): string | null {
  const reg = company.pps?.registration;
  if (!reg) return null;

  if (!reg.registered) {
    return "조달청 업체등록이 되어 있지 않습니다.";
  }
  if (reg.expiresAt && reg.expiresAt < today) {
    return `조달청 업체등록 유효기간이 지났습니다(만료일 ${reg.expiresAt}).`;
  }
  return null;
}

// ───────────── D3: 최근 1년 내 행정처분 1건 이상 ─────────────
// 기간: (오늘 − 1년) 이상 ~ 오늘 이하. 정확히 1년 전 날짜도 포함(보수적으로 판단). 이력이 null이면 단정하지 않는다(→ R3).

/** 오늘에서 1년 전 같은 월·일. 윤년 2/29는 2/28로 본다. */
function oneYearAgo(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${String(y - 1).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function checkRecentSanctions(company: Company, today: string): string | null {
  const sanctions = company.kiscon?.sanctions;
  if (!sanctions) return null;

  const cutoff = oneYearAgo(today);
  const recent = sanctions
    .filter((s) => s.date >= cutoff && s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length === 0) return null;

  const detail = recent.map((s) => `${s.date} ${s.type}`).join(", ");
  return `최근 1년 안에 행정처분 ${recent.length}건이 있습니다(${detail}).`;
}

// ───────────── D4: 폐업 또는 휴업 ─────────────
// 영업 상태가 null이면 단정하지 않는다(→ R3).

function checkBizStatus(company: Company): string | null {
  switch (company.kiscon?.bizStatus) {
    case "폐업":
      return "폐업한 업체입니다.";
    case "휴업":
      return "휴업 중인 업체입니다.";
    default:
      return null;
  }
}

// ───────────────────────────────────────────────────────────
// 검토 필요 조건 (R2~R4) — 하나라도 해당하면 "검토 필요"
// ───────────────────────────────────────────────────────────

/** 만료 임박 기준 (일) — PRD: 30일 이내 */
const EXPIRY_WARNING_DAYS = 30;

/** 검토 필요 사유 문장 목록을 돌려준다. 빈 배열이면 검토 필요 조건이 없다는 뜻. */
export function findReviewItems(company: Company, view: CompanyView, today: string): string[] {
  return [
    ...checkProcurementExpiry(company, today), // R2
    ...checkUnknownFields(view), // R3 — 7개 항목 전체
    ...checkConflictFields(view), // R4 — 7개 항목 전체
  ];
}

/** 만료까지 남은 일수를 "N일 뒤(날짜)" 문구로 */
function expiryPhrase(days: number, date: string): string {
  return days === 0 ? `오늘(${date})` : `${days}일 뒤(${date})`;
}

// R2: 조달청 업체등록 만료일이 오늘부터 30일 이내 (오늘 만료 포함). 이미 지났으면 D2에서 다룬다.
// 등록은 되어 있는데 만료일 정보가 없으면 만료 임박 여부를 알 수 없으므로 "확인 불가"로 보고 검토 필요에 올린다.
function checkProcurementExpiry(company: Company, today: string): string[] {
  const reg = company.pps?.registration;
  if (!reg || !reg.registered) return [];
  if (!reg.expiresAt) {
    return ["조달청 업체등록의 유효기간(만료일)을 확인할 수 없습니다."];
  }
  const days = daysBetween(today, reg.expiresAt);
  if (days < 0 || days > EXPIRY_WARNING_DAYS) return [];
  return [`조달청 업체등록이 ${expiryPhrase(days, reg.expiresAt)} 만료됩니다.`];
}

/** 7개 항목(세부 필드 포함)의 이름표와 값 */
function viewFields(view: CompanyView): { label: string; field: FieldValue<unknown> }[] {
  return [
    { label: "상호", field: view.basic.companyName },
    { label: "업종", field: view.basic.bizType },
    { label: "영업 상태", field: view.basic.bizStatus },
    { label: "주소지", field: view.address },
    { label: "면허", field: view.licenses },
    { label: "조달청 업체등록", field: view.procurement },
    { label: "계약 실적", field: view.contracts },
    { label: "신용·재무", field: view.credit },
    { label: "행정처분 이력", field: view.sanctions },
  ];
}

// R3: "확인 불가" 항목이 1개 이상. 주소지·실적·신용재무 포함 전체에 적용한다. (DESIGN §6.4)
function checkUnknownFields(view: CompanyView): string[] {
  return viewFields(view)
    .filter(({ field }) => field.kind === "unknown")
    .map(({ label }) => `${label} 정보를 확인할 수 없습니다.`);
}

// R4: 출처마다 값이 서로 다른 항목이 있음. 전체 항목에 적용한다.
const SOURCE_LABEL: Record<SourceName, string> = { KISCON: "KISCON", PPS: "조달청" };

function checkConflictFields(view: CompanyView): string[] {
  const items: string[] = [];
  for (const { label, field } of viewFields(view)) {
    if (field.kind !== "conflict") continue;
    const detail = field.values
      .map(
        (v) =>
          `${SOURCE_LABEL[v.source.source]}: ${typeof v.value === "string" ? v.value : "값 다름"}`,
      )
      .join(", ");
    items.push(`${label} 정보가 출처마다 다릅니다(${detail}).`);
  }
  return items;
}

// ───────────────────────────────────────────────────────────
// 최종 판정
// ───────────────────────────────────────────────────────────

/**
 * 업체 1곳을 판정한다.
 * 부적격 조건이 있어도 검토 필요 사유를 함께 모아 담당자가 전체 상황을 볼 수 있게 한다.
 * `today`를 인자로 받아 테스트에서 날짜를 고정할 수 있다.
 */
export function judge(company: Company, today: string): Judgment {
  const view = buildCompanyView(company);
  const disqualifiers = findDisqualifiers(company, today);
  const reviewItems = findReviewItems(company, view, today);

  const verdict: Verdict =
    disqualifiers.length > 0
      ? "부적격"
      : reviewItems.length > 0
        ? "검토 필요"
        : "적격";

  return { verdict, evaluatedAt: today, disqualifiers, reviewItems };
}
