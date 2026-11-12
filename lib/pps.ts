// 조달청 나라장터 "사용자정보 서비스"(UsrInfoService02) 조회 — 사업자등록번호로 업체 정보를 가져온다.
//   · 기본정보  getPrcrmntCorpBasicInfo02      : inqryDiv=3 + bizno (기간 없이 번호로 정확히 조회됨)
//   · 업종정보  getPrcrmntCorpIndstrytyInfo02  : inqryDiv=1 + bizno + 최근 1주 기간 (기간과 상관없이 그 업체의 업종 전체가 나옴)
//   · 부정당제재 getUnptRsttCorpInfo02          : inqryDiv=1 + bizno (조회 시점에 효력 있는 제재만 나옴. 없으면 0건)
// 보안: 인증키(NARAMARKET_API_KEY)는 서버에서만 읽는다. 로그·오류 메시지에 키나 주소를 남기지 않는다.
// 개인정보: 응답의 대표자명·전화번호·상세주소는 읽지 않는다(받아도 버린다). 주소는 시군구까지만 남긴다.
import "server-only";

import { addDays, todayString } from "./data/dates";
import type { PpsCompany, PpsIndustry, PpsSanction } from "./types";

const BASE_URL = "https://apis.data.go.kr/1230000/ao/UsrInfoService02";
/** 조달청 응답을 기다리는 최대 시간 */
export const PPS_TIMEOUT_MS = 8_000;
/** 같은 번호를 다시 조회할 때 조달청을 다시 부르지 않는 시간 */
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 500;

export type PpsLookupOutcome =
  | { status: "found"; company: PpsCompany }
  | { status: "notFound" }
  | { status: "error" };

// ───────────── 응답 읽기 ─────────────

interface ApiResult {
  ok: boolean;
  items: Record<string, unknown>[];
}

/** 조달청 응답 JSON에서 결과 코드와 항목 목록을 꺼낸다. 오류 응답·이상한 형식이면 ok=false */
function readResponse(json: unknown): ApiResult {
  const response = (json as { response?: { header?: { resultCode?: string }; body?: { items?: unknown } } })?.response;
  if (!response || response.header?.resultCode !== "00") return { ok: false, items: [] };
  let items: unknown = response.body?.items;
  // 항목이 하나뿐이면 배열이 아니라 객체로 오기도 한다
  if (items && !Array.isArray(items)) {
    const inner = (items as { item?: unknown }).item;
    items = inner === undefined ? [items] : Array.isArray(inner) ? inner : [inner];
  }
  const list = Array.isArray(items) ? items.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
  return { ok: true, items: list };
}

