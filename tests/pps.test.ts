// 조달청 조회 모듈(lib/pps.ts) 시험 — 실제 조달청은 부르지 않고 fetch를 가짜로 바꾼다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPpsCache, lookupPpsCompany, toIndustry, toSigungu } from "../lib/pps";
import { MOCK_COMPANIES, TODAY, mockPpsResponse } from "./helpers/pps-mock";

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

describe("lookupPpsCompany", () => {
  it("번호로 찾으면 상호·시군구·업종을 돌려준다", async () => {
    const r = await lookupPpsCompany("1000000001", TODAY);
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    expect(r.company.name).toBe("가람시설관리(가상)");
    expect(r.company.region).toBe("서울특별시 강남구"); // 동은 버린다
    expect(r.company.industries).toHaveLength(2);
    expect(r.company.openedAt).toBe("2015-03-02");
    expect(r.company.bizDivision).toBe("공사");
    expect(r.company.sanctions).toEqual([]);
    expect(r.company.baseDate).toBe(TODAY);
  });

  it("부정당제재는 inqryDiv=1 + bizno로 조회하고, 제재 기간·기관·사유를 담는다", async () => {
    const r = await lookupPpsCompany("1000000007", TODAY);
    if (r.status !== "found") throw new Error("실패");
    expect(r.company.sanctions).toHaveLength(1);
    expect(r.company.sanctions![0]).toMatchObject({
      institution: "가상시 가상구",
      reason: "계약 이행을 하지 않은 자(가상)",
      law: "지방계약법-부정당제재근거법령",
    });
    const url = fetchMock.mock.calls.map((c) => new URL(c[0] as string)).find((u) => u.pathname.endsWith("getUnptRsttCorpInfo02"))!;
    expect(url.searchParams.get("inqryDiv")).toBe("1");
    expect(url.searchParams.get("bizno")).toBe("1000000007");
  });

  it("부정당제재 호출만 실패하면 제재를 확인 불가(null)로 두고 found — '제재 없음'으로 단정하지 않는다", async () => {
    const r = await lookupPpsCompany("1000000008", TODAY);
    if (r.status !== "found") throw new Error("실패");
    expect(r.company.sanctions).toBeNull();
    expect(r.company.industries).not.toBeNull();
  });

  it("기본정보는 inqryDiv=3 + bizno, 업종정보는 inqryDiv=1 + bizno + 기간으로 부른다", async () => {
    await lookupPpsCompany("1000000001", TODAY);
    const urls = fetchMock.mock.calls.map((c) => new URL(c[0] as string));
    const basic = urls.find((u) => u.pathname.endsWith("getPrcrmntCorpBasicInfo02"))!;
    expect(basic.searchParams.get("inqryDiv")).toBe("3");
    expect(basic.searchParams.get("bizno")).toBe("1000000001");
    const industry = urls.find((u) => u.pathname.endsWith("getPrcrmntCorpIndstrytyInfo02"))!;
    expect(industry.searchParams.get("inqryDiv")).toBe("1");
    expect(industry.searchParams.get("inqryBgnDt")).toMatch(/^\d{12}$/);
    expect(industry.searchParams.get("inqryEndDt")).toMatch(/^\d{12}$/);
  });

  it("없는 번호는 notFound", async () => {
    expect(await lookupPpsCompany("1999999999", TODAY)).toEqual({ status: "notFound" });
  });

  it("기본정보 호출이 실패하면 error (없는 업체로 착각하지 않는다)", async () => {
    expect(await lookupPpsCompany("1000000006", TODAY)).toEqual({ status: "error" });
  });

  it("업종 호출만 실패하면 업종을 확인 불가(null)로 두고 found", async () => {
    const r = await lookupPpsCompany("1000000005", TODAY);
    expect(r.status).toBe("found");
    if (r.status === "found") expect(r.company.industries).toBeNull();
  });

  it("업종이 없으면 [] (확인 불가 null과 구분)", async () => {
    const r = await lookupPpsCompany("1000000004", TODAY);
    if (r.status !== "found") throw new Error("실패");
    expect(r.company.industries).toEqual([]);
  });

  it("키가 없으면 error이고 조달청을 부르지 않는다", async () => {
    vi.stubEnv("NARAMARKET_API_KEY", "");
    expect(await lookupPpsCompany("1000000001", TODAY)).toEqual({ status: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("네트워크 오류·시간 초과는 error", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await lookupPpsCompany("1000000001", TODAY)).toEqual({ status: "error" });
  });

  it("조달청이 조회 조건을 무시하고 다른 업체를 돌려줘도 번호가 다르면 걸러낸다", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("getPrcrmntCorpBasicInfo02")) {
        return new Response(
          JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: [{ bizno: "9999999999", corpNm: "다른회사" }] } } }),
        );
      }
      return mockPpsResponse(url)!;
    });
    expect(await lookupPpsCompany("1000000001", TODAY)).toEqual({ status: "notFound" });
  });

  it("개인정보(대표자·전화·상세주소)는 결과에 담지 않는다", async () => {
    const r = await lookupPpsCompany("1000000001", TODAY);
    const text = JSON.stringify(r);
    expect(text).not.toContain("홍길동");
    expect(text).not.toContain("010-0000-0000");
    expect(text).not.toContain("비밀 상세주소");
    expect(text).not.toContain("어딘가");
  });

  it("같은 번호를 다시 조회하면 조달청을 다시 부르지 않는다 (실패·일부 실패는 저장하지 않는다)", async () => {
    await lookupPpsCompany("1000000001", TODAY);
    const first = fetchMock.mock.calls.length;
    await lookupPpsCompany("1000000001", TODAY);
    expect(fetchMock.mock.calls.length).toBe(first);

    await lookupPpsCompany("1000000005", TODAY); // 업종 일부 실패
    const afterPartial = fetchMock.mock.calls.length;
    await lookupPpsCompany("1000000005", TODAY);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterPartial);
  });

  it("로그에 키가 남지 않는다", async () => {
    await lookupPpsCompany("1000000006", TODAY);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("test-pps-key-not-real");
  });
});

