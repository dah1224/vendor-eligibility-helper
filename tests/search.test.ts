// Design Ref: §12.2 A1~A4 — 검색 규칙 (API가 쓰는 searchCompanies)
// 업체명과 사업자등록번호를 둘 다 받아, 둘 다 맞는 업체만 찾는다.
import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, searchCompanies } from "../lib/search";

function ids(name: string, bizNo: string): string[] {
  const outcome = searchCompanies(name, bizNo);
  if (!outcome.ok) throw new Error(`검색 실패: ${outcome.code}`);
  return outcome.results.map((r) => r.id);
}

describe("업체명 + 사업자등록번호", () => {
  it("둘 다 맞으면 그 업체 1곳", () => {
    expect(ids("가람시설관리", "000-00-00001")).toEqual(["c01"]);
  });
  it("번호는 하이픈이 있든 없든 같다", () => {
    expect(ids("가람시설관리", "0000000001")).toEqual(["c01"]);
  });
  it("업체명은 공백·대소문자를 무시한 부분 일치", () => {
    expect(ids(" 가 람 시설 ", "0000000001")).toEqual(["c01"]);
  });
  it("이름이 비슷한 업체가 있어도 번호가 다르면 찾지 않는다 ('가람'은 c01·c02 둘 다 맞지만 번호로 1곳)", () => {
    expect(ids("가람", "000-00-00001")).toEqual(["c01"]);
    expect(ids("가람", "000-00-00002")).toEqual(["c02"]);
  });
  it("번호는 맞아도 업체명이 다르면 0건", () => {
    expect(ids("나래전기", "000-00-00001")).toEqual([]);
  });
  it("업체명은 맞아도 번호가 다르면 0건", () => {
    expect(ids("가람시설관리", "000-00-00002")).toEqual([]);
  });
  it("없는 업체·번호는 빈 배열 (0건)", () => {
    expect(ids("없는업체", "999-99-99999")).toEqual([]);
  });
  it("결과에 표시용 번호·상호·주소가 들어 있다", () => {
    expect(searchCompanies("나래", "0000000003")).toEqual({
      ok: true,
      results: [
        { id: "c03", bizNo: "000-00-00003", companyName: "나래전기(가상)", address: "인천광역시 남동구" },
      ],
    });
  });
  it("번호 10은 c10만 (정확 일치)", () => {
    expect(ids("자연", "000-00-00010")).toEqual(["c10"]);
  });
});

describe("입력 검사", () => {
  it("업체명이 비어 있으면 오류", () => {
    expect(searchCompanies("   ", "0000000001")).toMatchObject({ ok: false, code: "EMPTY_NAME" });
  });
  it("사업자등록번호가 비어 있으면 오류", () => {
    expect(searchCompanies("가람", "  ")).toMatchObject({ ok: false, code: "EMPTY_BIZ_NO" });
  });
  it("번호가 10자리가 아니면 검색하지 않고 형식 오류", () => {
    for (const bizNo of ["123-45", "000-00-0001", "00000000011", "abc"]) {
      expect(searchCompanies("가람", bizNo)).toMatchObject({ ok: false, code: "INVALID_BIZ_NO" });
    }
  });
  it(`${MAX_QUERY_LENGTH}자를 넘으면 오류`, () => {
    const long = "가".repeat(MAX_QUERY_LENGTH + 1);
    expect(searchCompanies(long, "0000000001")).toMatchObject({ ok: false, code: "QUERY_TOO_LONG" });
    expect(searchCompanies("가람", "0".repeat(MAX_QUERY_LENGTH + 1))).toMatchObject({ ok: false, code: "QUERY_TOO_LONG" });
  });
});
