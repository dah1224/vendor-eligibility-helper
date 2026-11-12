// Design Ref: §8 — 가상 샘플 업체 10곳 (실제 업체·사람 정보 아님)
// Design Ref: §5.4 — 날짜는 "오늘로부터 며칠"로 적어, 언제 열어도 사례(만료 임박 등)가 유지된다.
// Design Ref: §10 — 서버에서만 쓴다. 브라우저 코드에서 불러오면 빌드 단계에서 막힌다.
// 개인정보 없음: 대표자·전화번호·상세 주소 없음, 주소는 시군구까지, 사업자등록번호는 형식만 맞춘 가짜 번호.
import "server-only";

import type {
  Company,
  ContractRecord,
  KisconRecord,
  License,
  PpsRecord,
  Sanction,
} from "../types";
import { daysFromToday, todayString } from "./dates";

const TODAY = todayString();
const d = (days: number) => daysFromToday(days, TODAY);

/** 샘플 데이터 기준일 — 오늘 하루 전 (기준일이 오늘보다 미래가 되지 않게) */
const BASE_DATE = d(-1);

// ───────────── 출처별 기본 틀 ─────────────

function kiscon(
  companyName: string,
  address: string,
  rest: Partial<KisconRecord> = {},
): KisconRecord {
  return {
    source: "KISCON",
    label: "출처: 샘플(KISCON 형식)",
    baseDate: BASE_DATE,
    companyName,
    bizType: "시설관리업",
    bizStatus: "영업",
    address,
    licenses: [lic("시설물유지관리업", "K-0001", 400)],
    contracts: contracts(),
    sanctions: [],
    ...rest,
  };
}

function pps(
  companyName: string,
  address: string,
  rest: Partial<PpsRecord> = {},
): PpsRecord {
  return {
    source: "PPS",
    label: "출처: 샘플(조달청 형식)",
    baseDate: BASE_DATE,
    companyName,
    address,
    registration: { registered: true, expiresAt: d(300) },
    credit: { grade: "A", evaluatedAt: d(-90) },
    ...rest,
  };
}

function lic(
  name: License["name"],
  regNo: string,
  expiresInDays: number,
): License {
  return { name, regNo, expiresAt: d(expiresInDays) };
}

function contracts(): ContractRecord[] {
  return [
    { title: "청사 시설관리 용역(가상)", year: 2025, amountKrw: 120_000_000 },
    { title: "공공도서관 설비 유지관리(가상)", year: 2024, amountKrw: 80_000_000 },
  ];
}

function sanction(daysAgo: number, type: string, reason: string): Sanction {
  return { type, date: d(-daysAgo), reason };
}

// ───────────── 샘플 업체 10곳 ─────────────
// 기대 판정은 선택 면허 = 시설물유지관리업 기준 (DESIGN §8)

export const COMPANIES: Company[] = [
  // c01 — 모든 조건 충족 → 적격
  {
    id: "c01",
    bizNo: "0000000001",
    kiscon: kiscon("가람시설관리(가상)", "서울특별시 강남구"),
    pps: pps("가람시설관리(가상)", "서울특별시 강남구"),
  },

  // c02 — 모든 조건 충족, 행정처분은 1년 넘게 지남 → 적격 ("가람" 검색 시 2곳)
  {
    id: "c02",
    bizNo: "0000000002",
    kiscon: kiscon("가람종합설비(가상)", "경기도 수원시", {
      licenses: [lic("시설물유지관리업", "K-0002", 500)],
      sanctions: [sanction(430, "시정명령", "안전 점검 기록 미비(가상)")],
    }),
    pps: pps("가람종합설비(가상)", "경기도 수원시"),
  },

  // c03 — 전기공사업만 보유 → 부적격 (D1: 선택 면허 없음)
  {
    id: "c03",
    bizNo: "0000000003",
    kiscon: kiscon("나래전기(가상)", "인천광역시 남동구", {
      bizType: "전기공사업",
      licenses: [lic("전기공사업", "K-0003", 600)],
    }),
    pps: pps("나래전기(가상)", "인천광역시 남동구"),
  },

  // c04 — 조달청 기록은 있으나 미등록 → 부적격 (D2)
  {
    id: "c04",
    bizNo: "0000000004",
    kiscon: kiscon("다온빌딩서비스(가상)", "부산광역시 해운대구", {
      licenses: [lic("시설물유지관리업", "K-0004", 450)],
    }),
    pps: pps("다온빌딩서비스(가상)", "부산광역시 해운대구", {
      registration: { registered: false, expiresAt: null },
    }),
  },

  // c05 — 4개월 전 영업정지 처분 → 부적격 (D3)
  {
    id: "c05",
    bizNo: "0000000005",
    kiscon: kiscon("라온시설(가상)", "대구광역시 수성구", {
      licenses: [lic("시설물유지관리업", "K-0005", 380)],
      sanctions: [sanction(120, "영업정지", "계약 이행 불성실(가상)")],
    }),
    pps: pps("라온시설(가상)", "대구광역시 수성구"),
  },

  // c06 — 폐업 → 부적격 (D4)
  {
    id: "c06",
    bizNo: "0000000006",
    kiscon: kiscon("마루관리(가상)", "대전광역시 서구", {
      bizStatus: "폐업",
      licenses: [lic("시설물유지관리업", "K-0006", 420)],
    }),
    pps: pps("마루관리(가상)", "대전광역시 서구"),
  },

  // c07 — 면허 만료 18일 전 → 검토 필요 (R1)
  {
    id: "c07",
    bizNo: "0000000007",
    kiscon: kiscon("바른설비(가상)", "광주광역시 북구", {
      licenses: [lic("시설물유지관리업", "K-0007", 18)],
    }),
    pps: pps("바른설비(가상)", "광주광역시 북구"),
  },

  // c08 — 조달청 등록 만료 25일 전 → 검토 필요 (R2)
  {
    id: "c08",
    bizNo: "0000000008",
    kiscon: kiscon("사랑시설관리(가상)", "울산광역시 남구", {
      licenses: [lic("시설물유지관리업", "K-0008", 460)],
    }),
    pps: pps("사랑시설관리(가상)", "울산광역시 남구", {
      registration: { registered: true, expiresAt: d(25) },
    }),
  },

  // c09 — 신용·재무 확인 불가(null) → 검토 필요 (R3)
  {
    id: "c09",
    bizNo: "0000000009",
    kiscon: kiscon("아라종합관리(가상)", "세종특별자치시", {
      licenses: [lic("시설물유지관리업", "K-0009", 480)],
    }),
    pps: pps("아라종합관리(가상)", "세종특별자치시", { credit: null }),
  },

  // c10 — 주소지가 KISCON·조달청에서 서로 다름 → 검토 필요 (R4)
  {
    id: "c10",
    bizNo: "0000000010",
    kiscon: kiscon("자연건물관리(가상)", "서울특별시 강남구", {
      licenses: [lic("시설물유지관리업", "K-0010", 520)],
    }),
    pps: pps("자연건물관리(가상)", "서울특별시 서초구"),
  },
];
