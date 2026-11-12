// Design Ref: §5.1, §5.3 — 업체·면허·판정 결과의 데이터 모양 (브라우저·서버 공용)
// 규칙: 값이 없으면 null = 화면에서 "확인 불가". 기본값으로 채우지 않는다.
//       null(확인 불가)과 [](없음)을 구분한다. 예) 행정처분 null ≠ 행정처분 [] (이력 없음)

import type { LicenseName } from "./data/licenses";

export type { LicenseName };

// ───────────── 출처 ─────────────

/** 출처 이름: KISCON 형식 / 조달청(PPS) 형식 */
export type SourceName = "KISCON" | "PPS";

/** 영업 상태 */
export type BizStatus = "영업" | "휴업" | "폐업";

/** 출처 표시용 정보 (모든 항목에 따라붙는다) */
export interface SourceMeta {
  source: SourceName;
  /** 화면 표시 문구 — "출처: 샘플(KISCON 형식)" / "출처: 샘플(조달청 형식)" */
  label: string;
  /** 샘플 데이터 기준일 YYYY-MM-DD */
  baseDate: string;
}

// ───────────── 원본 데이터 (출처별로 따로 보관) ─────────────

export interface License {
  name: LicenseName;
  regNo: string;
  /** 만료일 YYYY-MM-DD */
  expiresAt: string;
}

export interface ContractRecord {
  title: string;
  year: number;
  amountKrw: number;
}

export interface Sanction {
  type: string;
  /** 처분일 YYYY-MM-DD */
  date: string;
  reason: string;
}

/** KISCON 형식 원본 */
export interface KisconRecord extends SourceMeta {
  companyName: string | null;
  /** 사업자등록증상 업종 */
  bizType: string | null;
  bizStatus: BizStatus | null;
  /** 시군구까지만 (예: "서울특별시 강남구") */
  address: string | null;
  /** null = 확인 불가, [] = 보유 면허 없음 */
  licenses: License[] | null;
  contracts: ContractRecord[] | null;
  /** null = 확인 불가, [] = 이력 없음 */
  sanctions: Sanction[] | null;
}

/** 조달청 형식 원본 */
export interface PpsRecord extends SourceMeta {
  companyName: string | null;
  address: string | null;
  registration: {
    registered: boolean;
    /** 등록 유효기간 만료일 YYYY-MM-DD */
    expiresAt: string | null;
  } | null;
  /** 신용·재무 */
  credit: { grade: string; evaluatedAt: string } | null;
}

/** 업체 1곳 (샘플 데이터의 한 줄) */
export interface Company {
  /** "c01" ~ "c10" */
  id: string;
  /** 숫자 10자리로 저장 (화면에서는 000-00-00001 로 표시) */
  bizNo: string;
  kiscon: KisconRecord | null;
  pps: PpsRecord | null;
}

// ───────────── 화면용으로 정리한 결과 (API 응답) ─────────────

/** 항목 1개의 값 — 정상 / 출처 불일치 / 확인 불가 중 하나 */
export type FieldValue<T> =
  | { kind: "value"; value: T; source: SourceMeta }
  | { kind: "conflict"; values: { value: T; source: SourceMeta }[] }
  | { kind: "unknown"; source?: SourceMeta };

/** 조회 항목 7개를 한 업체 단위로 모은 것 */
export interface CompanyView {
  id: string;
  /** 표시용 000-00-00001 */
  bizNo: string;
  /** 1. 업체 기본정보 */
  basic: {
    companyName: FieldValue<string>;
    bizType: FieldValue<string>;
    bizStatus: FieldValue<BizStatus>;
  };
  /** 2. 주소지(시군구) — 값은 판정에 쓰지 않음 */
  address: FieldValue<string>;
  /** 3. 면허 */
  licenses: FieldValue<License[]>;
  /** 4. 조달청 업체등록 */
  procurement: FieldValue<{ registered: boolean; expiresAt: string | null }>;
  /** 5. 계약 실적 — 값은 판정에 쓰지 않음 */
  contracts: FieldValue<ContractRecord[]>;
  /** 6. 신용·재무 — 값은 판정에 쓰지 않음 */
  credit: FieldValue<{ grade: string; evaluatedAt: string }>;
  /** 7. 행정처분 이력 */
  sanctions: FieldValue<Sanction[]>;
}

// ───────────── 판정 결과 ─────────────

/** 결과는 이 3단계만 쓴다 */
export type Verdict = "적격" | "부적격" | "검토 필요";

export interface Judgment {
  verdict: Verdict;
  /** 판정 기준일 (오늘) YYYY-MM-DD */
  evaluatedAt: string;
  selectedLicense: LicenseName;
  /** 부적격 사유 (코드가 만든 문장) */
  disqualifiers: string[];
  /** 검토 필요 사유 (코드가 만든 문장) */
  reviewItems: string[];
}
