// Design Ref: §3 화면 구성 — 한 화면(PC 브라우저, 가로 1280px 이상 기준). 위에서 아래로 "고르고 → 찾고 → 보고 → 판단 확인".
// 작업 9: 뼈대. 작업 11: 검색창·조회 버튼, 검색 API 호출. 작업 12: 결과 분기(0건 안내 / 목록에서 선택 / 1곳은 바로 선택).
// 작업 13: 고른 업체의 상세 API를 불러 ④조회 항목 7개를 카드로 표시. 작업 15: ⑤판정 패널에 서버가 정한 판정과 사유를 표시. 작업 16·17: AI가 정리한 사유 문장을 따로 불러오고, 실패해도 조회·판정은 그대로 둔다.
"use client";

import { useRef, useState } from "react";
import { CompanyDetail } from "@/components/CompanyDetail";
import { Disclaimer } from "@/components/Disclaimer";
import { SearchBar } from "@/components/SearchBar";
import { SearchResultList } from "@/components/SearchResultList";
import { VerdictPanel, type ReasonState } from "@/components/VerdictPanel";
import { AI_FAILED_MESSAGE } from "@/lib/messages";
import type { SearchResultItem } from "@/lib/search";
import type { CompanyView, Judgment } from "@/lib/types";

/** 검색 진행 상태 */
type SearchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; query: string; results: SearchResultItem[] }
  | { phase: "error"; message: string };

/** 업체 상세(조회 항목 7개 + 판정) 불러오기 상태 */
type DetailState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; company: CompanyView; judgment: Judgment }
  | { phase: "error"; message: string };

const SERVER_ERROR_MESSAGE = "조회 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.";