describe("값 정리", () => {
  it("주소는 시군구까지만", () => {
    expect(toSigungu("서울특별시 중랑구 면목동")).toBe("서울특별시 중랑구");
    expect(toSigungu("경기도 수원시 영통구 매탄동")).toBe("경기도 수원시");
    expect(toSigungu("세종특별자치시 한솔동")).toBe("세종특별자치시");
    expect(toSigungu("")).toBeNull();
    expect(toSigungu(null)).toBeNull();
  });

  it("업종: 만료일이 비었거나 2099년이면 만료일 없음(null)", () => {
    const base = { indstrytyNm: "전기공사업", rgstDt: "2020-01-02 00:00:00", indstrytyStatsNm: "정상", rprsntIndstrytyYn: "Y" };
    expect(toIndustry({ ...base, vldPrdExprtDt: "" })?.expiresAt).toBeNull();
    expect(toIndustry({ ...base, vldPrdExprtDt: "2099-12-31 00:00:00" })?.expiresAt).toBeNull();
    expect(toIndustry({ ...base, vldPrdExprtDt: "2027-03-01 00:00:00" })?.expiresAt).toBe("2027-03-01");
    expect(toIndustry({ ...base, vldPrdExprtDt: "" })?.representative).toBe(true);
  });

  it("업종명이 없으면 버린다", () => {
    expect(toIndustry({ indstrytyNm: "  " })).toBeNull();
  });

  it("제어문자·줄바꿈은 공백으로 바꾸고 길이를 제한한다", () => {
    const i = toIndustry({ indstrytyNm: "앞\n뒤" + "가".repeat(300) });
    expect(i?.name.includes("\n")).toBe(false);
    expect(i!.name.length).toBeLessThanOrEqual(100);
  });

  it("시험용 업체는 8곳이다", () => {
    expect(MOCK_COMPANIES).toHaveLength(8);
  });
});
