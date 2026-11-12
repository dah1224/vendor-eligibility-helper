// Design Ref: §12.2 A5~A6 — 상세 조회 + 판정 (API가 쓰는 getCompanyDetail, 조달청 정보 기준)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanyDetail } from "../lib/detail";
import { clearPpsCache } from "../lib/pps";
import { TODAY, mockPpsResponse } from "./helpers/pps-mock";

beforeEach(() => {
  clearPpsCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => mockPpsResponse(url) ?? new Response("{}", { status: 404 })));
  vi.stubEnv("NARAMARKET_API_KEY", "test-pps-key-not-real");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getCompanyDetail", () => {
  it("모든 업종 유효기간이 지난 업체는 부적격 판정과 사유를 돌려준다", async () => {
    const r = await getCompanyDetail("1000000002", TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.judgment.verdict).toBe("부적격");
    expect(r.judgment.disqualifiers[0]).toContain("유효기간이 모두 지났습니다");
    expect(r.judgment.evaluatedAt).toBe(TODAY);
  });

  it("하이픈이 있는 번호도 같은 업체를 찾는다", async () => {
    const r = await getCompanyDetail("100-00-00001", TODAY);
    expect(r.ok).toBe(true);
  });

  it("조회 항목(기본정보·주소지·조달청 업체등록)이 들어 있고 출처는 조달청이다", async () => {
    const r = await getCompanyDetail("1000000001", TODAY);
    if (!r.ok) throw new Error("실패");
    const v = r.company;
    expect(v.bizNo).toBe("100-00-00001");
    expect(v.basic.companyName).toMatchObject({ kind: "value", value: "가람시설관리(가상)" });
    expect(v.address).toMatchObject({ kind: "value", value: "서울특별시 강남구" });
    expect(v.procurement.kind).toBe("value");
    if (v.procurement.kind === "value") {
      expect(v.procurement.value.industries).toHaveLength(2);
      expect(v.procurement.source).toEqual({ source: "PPS", label: "조달청", baseDate: TODAY });
    }
  });

  it("부정당제재 업체는 부적격이고 화면용 제재 정보가 나온다", async () => {
    const r = await getCompanyDetail("1000000007", TODAY);
    if (!r.ok) throw new Error("실패");
    expect(r.judgment.verdict).toBe("부적격");
    expect(r.judgment.disqualifiers[0]).toContain("부정당제재");
    expect(r.company.sanctions.kind).toBe("value");
    if (r.company.sanctions.kind === "value") expect(r.company.sanctions.value.sanctions).toHaveLength(1);
  });

  it("기본정보에 업체업무구분과 개업일이 들어간다", async () => {
    const r = await getCompanyDetail("1000000001", TODAY);
    if (!r.ok) throw new Error("실패");
    expect(r.company.basic.bizDivision).toMatchObject({ kind: "value", value: "공사" });
    expect(r.company.basic.openedAt).toMatchObject({ kind: "value", value: "2015-03-02" });
  });

  it("제재 조회만 실패하면 '확인 불가'로 나오고 검토 필요", async () => {
    const r = await getCompanyDetail("1000000008", TODAY);
    if (!r.ok) throw new Error("실패");
    expect(r.company.sanctions.kind).toBe("unknown");
    expect(r.judgment.verdict).toBe("검토 필요");
  });

  it("업종 조회만 실패하면 '확인 불가'로 나오고 검토 필요", async () => {
    const r = await getCompanyDetail("1000000005", TODAY);
    if (!r.ok) throw new Error("실패");
    expect(r.company.procurement.kind).toBe("unknown");
    expect(r.judgment.verdict).toBe("검토 필요");
  });

  it("조달청에 없는 업체는 404 + PRD 안내 문구", async () => {
    expect(await getCompanyDetail("1999999999", TODAY)).toEqual({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "일치하는 업체가 없습니다. 사업자등록번호를 확인해 주세요.",
    });
  });

  it("번호 모양이 아니면 조달청을 부르지 않고 404", async () => {
    const fetchSpy = vi.mocked(fetch);
    const r = await getCompanyDetail("c01", TODAY);
    expect(r).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("조달청 조회가 실패하면 502 (없는 업체와 구분)", async () => {
    expect(await getCompanyDetail("1000000006", TODAY)).toMatchObject({ ok: false, status: 502, code: "PPS_FAILED" });
  });

  it("응답에 원본 레코드나 개인정보성 값이 새지 않는다", async () => {
    const r = await getCompanyDetail("1000000001", TODAY);
    if (!r.ok) throw new Error("실패");
    const text = JSON.stringify(r);
    for (const leaked of ["홍길동", "010-0000-0000", "비밀 상세주소", "ceoNm", "telNo", "dtlAdrs"]) {
      expect(text).not.toContain(leaked);
    }
  });
});
