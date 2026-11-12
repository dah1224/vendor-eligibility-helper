// Design Ref: §12.2 A5~A6 — 상세 조회 + 판정 (API가 쓰는 getCompanyDetail)
import { describe, expect, it } from "vitest";
import { todayString } from "../lib/data/dates";
import { getCompanyDetail } from "../lib/detail";

const L = "시설물유지관리업";
const TODAY = todayString();

describe("getCompanyDetail", () => {
  it("c06(폐업)은 부적격 판정과 사유를 돌려준다 (A5)", () => {
    const r = getCompanyDetail("c06", L, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.judgment.verdict).toBe("부적격");
    expect(r.judgment.disqualifiers).toContain("폐업한 업체입니다.");
    expect(r.judgment.selectedLicense).toBe(L);
    expect(r.judgment.evaluatedAt).toBe(TODAY);
  });

  it("조회 항목 7개가 모두 들어 있다 (Plan SC-2)", () => {
    const r = getCompanyDetail("c01", L, TODAY);
    if (!r.ok) throw new Error("실패");
    const v = r.company;
    expect(v.bizNo).toBe("000-00-00001");
    for (const key of ["basic", "address", "licenses", "procurement", "contracts", "credit", "sanctions"] as const) {
      expect(v[key]).toBeDefined();
    }
  });

  it("값이 없는 항목은 '확인 불가'(unknown)로 나온다 — c09 신용·재무", () => {
    const r = getCompanyDetail("c09", L, TODAY);
    if (!r.ok) throw new Error("실패");
    expect(r.company.credit.kind).toBe("unknown");
  });

  it("출처가 다른 항목은 두 값이 나란히 나온다 — c10 주소지", () => {
    const r = getCompanyDetail("c10", L, TODAY);
    if (!r.ok) throw new Error("실패");
    const address = r.company.address;
    expect(address.kind).toBe("conflict");
    if (address.kind === "conflict") {
      expect(address.values.map((x) => x.value)).toEqual(["서울특별시 강남구", "서울특별시 서초구"]);
    }
  });

  it("항목마다 출처와 기준일이 붙는다 (PRD)", () => {
    const r = getCompanyDetail("c01", L, TODAY);
    if (!r.ok) throw new Error("실패");
    const f = r.company.basic.companyName;
    expect(f.kind).toBe("value");
    if (f.kind === "value") {
      expect(f.source.label).toBe("출처: 샘플(KISCON 형식)");
      expect(f.source.baseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("선택한 면허가 판정에 반영된다 — c03", () => {
    const r1 = getCompanyDetail("c03", "전기공사업", TODAY);
    const r2 = getCompanyDetail("c03", L, TODAY);
    if (!r1.ok || !r2.ok) throw new Error("실패");
    expect(r1.judgment.verdict).toBe("적격");
    expect(r2.judgment.verdict).toBe("부적격");
  });

  it("면허가 없거나 목록에 없으면 400 (A6)", () => {
    for (const license of [null, "", "없는면허"]) {
      expect(getCompanyDetail("c01", license, TODAY)).toMatchObject({
        ok: false,
        status: 400,
        code: "INVALID_LICENSE",
      });
    }
  });

  it("없는 업체는 404 + PRD 안내 문구", () => {
    expect(getCompanyDetail("zzz", L, TODAY)).toEqual({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "일치하는 업체가 없습니다. 업체명이나 사업자등록번호를 확인해 주세요.",
    });
  });

  it("응답에 원본 레코드 전체나 개인정보성 값이 새지 않는다", () => {
    const r = getCompanyDetail("c01", L, TODAY);
    if (!r.ok) throw new Error("실패");
    const text = JSON.stringify(r);
    expect(text).not.toContain("kiscon");
    expect(text).not.toContain("telNo");
    expect(text).not.toContain("ceoNm");
  });
});
