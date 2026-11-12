// Design Ref: §7.3, §12.2 A7 — AI 사유 문장: 판정은 코드가 하고 AI는 문장만 정리한다. 실패하면 정해진 오류를 낸다.
// 실제 OpenAI는 부르지 않고 fetch를 가짜로 바꿔서 시험한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FAILED_MESSAGE } from "../lib/messages";
import { createRateLimiter } from "../lib/rateLimit";
import {
  MAX_REASON_LENGTH,
  NO_ISSUE_TEXT,
  buildUserMessage,
  checkAiText,
  generateReason,
} from "../lib/reason";
import { COMPANIES } from "../lib/data/companies";
import { todayString } from "../lib/data/dates";
import { getCompanyDetail } from "../lib/detail";

const L = "시설물유지관리업";
const TODAY = todayString();

/** OpenAI 응답 모양을 흉내 낸다 */
const okResponse = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("generateReason — 성공", () => {
  it("부적격 업체(c06)는 AI가 정리한 문장을 돌려준다", async () => {
    fetchMock.mockResolvedValue(okResponse("폐업한 업체라 계약 대상으로 보기 어렵습니다. 최종 결정은 담당자가 합니다."));
    const r = await generateReason("c06", L, TODAY);
    expect(r).toMatchObject({ ok: true, source: "ai" });
    if (r.ok) expect(r.text).toContain("폐업");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AI에는 서버가 계산한 판정과 사유만 간다 — 사업자번호·원본 레코드는 안 간다", async () => {
    fetchMock.mockResolvedValue(okResponse("정리된 문장입니다."));
    await generateReason("c06", L, TODAY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const sent = JSON.parse(init.body);
    const userText = sent.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userText).toContain("폐업한 업체입니다.");
    expect(userText).toContain("부적격");
    expect(userText).not.toContain("000-00-00006");
    expect(userText).not.toContain("0000000006");
    expect(userText).not.toContain("kiscon");
    // 키는 헤더로만 간다 (본문·사용자 메시지에는 없다)
    expect(init.headers.Authorization).toBe("Bearer test-key-not-real");
    expect(init.body).not.toContain("test-key-not-real");
  });

  it("적격이면 AI를 부르지 않고 고정 문장을 쓴다", async () => {
    const r = await generateReason("c01", L, TODAY);
    expect(r).toEqual({ ok: true, text: NO_ISSUE_TEXT, source: "fixed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OPENAI_MODEL로 모델을 바꿀 수 있다", async () => {
    vi.stubEnv("OPENAI_MODEL", "my-test-model");
    fetchMock.mockResolvedValue(okResponse("문장입니다."));
    await generateReason("c06", L, TODAY);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("my-test-model");
  });
});

describe("generateReason — 실패하면 정해진 오류 (PRD)", () => {
  const failed = { ok: false, status: 502, code: "AI_FAILED", message: AI_FAILED_MESSAGE };

  it("키가 없으면 실패", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await generateReason("c06", L, TODAY)).toEqual(failed);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AI가 오류 코드를 돌려주면 실패 (401·429·500)", async () => {
    for (const status of [401, 429, 500]) {
      fetchMock.mockResolvedValue(new Response("{}", { status }));
      expect(await generateReason("c06", L, TODAY)).toEqual(failed);
    }
  });
  it("네트워크 오류·시간 초과는 실패", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await generateReason("c06", L, TODAY)).toEqual(failed);
  });
  it("호출에 10초 제한이 걸려 있다", async () => {
    fetchMock.mockResolvedValue(okResponse("문장입니다."));
    await generateReason("c06", L, TODAY);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("응답이 비었거나 형식이 이상하면 실패", async () => {
    for (const content of ["", "   ", null, 123]) {
      fetchMock.mockResolvedValue(okResponse(content));
      expect(await generateReason("c06", L, TODAY)).toEqual(failed);
    }
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    expect(await generateReason("c06", L, TODAY)).toEqual(failed);
  });
  it("오류 메시지와 로그에 키가 새지 않는다", async () => {
    fetchMock.mockRejectedValue(new Error("fail with test-key-not-real inside"));
    const r = await generateReason("c06", L, TODAY);
    expect(JSON.stringify(r)).not.toContain("test-key-not-real");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("test-key-not-real");
  });
});

describe("generateReason — 요청 검사", () => {
  it("면허가 없거나 목록에 없으면 400, AI를 부르지 않는다", async () => {
    for (const license of [null, "", "없는면허"]) {
      expect(await generateReason("c06", license, TODAY)).toMatchObject({ ok: false, status: 400, code: "INVALID_LICENSE" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("없는 업체는 404, AI를 부르지 않는다", async () => {
    expect(await generateReason("zzz", L, TODAY)).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("checkAiText — 응답 점검", () => {
  it("부적격·검토 필요인데 적격이라고 말하면 거부한다", () => {
    expect(checkAiText("이 업체는 적격입니다.", "부적격")).toBeNull();
    expect(checkAiText("적격으로 판단됩니다.", "검토 필요")).toBeNull();
  });
  it("'부적격'이라는 말은 허용한다", () => {
    expect(checkAiText("부적격 사유가 있습니다.", "부적격")).toBe("부적격 사유가 있습니다.");
  });
  it("400자를 넘으면 한도 안의 마지막 문장까지만 쓴다", () => {
    const sentence = "문장을 하나 씁니다. ";
    const text = checkAiText(sentence.repeat(60), "검토 필요");
    expect(text).not.toBeNull();
    expect(text!.length).toBeLessThanOrEqual(MAX_REASON_LENGTH);
    expect(text!.endsWith(".")).toBe(true);
  });
  it("줄바꿈·공백을 정리한다", () => {
    expect(checkAiText("  첫 문장.\n\n  둘째 문장.  ", "검토 필요")).toBe("첫 문장. 둘째 문장.");
  });
});

describe("buildUserMessage", () => {
  it("c10(출처 불일치)의 사유가 두 값과 함께 담긴다", () => {
    const d = getCompanyDetail("c10", L, TODAY);
    if (!d.ok) throw new Error("실패");
    const msg = JSON.parse(buildUserMessage(d.company, d.judgment));
    expect(msg.판정).toBe("검토 필요");
    expect(msg.검토_필요_사유.join(" ")).toContain("서초구");
    expect(msg.업체명).toBe("자연건물관리(가상)");
  });
  it("샘플이 아닌 값은 보내지 않는다 (사업자번호 없음)", () => {
    const d = getCompanyDetail("c06", L, TODAY);
    if (!d.ok) throw new Error("실패");
    expect(buildUserMessage(d.company, d.judgment)).not.toMatch(/\d{3}-\d{2}-\d{5}/);
    expect(COMPANIES.length).toBe(10);
  });
});

describe("호출 횟수 제한 (분당 10회)", () => {
  it("한도까지는 허용하고 넘으면 막는다", () => {
    const rl = createRateLimiter(10, 60_000);
    for (let i = 0; i < 10; i++) expect(rl.allow("a", 1000)).toBe(true);
    expect(rl.allow("a", 1000)).toBe(false);
  });
  it("다른 접속자는 따로 센다", () => {
    const rl = createRateLimiter(1, 60_000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("b", 0)).toBe(true);
    expect(rl.allow("a", 0)).toBe(false);
  });
  it("1분이 지나면 다시 허용한다", () => {
    const rl = createRateLimiter(1, 60_000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("a", 59_999)).toBe(false);
    expect(rl.allow("a", 60_000)).toBe(true);
  });
});
