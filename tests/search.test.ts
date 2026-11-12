// Design Ref: §12.2 A1~A4 — 검색 규칙 (API가 쓰는 searchCompanies)
// 업체명이나 사업자등록번호 중 하나만 입력해도 찾고, 둘 다 입력하면 둘 다 맞는 업체만 찾는다.
import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, searchCompanies } from "../lib/search";

function ids(name: string, bizNo: string): string[] {
  const outcome = searchCompanies(name, bizNo);
  if (!outcome.ok) throw new Error(`검색 실패: ${outcome.code}`);
  return outcome.results.map((r) => r.id);
}

describe("업체명만 입력", () => {
  it("'가람'은 2곳 (c01, c02) — 담당자가 골라야 하는 경우", () => {
    expect(ids("가람", "")).toEqual(["c01", "c02"]);
  });
  it("공백·대소문자를 무시한 부분 일치", () => {
    expect(ids(" 가 람 시설 ", "")).toEqual(["c01"]);
  });
  it("없는 업체는 빈 배열 (0건)", () => {
    expect(ids("없는업체", "")).toEqual([]);
  });
  it("결과에 표시용 번호·상호·주소가 들어 있다", () => {
    expect(searchCompanies("나래", "")).toEqual({
      ok: true,
      results: [
        { id: "c03", bizNo: "000-00-00003", companyName: "나래전기(가상)", address: "인천광역시 남동구" },
      ],
    });
  });
});

describe("사업자등록번호만 입력", () => {
  it("하이픈이 있든 없든 같은 업체 1곳", () => {
    expect(ids("", "000-00-00001")).toEqual(["c01"]);
    expect(ids("", "0000000001")).toEqual(["c01"]);
  });
  it("정확히 일치만 찾는다 (10은 c10만)", () => {
    expect(ids("", "000-00-00010")).toEqual(["c10"]);
  });
  it("없는 번호는 0건", () => {
    expect(ids("", "999-99-99999")).toEqual([]);
  });
  it("10자리가 아니면 검색하지 않고 형식 오류", () => {
    for (const bizNo of ["123-45", "000-00-0001", "00000000011", "abc"]) {
      expect(searchCompanies("", bizNo)).toMatchObject({ ok: false, code: "INVALID_BIZ_NO" });
    }
  });
});

describe("둘 다 입력 — 둘 다 맞아야 한다", () => {
  it("둘 다 맞으면 그 업체 1곳", () => {
    expect(ids("가람시설관리", "000-00-00001")).toEqual(["c01"]);
  });
  it("이름이 비슷한 업체가 있어도 번호로 가려진다 ('가람' + 번호)", () => {
    expect(ids("가람", "000-00-00001")).toEqual(["c01"]);
    expect(ids("가람", "000-00-00002")).toEqual(["c02"]);
  });
  it("번호는 맞아도 업체명이 다르면 0건", () => {
    expect(ids("나래전기", "000-00-00001")).toEqual([]);
  });
  it("업체명은 맞아도 번호가 다르면 0건", () => {
    expect(ids("가람시설관리", "000-00-00002")).toEqual([]);
  });
  it("이름을 입력하고 번호 형식이 틀리면 형식 오류 (이름만으로 찾지 않는다)", () => {
    expect(searchCompanies("가람", "123")).toMatchObject({ ok: false, code: "INVALID_BIZ_NO" });
  });
});

describe("입력 검사", () => {
  it("둘 다 비어 있으면 오류", () => {
    expect(searchCompanies("   ", "  ")).toMatchObject({ ok: false, code: "EMPTY_QUERY" });
  });
  it(`${MAX_QUERY_LENGTH}자를 넘으면 오류`, () => {
    const long = "가".repeat(MAX_QUERY_LENGTH + 1);
    expect(searchCompanies(long, "")).toMatchObject({ ok: false, code: "QUERY_TOO_LONG" });
    expect(searchCompanies("", "0".repeat(MAX_QUERY_LENGTH + 1))).toMatchObject({ ok: false, code: "QUERY_TOO_LONG" });
  });
});
