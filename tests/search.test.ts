// Design Ref: §12.2 A1~A4 — 검색 규칙 (API가 쓰는 searchCompanies)
import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, searchCompanies } from "../lib/search";

function ids(query: string): string[] {
  const outcome = searchCompanies(query);
  if (!outcome.ok) throw new Error(`검색 실패: ${outcome.code}`);
  return outcome.results.map((r) => r.id);
}

describe("업체명 검색", () => {
  it("'가람'은 2곳 (c01, c02) — 담당자가 골라야 하는 경우", () => {
    expect(ids("가람")).toEqual(["c01", "c02"]);
  });
  it("공백·대소문자를 무시한 부분 일치", () => {
    expect(ids(" 가 람 시설 ")).toEqual(["c01"]);
  });
  it("없는 업체는 빈 배열 (0건)", () => {
    expect(ids("없는업체")).toEqual([]);
  });
  it("결과에 표시용 번호·상호·주소가 들어 있다", () => {
    const outcome = searchCompanies("나래");
    expect(outcome).toEqual({
      ok: true,
      results: [
        { id: "c03", bizNo: "000-00-00003", companyName: "나래전기(가상)", address: "인천광역시 남동구" },
      ],
    });
  });
});

describe("사업자등록번호 검색", () => {
  it("하이픈이 있든 없든 같은 업체 1곳", () => {
    expect(ids("000-00-00001")).toEqual(["c01"]);
    expect(ids("0000000001")).toEqual(["c01"]);
  });
  it("정확히 일치만 찾는다 (10은 c10만)", () => {
    expect(ids("000-00-00010")).toEqual(["c10"]);
  });
  it("없는 번호는 0건", () => {
    expect(ids("999-99-99999")).toEqual([]);
  });
  it("10자리가 아니면 검색하지 않고 형식 오류", () => {
    for (const q of ["123-45", "000-00-0001", "00000000011"]) {
      expect(searchCompanies(q)).toMatchObject({ ok: false, code: "INVALID_BIZ_NO" });
    }
  });
});

describe("입력 검사", () => {
  it("빈 검색어는 오류", () => {
    expect(searchCompanies("   ")).toMatchObject({ ok: false, code: "EMPTY_QUERY" });
  });
  it(`${MAX_QUERY_LENGTH}자를 넘으면 오류`, () => {
    expect(searchCompanies("가".repeat(MAX_QUERY_LENGTH + 1))).toMatchObject({
      ok: false,
      code: "QUERY_TOO_LONG",
    });
  });
});
