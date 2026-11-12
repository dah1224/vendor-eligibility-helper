// Design Ref: §12.1 T1 — 사업자등록번호 정리·검사
import { describe, expect, it } from "vitest";
import {
  BIZ_NO_FORMAT_ERROR,
  formatBizNo,
  looksLikeBizNo,
  normalizeBizNo,
  parseSearchQuery,
} from "../lib/bizNo";

describe("normalizeBizNo", () => {
  it("하이픈이 있든 없든 같은 10자리로 인식한다", () => {
    expect(normalizeBizNo("000-00-00001")).toBe("0000000001");
    expect(normalizeBizNo("0000000001")).toBe("0000000001");
    expect(normalizeBizNo(" 000-00-00001 ")).toBe("0000000001");
  });

  it("10자리가 아니면 null", () => {
    expect(normalizeBizNo("000-00-0001")).toBeNull(); // 9자리
    expect(normalizeBizNo("00000000011")).toBeNull(); // 11자리
    expect(normalizeBizNo("12-34")).toBeNull();
  });

  it("숫자·하이픈 외 문자가 섞이면 null", () => {
    expect(normalizeBizNo("000-00-0000A")).toBeNull();
    expect(normalizeBizNo("가람")).toBeNull();
    expect(normalizeBizNo("")).toBeNull();
  });
});

describe("looksLikeBizNo / parseSearchQuery", () => {
  it("숫자·하이픈만 있으면 번호로 본다", () => {
    expect(looksLikeBizNo("000-00-00001")).toBe(true);
    expect(looksLikeBizNo("12-34")).toBe(true);
    expect(looksLikeBizNo("가람")).toBe(false);
    expect(looksLikeBizNo("---")).toBe(false);
  });

  it("번호는 번호 검색, 틀린 번호는 형식 오류, 그 밖은 업체명", () => {
    expect(parseSearchQuery("000-00-00001")).toEqual({ kind: "bizNo", bizNo: "0000000001" });
    expect(parseSearchQuery("12-34")).toEqual({ kind: "invalidBizNo", message: BIZ_NO_FORMAT_ERROR });
    expect(parseSearchQuery(" 가람 ")).toEqual({ kind: "name", name: "가람" });
    expect(parseSearchQuery("   ")).toEqual({ kind: "empty" });
  });
});

describe("formatBizNo", () => {
  it("000-00-00001 형태로 표시한다", () => {
    expect(formatBizNo("0000000001")).toBe("000-00-00001");
    expect(formatBizNo("123")).toBe("123");
  });
});
