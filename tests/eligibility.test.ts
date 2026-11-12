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
    industries: [industry(null)],
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
