// Design Ref: §12.1 T2~T6 — 판정 함수 judge() 자동 테스트
// Plan SC-3: 판정 결과가 PRD 규칙과 샘플 10곳 모두 일치해야 한다.
import { describe, expect, it } from "vitest";
import { COMPANIES } from "../lib/data/companies";
import { addDays, todayString } from "../lib/data/dates";
import { judge } from "../lib/eligibility";
import type { Company, Verdict } from "../lib/types";

const TODAY = todayString(); // 샘플 날짜가 "오늘 기준"으로 만들어지므로 같은 오늘을 쓴다

/** 모든 조건을 충족하는 c01을 복사해 일부만 바꾼다 */
function variant(mutate: (c: Company) => void): Company {
  const c = structuredClone(COMPANIES[0]);
  mutate(c);
  return c;
}
const verdictOf = (c: Company, today = TODAY): Verdict => judge(c, today).verdict;

describe("T2: 샘플 10곳이 기대 판정과 일치 (DESIGN §8)", () => {
  const expected: Record<string, Verdict> = {
    c01: "적격",
    c02: "적격",
    c03: "적격",
    c04: "부적격",
    c05: "부적격",
    c06: "부적격",
    c07: "적격",
    c08: "검토 필요",
    c09: "검토 필요",
    c10: "검토 필요",
  };

  it("업체는 10곳이다", () => {
    expect(COMPANIES).toHaveLength(10);
  });

  for (const [id, verdict] of Object.entries(expected)) {
    it(`${id} → ${verdict}`, () => {
      const company = COMPANIES.find((c) => c.id === id)!;
      expect(judge(company, TODAY).verdict).toBe(verdict);
    });
  }

  it("부적격·검토 필요에는 사유가 1줄 이상 있다 (PRD)", () => {
    for (const c of COMPANIES) {
      const j = judge(c, TODAY);
      if (j.verdict !== "적격") {
        expect(j.disqualifiers.length + j.reviewItems.length).toBeGreaterThan(0);
      }
    }
  });

  it("면허는 판정에 쓰이지 않는다: 면허가 곧 만료되거나 이미 지나도 판정은 그대로 (c03·c07 → 적격)", () => {
    const c07 = COMPANIES.find((c) => c.id === "c07")!; // 면허 만료 18일 전
    expect(judge(c07, TODAY).verdict).toBe("적격");
    const expired = variant((c) => (c.kiscon!.licenses![0].expiresAt = addDays(TODAY, -5)));
    expect(judge(expired, TODAY).verdict).toBe("적격");
  });

  it("판정 결과에 선택 면허 항목이 없다", () => {
    expect(judge(COMPANIES[0], TODAY)).not.toHaveProperty("selectedLicense");
  });
});

describe("T3: 만료일 경계값 (조달청)", () => {
  it("조달청: D-31 적격 / D-30 검토 필요 / D-0 검토 필요 / 지남 부적격", () => {
    const withReg = (d: number) => variant((c) => (c.pps!.registration!.expiresAt = addDays(TODAY, d)));
    expect(verdictOf(withReg(31))).toBe("적격");
    expect(verdictOf(withReg(30))).toBe("검토 필요");
    expect(verdictOf(withReg(0))).toBe("검토 필요");
    expect(verdictOf(withReg(-1))).toBe("부적격");
  });
});

describe("T4: 행정처분 1년 경계값", () => {
  // 기준일(today)을 임의로 고정하므로, 면허·조달청 만료일도 그 기준일에 맞춰 넉넉하게 둔다
  // (그렇지 않으면 다른 이유로 부적격·검토 필요가 되어 처분 경계값만 따로 볼 수 없다)
  const sanctionOn = (date: string, today: string) =>
    variant((c) => {
      c.kiscon!.licenses![0].expiresAt = addDays(today, 400);
      c.pps!.registration!.expiresAt = addDays(today, 400);
      c.kiscon!.sanctions = [{ type: "시정명령", date, reason: "시험" }];
    });

  it("정확히 1년 전은 포함(부적격), 1년+1일 전은 제외(적격)", () => {
    expect(verdictOf(sanctionOn("2025-11-12", "2026-11-12"), "2026-11-12")).toBe("부적격");
    expect(verdictOf(sanctionOn("2025-11-11", "2026-11-12"), "2026-11-12")).toBe("적격");
  });

  it("오늘 날짜 처분도 포함", () => {
    expect(verdictOf(sanctionOn("2026-11-12", "2026-11-12"), "2026-11-12")).toBe("부적격");
  });

  it("윤일(2월 29일) 기준의 1년 전은 2월 28일", () => {
    expect(verdictOf(sanctionOn("2027-02-28", "2028-02-29"), "2028-02-29")).toBe("부적격");
    expect(verdictOf(sanctionOn("2027-02-27", "2028-02-29"), "2028-02-29")).toBe("적격");
  });
});

describe("T5: 확인 불가는 부적격이 아니라 검토 필요", () => {
  it("면허 null", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.licenses = null)))).toBe("검토 필요");
  });
  it("조달청 등록 null", () => {
    expect(verdictOf(variant((c) => (c.pps!.registration = null)))).toBe("검토 필요");
  });
  it("행정처분 null", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.sanctions = null)))).toBe("검토 필요");
  });
  it("영업 상태 null", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.bizStatus = null)))).toBe("검토 필요");
  });
  it("주소지·실적·신용재무가 확인 불가여도 검토 필요 (DESIGN §6.4)", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.contracts = null)))).toBe("검토 필요");
    expect(verdictOf(variant((c) => (c.pps!.credit = null)))).toBe("검토 필요");
  });
  it("조달청 등록은 있는데 만료일이 없으면 적격이 될 수 없다", () => {
    expect(verdictOf(variant((c) => (c.pps!.registration!.expiresAt = null)))).toBe("검토 필요");
  });
  it("'없음'([])은 확인 불가가 아니다", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.contracts = [])))).toBe("적격");
    expect(verdictOf(variant((c) => (c.kiscon!.sanctions = [])))).toBe("적격");
  });
});

describe("T6: 폐업·휴업", () => {
  it("휴업 → 부적격", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.bizStatus = "휴업")))).toBe("부적격");
  });
  it("폐업 → 부적격", () => {
    expect(verdictOf(variant((c) => (c.kiscon!.bizStatus = "폐업")))).toBe("부적격");
  });
});

describe("출처 불일치 (R4)", () => {
  it("상호의 (주)·공백 표기 차이는 같은 값", () => {
    expect(verdictOf(variant((c) => (c.pps!.companyName = "(주)가람시설관리(가상)")))).toBe("적격");
  });
  it("주소지가 다르면 두 값이 사유에 모두 나온다", () => {
    const c10 = COMPANIES.find((c) => c.id === "c10")!;
    const text = judge(c10, TODAY).reviewItems.join(" ");
    expect(text).toContain("서울특별시 강남구");
    expect(text).toContain("서울특별시 서초구");
  });
});

describe("판정 우선순위", () => {
  it("부적격이면서 검토 필요 사유도 있으면 부적격이고 두 사유를 모두 담는다", () => {
    const c = variant((x) => {
      x.kiscon!.bizStatus = "폐업";
      x.pps!.credit = null;
    });
    const j = judge(c, TODAY);
    expect(j.verdict).toBe("부적격");
    expect(j.disqualifiers.length).toBeGreaterThan(0);
    expect(j.reviewItems.length).toBeGreaterThan(0);
  });
});
