// Design Ref: §12.1 — 판정 함수 judge() 자동 테스트 (조달청 정보만으로 판정한다)
import { describe, expect, it } from "vitest";
import { addDays, todayString } from "../lib/data/dates";
import { judge } from "../lib/eligibility";
import type { PpsCompany, PpsIndustry, Verdict } from "../lib/types";

const TODAY = todayString();

const industry = (expiresInDays: number | null, over: Partial<PpsIndustry> = {}): PpsIndustry => ({
  name: "시설물유지관리업",
  registeredAt: "2020-01-02",
  expiresAt: expiresInDays === null ? null : addDays(TODAY, expiresInDays),
  status: "정상",
  representative: false,
  ...over,
});

/** 모든 조건을 충족하는 업체를 기본으로 하고 일부만 바꾼다 */
function company(over: Partial<PpsCompany> = {}): PpsCompany {
  return {
    bizNo: "1000000001",
    name: "가람시설관리(가상)",
    region: "서울특별시 강남구",
    openedAt: "2015-03-02",
    bizDivision: "공사",
    industries: [industry(null)],
    sanctions: [],
    baseDate: TODAY,
    ...over,
  };
}
const verdictOf = (c: PpsCompany, today = TODAY): Verdict => judge(c, today).verdict;

describe("적격", () => {
  it("만료일 없는 업종이 있고 확인 불가 항목이 없으면 적격", () => {
    const j = judge(company(), TODAY);
    expect(j.verdict).toBe("적격");
    expect(j.disqualifiers).toEqual([]);
    expect(j.reviewItems).toEqual([]);
    expect(j.evaluatedAt).toBe(TODAY);
  });
});

describe("조달청 업체등록 유효기간 경계값", () => {
  const withIndustry = (d: number) => company({ industries: [industry(d)] });
  it("D-31 적격 / D-30 검토 필요 / D-0 검토 필요 / 지남 부적격", () => {
    expect(verdictOf(withIndustry(31))).toBe("적격");
    expect(verdictOf(withIndustry(30))).toBe("검토 필요");
    expect(verdictOf(withIndustry(0))).toBe("검토 필요");
    expect(verdictOf(withIndustry(-1))).toBe("부적격");
  });
  it("업종이 여럿이면 가장 늦은 만료일 기준: 하나만 지나도 다른 하나가 유효하면 부적격이 아니다", () => {
    expect(verdictOf(company({ industries: [industry(-10), industry(200)] }))).toBe("적격");
  });
  it("모든 업종이 지났으면 부적격, 사유에 가장 늦은 만료일이 나온다", () => {
    const j = judge(company({ industries: [industry(-40), industry(-5)] }), TODAY);
    expect(j.verdict).toBe("부적격");
    expect(j.disqualifiers.join(" ")).toContain(addDays(TODAY, -5));
  });
  it("만료일 없는 업종이 하나라도 있으면 다른 업종이 곧 만료돼도 검토 필요가 아니다", () => {
    expect(verdictOf(company({ industries: [industry(null), industry(10)] }))).toBe("적격");
  });
  it("지난 업종과 30일 이내 업종이 섞이면 유효한 것(30일 이내)만 기준으로 검토 필요", () => {
    expect(verdictOf(company({ industries: [industry(-3), industry(12)] }))).toBe("검토 필요");
  });
});

describe("확인 불가·없음은 부적격이 아니라 검토 필요", () => {
  it("등록된 업종이 없음([]) → 검토 필요 (부적격으로 단정하지 않는다)", () => {
    const j = judge(company({ industries: [] }), TODAY);
    expect(j.verdict).toBe("검토 필요");
    expect(j.reviewItems.join(" ")).toContain("등록된 업종이 없습니다");
  });
  it("업종 확인 불가(null) → 검토 필요", () => {
    const j = judge(company({ industries: null }), TODAY);
    expect(j.verdict).toBe("검토 필요");
    expect(j.reviewItems.join(" ")).toContain("조달청 업체등록 정보를 확인할 수 없습니다");
  });
  it("상호 확인 불가 → 검토 필요", () => {
    expect(verdictOf(company({ name: null }))).toBe("검토 필요");
  });
  it("주소지 확인 불가 → 검토 필요", () => {
    expect(verdictOf(company({ region: null }))).toBe("검토 필요");
  });
});

describe("부정당제재 (이력이 있으면 부적격)", () => {
  const sanction = {
    startDate: addDays(TODAY, -20),
    endDate: addDays(TODAY, 100),
    institution: "가상시 가상구",
    reason: "계약 이행을 하지 않은 자(가상)",
    law: "지방계약법-부정당제재근거법령",
  };
  it("제재가 1건이라도 있으면 다른 조건이 모두 좋아도 부적격", () => {
    const j = judge(company({ sanctions: [sanction] }), TODAY);
    expect(j.verdict).toBe("부적격");
    expect(j.disqualifiers[0]).toContain("부정당제재");
    expect(j.disqualifiers[0]).toContain("1건");
  });
  it("사유에 제재 기간과 사유 요약이 들어간다", () => {
    const text = judge(company({ sanctions: [sanction] }), TODAY).disqualifiers.join(" ");
    expect(text).toContain(sanction.startDate);
    expect(text).toContain(sanction.endDate);
    expect(text).toContain("계약 이행을 하지 않은 자");
  });
  it("제재가 없으면([]) 영향 없음", () => {
    expect(verdictOf(company({ sanctions: [] }))).toBe("적격");
  });
  it("제재 확인 불가(null)는 부적격이 아니라 검토 필요", () => {
    const j = judge(company({ sanctions: null }), TODAY);
    expect(j.verdict).toBe("검토 필요");
    expect(j.reviewItems.join(" ")).toContain("부정당제재 이력 정보를 확인할 수 없습니다");
  });
  it("제재와 유효기간 지남이 함께 있으면 부적격 사유가 둘 다 나온다", () => {
    const j = judge(company({ sanctions: [sanction], industries: [industry(-3)] }), TODAY);
    expect(j.verdict).toBe("부적격");
    expect(j.disqualifiers).toHaveLength(2);
  });
});

describe("판정에 쓰지 않는 항목", () => {
  it("개업일·업체업무구분이 없어도 판정은 그대로 적격", () => {
    expect(verdictOf(company({ openedAt: null, bizDivision: null }))).toBe("적격");
  });
});

describe("판정 우선순위와 사유", () => {
  it("부적격이면서 검토 필요 사유도 있으면 부적격이고 두 사유를 모두 담는다", () => {
    const j = judge(company({ industries: [industry(-1)], region: null }), TODAY);
    expect(j.verdict).toBe("부적격");
    expect(j.disqualifiers.length).toBeGreaterThan(0);
    expect(j.reviewItems.length).toBeGreaterThan(0);
  });
  it("부적격·검토 필요에는 사유가 1줄 이상 있다 (PRD)", () => {
    const cases = [
      company({ industries: [industry(-1)] }),
      company({ industries: [] }),
      company({ industries: [industry(5)] }),
      company({ name: null }),
    ];
    for (const c of cases) {
      const j = judge(c, TODAY);
      expect(j.verdict).not.toBe("적격");
      expect(j.disqualifiers.length + j.reviewItems.length).toBeGreaterThan(0);
    }
  });
  it("판정 결과에 면허·행정처분 같은 조달청 밖 항목은 없다", () => {
    const j = judge(company(), TODAY);
    expect(j).not.toHaveProperty("selectedLicense");
    expect(Object.keys(j).sort()).toEqual(["disqualifiers", "evaluatedAt", "reviewItems", "verdict"]);
  });
});