async function callApi(operation: string, params: Record<string, string>): Promise<ApiResult> {
  const key = process.env.NARAMARKET_API_KEY;
  if (!key) {
    console.error("[pps] NARAMARKET_API_KEY가 설정되어 있지 않습니다.");
    return { ok: false, items: [] };
  }
  try {
    const query = new URLSearchParams({ serviceKey: key, type: "json", numOfRows: "100", pageNo: "1", ...params });
    const res = await fetch(`${BASE_URL}/${operation}?${query}`, {
      signal: AbortSignal.timeout(PPS_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[pps] ${operation} 실패: HTTP ${res.status}`);
      return { ok: false, items: [] };
    }
    const result = readResponse(await res.json());
    if (!result.ok) console.error(`[pps] ${operation} 오류 응답`);
    return result;
  } catch (error) {
    // 시간 초과·네트워크 오류. 주소나 키가 섞일 수 있어 종류만 기록한다
    console.error(`[pps] ${operation} 호출 중 오류: ${error instanceof Error ? error.name : "unknown"}`);
    return { ok: false, items: [] };
  }
}

// ───────────── 값 정리 ─────────────

const text = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  // 줄바꿈·제어문자를 없애고 길이를 제한한다 (화면·AI 입력에 이상한 글자가 들어가지 않게)
  const cleaned = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned.slice(0, 100);
};

/** "2026-10-20 00:00:00" → "2026-10-20" (날짜 모양이 아니면 null) */
function dateOf(v: unknown): string | null {
  const s = text(v);
  const m = s?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** 주소를 시군구까지만 남긴다. "서울특별시 중랑구 면목동" → "서울특별시 중랑구", "세종특별자치시 한솔동" → "세종특별자치시" */
export function toSigungu(regionName: unknown): string | null {
  const s = text(regionName);
  if (!s) return null;
  const [first, second] = s.split(" ");
  if (second && /[시군구]$/.test(second)) return `${first} ${second}`;
  return first;
}

/** 업종 1건으로 정리. 만료일이 비어 있거나 2099년이면 "만료일 없음"(null)으로 본다 */
export function toIndustry(item: Record<string, unknown>): PpsIndustry | null {
  const name = text(item.indstrytyNm);
  if (!name) return null;
  const expires = dateOf(item.vldPrdExprtDt);
  return {
    name,
    registeredAt: dateOf(item.rgstDt),
    expiresAt: expires && !expires.startsWith("2099") ? expires : null,
    status: text(item.indstrytyStatsNm),
    representative: item.rprsntIndstrytyYn === "Y",
  };
}

/** 부정당제재 1건으로 정리. 사유 등은 외부 데이터라 길이를 제한한다 */
export function toSanction(item: Record<string, unknown>): PpsSanction {
  return {
    startDate: dateOf(item.rsttBgnDate),
    endDate: dateOf(item.rsttEndDate),
    institution: text(item.insttNm),
    reason: text(item.enfcPrvNm),
    law: text(item.lawordNm),
  };
}

// ───────────── 같은 번호 재조회 줄이기 ─────────────

const cache = new Map<string, { at: number; value: PpsLookupOutcome }>();

/** 시험에서 저장된 조회 결과를 비운다 */
export function clearPpsCache(): void {
  cache.clear();
}

// ───────────── 업체 조회 ─────────────

/**
 * 사업자등록번호(숫자 10자리)로 조달청에서 업체를 찾는다.
 *  · 기본정보가 없으면 "notFound"
 *  · 기본정보 호출이 실패하면 "error"
 *  · 기본정보는 있는데 업종·제재 호출만 실패하면 그 항목을 null(확인 불가)로 두고 found로 돌려준다 (판정에서 "검토 필요")
 */
export async function lookupPpsCompany(bizNo: string, today: string = todayString()): Promise<PpsLookupOutcome> {
  const hit = cache.get(bizNo);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && hit.value.status !== "error") {
    return hit.value;
  }

  const to = today.replaceAll("-", "") + "2359";
  const from = addDays(today, -6).replaceAll("-", "") + "0000";
  const [basic, industry, sanction] = await Promise.all([
    callApi("getPrcrmntCorpBasicInfo02", { inqryDiv: "3", bizno: bizNo }),
    callApi("getPrcrmntCorpIndstrytyInfo02", { inqryDiv: "1", bizno: bizNo, inqryBgnDt: from, inqryEndDt: to }),
    callApi("getUnptRsttCorpInfo02", { inqryDiv: "1", bizno: bizNo }),
  ]);

  let value: PpsLookupOutcome;
  if (!basic.ok) {
    value = { status: "error" };
  } else {
    // 번호가 정확히 같은 기록만 쓴다 (조회 조건이 무시되어 다른 업체가 섞여 와도 걸러낸다)
    const record = basic.items.find((i) => String(i.bizno ?? "").replace(/\D/g, "") === bizNo);
    if (!record) {
      value = { status: "notFound" };
    } else {
      const industries = industry.ok
        ? industry.items
            .filter((i) => String(i.bizno ?? bizNo).replace(/\D/g, "") === bizNo)
            .map(toIndustry)
            .filter((x): x is PpsIndustry => x !== null)
        : null;
      // 번호가 같은 제재만 쓴다. 호출이 실패하면 null(확인 불가) — "제재 없음"으로 단정하지 않는다
      const sanctions = sanction.ok
        ? sanction.items.filter((i) => String(i.bizno ?? bizNo).replace(/D/g, "") === bizNo).map(toSanction)
        : null;
      value = {
        status: "found",
        company: {
          bizNo,
          name: text(record.corpNm),
          region: toSigungu(record.rgnNm),
          openedAt: dateOf(record.opbizDt),
          bizDivision: text(record.corpBsnsDivNm),
          industries,
          sanctions,
          baseDate: today,
        },
      };
    }
  }

  // 조회 실패·업종 확인 불가(일부 실패)는 저장하지 않아 다음 조회 때 다시 시도한다
  const cacheable = value.status === "notFound" || (value.status === "found" && value.company.industries !== null && value.company.sanctions !== null);
  if (cacheable) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(bizNo, { at: Date.now(), value });
  }
  return value;
}