export default function Home() {
  const [search, setSearch] = useState<SearchState>({ phase: "idle" });
  const [detail, setDetail] = useState<DetailState>({ phase: "idle" });
  // AI가 정리한 판단 사유 — 조회·판정과 따로 불러오므로 실패해도 위 상태는 그대로다
  const [reason, setReason] = useState<ReasonState>({ phase: "idle" });
  // 조회할 업체로 고른 id (1곳이면 자동, 2곳 이상이면 담당자가 목록에서 선택)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 연달아 조회했을 때 늦게 도착한 옛 응답이 새 결과를 덮어쓰지 않게 번호를 매긴다
  const searchRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const reasonRequestId = useRef(0);

  /** 선택한 업체의 AI 판단 사유 문장을 불러온다. 실패하면 정해진 문구를 보여줄 뿐 조회 정보·판정은 건드리지 않는다. */
  async function loadReason(id: string) {
    const myId = ++reasonRequestId.current;
    setReason({ phase: "loading" });
    try {
      const res = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (myId !== reasonRequestId.current) return;
      if (!res.ok || typeof body?.text !== "string") {
        // 호출이 너무 잦은 경우(429)는 서버가 알려준 문구를, 그 밖의 실패는 PRD의 정해진 문구를 쓴다
        const message = res.status === 429 && body?.error?.message ? body.error.message : AI_FAILED_MESSAGE;
        setReason({ phase: "error", message });
        return;
      }
      setReason({ phase: "done", text: body.text });
    } catch {
      if (myId !== reasonRequestId.current) return;
      setReason({ phase: "error", message: AI_FAILED_MESSAGE });
    }
  }

  /** 선택한 업체의 조회 항목과 판정을 불러온다 */
  async function loadDetail(id: string) {
    const myId = ++detailRequestId.current;
    setSelectedId(id);
    setDetail({ phase: "loading" });
    reasonRequestId.current++; // 이전 업체의 AI 문장이 늦게 도착해도 무시한다
    setReason({ phase: "idle" });
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(id)}`);
      const body = await res.json();
      if (myId !== detailRequestId.current) return;
      if (!res.ok) {
        setDetail({ phase: "error", message: body?.error?.message ?? SERVER_ERROR_MESSAGE });
        return;
      }
      setDetail({ phase: "done", company: body.company, judgment: body.judgment });
      // 적격이면 정리할 사유가 없어 AI를 부르지 않는다. 부적격·검토 필요일 때만 사유 문장을 요청한다.
      if (body.judgment.verdict !== "적격") void loadReason(id);
    } catch {
      if (myId !== detailRequestId.current) return;
      setDetail({ phase: "error", message: SERVER_ERROR_MESSAGE });
    }
  }

  /** 업체 선택·상세 화면을 비운다 (새 검색, 형식 오류 때) */
  function clearSelection() {
    detailRequestId.current++; // 아직 오는 중인 상세 응답은 무시한다
    reasonRequestId.current++;
    setSelectedId(null);
    setDetail({ phase: "idle" });
    setReason({ phase: "idle" });
  }

  async function handleSearch(bizNo: string) {
    const myId = ++searchRequestId.current;
    setSearch({ phase: "loading" });
    clearSelection(); // 새로 조회하면 이전에 고른 업체와 그 상세는 지운다
    try {
      const res = await fetch(`/api/companies?bizNo=${encodeURIComponent(bizNo)}`);
      const body = await res.json();
      if (myId !== searchRequestId.current) return;
      if (!res.ok) {
        // 400(형식 오류 등)은 서버가 알려준 문구를, 그 밖은 일반 오류 문구를 쓴다
        setSearch({ phase: "error", message: body?.error?.message ?? SERVER_ERROR_MESSAGE });
        return;
      }
      const results: SearchResultItem[] = body.results;
      setSearch({ phase: "done", query: bizNo, results });
      // 번호로 찾으므로 결과는 0곳 또는 1곳이다. 1곳이면 바로 그 업체를 조회하고, 0곳이면 안내 문구를 보여준다.
      if (results.length === 1) void loadDetail(results[0].id);
    } catch {
      if (myId !== searchRequestId.current) return;
      setSearch({ phase: "error", message: SERVER_ERROR_MESSAGE });
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ① 머리글 */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold tracking-tight">수의계약 적격업체 평가 도우미</h1>
            <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
              대외비 · 조달청 조회
            </span>
          </div>
          <Disclaimer variant="banner" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        {/* ② 검색 영역: 사업자등록번호 입력 + 조회 버튼 */}
        <section aria-label="검색" className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start gap-6">
            <SearchBar
              loading={search.phase === "loading"}
              onSearch={handleSearch}
              onInvalid={() => {
                searchRequestId.current++; // 아직 오는 중인 검색 응답이 있어도 무시한다
                setSearch({ phase: "idle" });
                clearSelection();
              }}
            />
          </div>
        </section>

        {/* ③ 검색 결과 안내: 0건 안내 / 2곳 이상 후보 목록 (상황에 따라 하나만 표시, 1곳이면 목록 없이 바로 조회) */}
        {search.phase === "done" && search.results.length !== 1 && (
          <SearchResultList results={search.results} selectedId={selectedId} onSelect={(id) => void loadDetail(id)} />
        )}
        {search.phase === "error" && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {search.message}
          </p>
        )}

        {/* ④ 조회 항목 7개(왼쪽) + ⑤ 적격 판단 결과(오른쪽) */}
        <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-label="조회 항목" className="flex flex-col gap-3">
            {detail.phase === "done" ? (
              <CompanyDetail
                view={detail.company}
                evaluatedAt={detail.judgment.evaluatedAt}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="mb-1 text-base font-semibold">조회 항목</h2>
                {detail.phase === "loading" ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
                    조회 항목을 불러오는 중입니다…
                  </p>
                ) : detail.phase === "error" ? (
                  <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
                    {detail.message}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    사업자등록번호로 조회하면 조달청에서 가져온 기본정보와 조달청 업체등록 정보가 이곳에 표시됩니다.
                  </p>
                )}
              </div>
            )}
          </section>

          <VerdictPanel
            reason={reason}
            onRetryReason={() => {
              if (selectedId) void loadReason(selectedId);
            }}
            state={
              detail.phase === "done"
                ? { phase: "done", judgment: detail.judgment }
                : { phase: detail.phase }
            }
          />
        </div>
      </main>

      {/* ⑥ 바닥글 */}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mx-auto w-full max-w-6xl px-6 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          조달청 나라장터에서 가져온 정보이며, 조달청에서 제공하지 않는 항목(면허·영업 상태·행정처분·계약 실적·신용·재무)은 표시하지 않습니다.
        </p>
      </footer>
    </div>
  );
}
