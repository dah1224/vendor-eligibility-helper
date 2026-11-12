// Design Ref: §12.2 A1~A4 — 검색 규칙 (사업자등록번호로만, 조달청 조회)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPpsCache } from "../lib/pps";
import { MAX_QUERY_LENGTH, searchCompanies } from "../lib/search";
import { TODAY, mockPpsResponse } from "./helpers/pps-mock";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearPpsCache();
  fetchMock = vi.fn(async (url: string) => mockPpsResponse(url) ?? new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NARAMARKET_API_KEY", "test-pps-key-not-real");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("사업자등록번호 검색", () => {
  it("하이픈이 있든 없든 같은 업체 1곳", async () => {
    for (const q of ["100-00-00001", "1000000001", " 100-00-00001 "]) {
      const r = await searchCompanies(q, TODAY);
      expect(r).toEqual({
        ok: true,
        results: [{ id: "1000000001", bizNo: "100-00-00001", companyName: "가람시설관리(가상)", address: "서울특별시 강남구" }],
      });
    }
  });
  it("조달청에 없는 번호는 빈 배열 (0건)", async () => {
    expect(await searchCompanies("199-99-99999", TODAY)).toEqual({ ok: true, results: [] });
  });
  it("조달청 조회가 실패하면 502 — 0건 안내와 구분한다", async () => {
    const r = await searchCompanies("100-00-00006", TODAY);
    expect(r).toMatchObject({ ok: false, status: 502, code: "PPS_FAILED" });
  });
});

describe("입력 검사 — 조달청을 부르지 않는다", () => {
  it("비어 있으면 오류", async () => {
    expect(await searchCompanies("   ", TODAY)).toMatchObject({ ok: false, status: 400, code: "EMPTY_QUERY" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("10자리가 아니거나 숫자가 아니면 형식 오류", async () => {
    for (const q of ["123-45", "000-00-0001", "00000000011", "abc", "가람시설관리"]) {
      expect(await searchCompanies(q, TODAY)).toMatchObject({ ok: false, status: 400, code: "INVALID_BIZ_NO" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it(`${MAX_QUERY_LENGTH}자를 넘으면 오류`, async () => {
    expect(await searchCompanies("1".repeat(MAX_QUERY_LENGTH + 1), TODAY)).toMatchObject({
      ok: false,
      code: "QUERY_TOO_LONG",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
