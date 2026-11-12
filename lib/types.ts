// 조달청(나라장터) 조회 결과·판정 결과의 데이터 모양 (브라우저·서버 공용)
// 규칙: 값이 없으면 "확인 불가"(unknown)로 둔다. 기본값으로 채우지 않는다.
//       확인 불가(null)와 없음([])을 구분한다. 예) 업종 null ≠ 업종 [] (조달청에 등록된 업종 없음)

// ───────────── 출처 ─────────────

/** 출처 이름 — 지금은 조달청(PPS)만 쓴다 */
export type SourceName = "PPS";

/** 출처 표시용 정보 */
export interface SourceMeta {
  source: SourceName;
  /** 화면 표시 문구 */
  label: string;
  /** 조회한 날(기준일) YYYY-MM-DD */
  baseDate: string;
}

// ───────────── 조달청에서 받아 정리한 원본 ─────────────

/** 조달청에 등록된 업종 1건 */
export interface PpsIndustry {
  /** 업종명 */
  name: string;
  /** 등록일 YYYY-MM-DD (모르면 null) */
  registeredAt: string | null;
  /** 유효기간 만료일 YYYY-MM-DD. null = 만료일 없음(비어 있거나 2099-12-31) */
  expiresAt: string | null;
  /** 업종 상태 (예: "정상") — 모르면 null */
  status: string | null;
  /** 대표 업종 여부 */
  representative: boolean;
}

/** 조달청에서 찾은 업체 1곳 (개인정보 항목 — 대표자·전화·상세주소 — 는 받아도 버린다) */
export interface PpsCompany {
  /** 숫자 10자리 */
  bizNo: string;
  /** 상호 (모르면 null) */
  name: string | null;
  /** 시군구까지만 (예: "서울특별시 중랑구") — 모르면 null */
  region: string | null;
  /** null = 확인 불가(조회 실패), [] = 조달청에 등록된 업종 없음 */
  industries: PpsIndustry[] | null;
  /** 조회한 날(기준일) */
  baseDate: string;
}

// ───────────── 화면용으로 정리한 결과 (API 응답) ─────────────

/** 항목 1개의 값 — 정상 / 확인 불가 중 하나 */
export type FieldValue<T> =
  | { kind: "value"; value: T; source: SourceMeta }
  | { kind: "unknown"; source?: SourceMeta };

/** 조회 항목(조달청에서 가져올 수 있는 것만)을 한 업체 단위로 모은 것 */
export interface CompanyView {
  /** 업체 식별자 = 사업자등록번호 숫자 10자리 */
  id: string;
  /** 표시용 000-00-00001 */
  bizNo: string;
  /** 1) 기본정보 */
  basic: {
    companyName: FieldValue<string>;
  };
  /** 주소지(시군구) */
  address: FieldValue<string>;
  /** 2) 조달청 업체등록 — 등록된 업종 목록 */
  procurement: FieldValue<{ industries: PpsIndustry[] }>;
}

// ───────────── 판정 결과 ─────────────

/** 결과는 이 3단계만 쓴다 */
export type Verdict = "적격" | "부적격" | "검토 필요";

export interface Judgment {
  verdict: Verdict;
  /** 판정 기준일 (오늘) YYYY-MM-DD */
  evaluatedAt: string;
  /** 부적격 사유 (코드가 만든 문장) */
  disqualifiers: string[];
  /** 검토 필요 사유 (코드가 만든 문장) */
  reviewItems: string[];
}
