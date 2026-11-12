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
  clearReasonCache,
  generateReason,
} from "../lib/reason";
import { todayString } from "../lib/data/dates";
import { getCompanyDetail } from "../lib/detail";
import { clearPpsCache } from "../lib/pps";
import { mockPpsResponse } from "./helpers/pps-mock";

const TODAY = todayString();

/** OpenAI 응답 모양을 흉내 낸다 */
const okResponse = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearReasonCache();
  clearPpsCache();
  fetchMock = vi.fn(); // OpenAI 호출만 센다 (조달청 호출은 아래에서 따로 가짜 응답)
  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
    const pps = mockPpsResponse(String(url));
    return pps ? Promise.resolve(pps) : fetchMock(url, init);
  });
  vi.stubEnv("NARAMARKET_API_KEY", "test-pps-key-not-real");
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("generateReason — 성공", () => {
  it("부적격 업체는 AI가 정리한 문장을 돌려준다", async () => {
    fetchMock.mockResolvedValue(okResponse("조달청 등록 유효기간이 모두 지나 계약 대상으로 보기 어렵습니다. 최종 결정은 담당자가 합니다."));
    const r = await generateReason("1000000002", TODAY);
    expect(r).toMatchObject({ ok: true, source: "ai" });
    if (r.ok) expect(r.text).toContain("유효기간");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AI에는 서버가 계산한 판정과 사유만 간다 — 사업자번호·원본 레코드는 안 간다", async () => {
    fetchMock.mockResolvedValue(okResponse("정리된 문장입니다."));
    await generateReason("1000000002", TODAY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const sent = JSON.parse(init.body);
    const userText = sent.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userText).toContain("유효기간이 모두 지났습니다");
    expect(userText).toContain("부적격");
    expect(userText).not.toContain("100-00-00002");
    expect(userText).not.toContain("1000000002");
    // 키는 헤더로만 간다 (본문·사용자 메시지에는 없다)
    expect(init.headers.Authorization).toBe("Bearer test-key-not-real");
    expect(init.body).not.toContain("test-key-not-real");
  });

  it("적격이면 AI를 부르지 않고 고정 문장을 쓴다", async () => {
    const r = await generateReason("1000000001", TODAY);
    expect(r).toEqual({ ok: true, text: NO_ISSUE_TEXT, source: "fixed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OPENAI_MODEL로 모델을 바꿀 수 있다", async () => {
    vi.stubEnv("OPENAI_MODEL", "my-test-model");
    fetchMock.mockResolvedValue(okResponse("문장입니다."));
    await generateReason("1000000002", TODAY);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("my-test-model");
  });
});

describe("generateReason — 결과 재사용 (비용 남용 방지)", () => {
  it("같은 업체·면허·날짜는 두 번째부터 OpenAI를 부르지 않는다", async () => {
    fetchMock.mockResolvedValue(okResponse("정리된 문장입니다."));
    const a = await generateReason("1000000002", TODAY);
    const b = await generateReason("1000000002", TODAY);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("업체가 다르면 새로 부른다", async () => {
    fetchMock.mockResolvedValue(okResponse("정리된 문장입니다."));
    await generateReason("1000000002", TODAY);
    await generateReason("1000000003", TODAY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("실패한 결과는 저장하지 않아 다시 시도할 수 있다", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await generateReason("1000000002", TODAY)).ok).toBe(false);
    fetchMock.mockResolvedValueOnce(okResponse("두 번째는 성공입니다."));
    expect(await generateReason("1000000002", TODAY)).toMatchObject({ ok: true, text: "두 번째는 성공입니다." });
  });
});

describe("generateReason — 실패하면 정해진 오류 (PRD)", () => {
  const failed = { ok: false, status: 502, code: "AI_FAILED", message: AI_FAILED_MESSAGE };

  it("키가 없으면 실패", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await generateReason("1000000002", TODAY)).toEqual(failed);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AI가 오류 코드를 돌려주면 실패 (401·429·500)", async () => {
    for (const status of [401, 429, 500]) {
      fetchMock.mockResolvedValue(new Response("{}", { status }));
      expect(await generateReason("1000000002", TODAY)).toEqual(failed);
    }
  });
  it("네트워크 오류·시간 초과는 실패", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await generateReason("1000000002", TODAY)).toEqual(failed);
  });
  it("호출에 10초 제한이 걸려 있다", async () => {
    fetchMock.mockResolvedValue(okResponse("문장입니다."));
    await generateReason("1000000002", TODAY);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("응답이 비었거나 형식이 이상하면 실패", async () => {
    for (const content of ["", "   ", null, 123]) {
      fetchMock.mockResolvedValue(okResponse(content));
      expect(await generateReason("1000000002", TODAY)).toEqual(failed);
    }
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    expect(await generateReason("1000000002", TODAY)).toEqual(failed);
  });
  it("오류 메시지와 로그에 키가 새지 않는다", async () => {
    fetchMock.mockRejectedValue(new Error("fail with test-key-not-real inside"));
    const r = await generateReason("1000000002", TODAY);
    expect(JSON.stringify(r)).not.toContain("test-key-not-real");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("test-key-not-real");
  });
});

describe("generateReason — 요청 검사", () => {
  it("없는 업체는 404, AI를 부르지 않는다", async () => {
    expect(await generateReason("zzz", TODAY)).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
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
  it("검토 필요 업체의 사유와 업체명이 담긴다", async () => {
    const d = await getCompanyDetail("1000000003", TODAY);
    if (!d.ok) throw new Error("실패");
    const msg = JSON.parse(buildUserMessage(d.company, d.judgment));
    expect(msg.판정).toBe("검토 필요");
    expect(msg.검토_필요_사유.join(" ")).toContain("만료됩니다");
    expect(msg.업체명).toBe("다온빌딩서비스(가상)");
  });
  it("사업자등록번호는 보내지 않는다", async () => {
    const d = await getCompanyDetail("1000000002", TODAY);
    if (!d.ok) throw new Error("실패");
    expect(buildUserMessage(d.company, d.judgment)).not.toMatch(/d{3}-d{2}-d{5}/);
    expect(buildUserMessage(d.company, d.judgment)).not.toContain("1000000002");
  });
  it("외부(조달청) 데이터인 업체명은 40자까지만 보낸다", async () => {
    const d = await getCompanyDetail("1000000003", TODAY);
    if (!d.ok) throw new Error("실패");
    const long = { ...d.company, basic: { ...d.company.basic, companyName: { kind: "value" as const, value: "가".repeat(100), source: { source: "PPS" as const, label: "조달청", baseDate: TODAY } } } };
    expect(JSON.parse(buildUserMessage(long, d.judgment)).업체명).toHaveLength(40);
  });
});

describe("호출 횟수 제한 — 강화", () => {
  it("접속자 키를 대량으로 만들어도 저장 개수에 상한이 있고 새 접속자는 계속 허용된다", () => {
    const rl = createRateLimiter(1, 60_000);
    for (let i = 0; i < 20_000; i++) expect(rl.allow(`ip-${i}`, 1000)).toBe(true);
  });
  it("하루 상한을 넘으면 OpenAI를 부르지 않고 실패로 처리한다", async () => {
    fetchMock.mockResolvedValue(okResponse("문장입니다."));
    const { aiDailyLimiter, GLOBAL_KEY } = await import("../lib/rateLimit");
    // 남은 한도를 모두 소진시킨다 (이 파일의 마지막 AI 시험이어야 한다 — 이후에는 한도가 비어 있다)
    while (aiDailyLimiter.allow(GLOBAL_KEY));
    fetchMock.mockClear();
    const r = await generateReason("1000000002", TODAY);
    expect(r).toMatchObject({ ok: false, status: 502, code: "AI_FAILED", message: AI_FAILED_MESSAGE });
    expect(fetchMock).not.toHaveBeenCalled();
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
