// Design Ref: §3 ⑤ 적격 판단 결과 / §3.2 VerdictPanel — 3단계 판정 배지 + 해당 조건 목록 + 판정 기준일 + "최종 결정은 담당자가 합니다"
// PRD: 판정은 코드(서버)가 한다. 이 화면은 서버가 준 결과를 그대로 보여줄 뿐 판정을 바꾸거나 채우지 않는다.
//      결과는 적격 / 부적격 / 검토 필요 3단계만, 부적격·검토 필요일 때는 사유를 1줄 이상 보여준다.
import { Disclaimer } from "@/components/Disclaimer";
import type { Judgment, Verdict } from "@/lib/types";

/** AI가 정리한 사유 문장 상태 (조회 정보·판정과 따로 움직인다 — AI가 실패해도 판정은 그대로 남는다) */
export type ReasonState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; text: string }
  | { phase: "error"; message: string };

export type VerdictPanelState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "done"; judgment: Judgment };

/** 색만으로 구분하지 않도록 글자와 기호를 함께 쓴다 */
const BADGE: Record<Verdict, { symbol: string; className: string }> = {
  적격: {
    symbol: "✓",
    className: "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
  },
  부적격: {
    symbol: "✕",
    className: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
  },
  "검토 필요": {
    symbol: "!",
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  },
};

interface VerdictPanelProps {
  state: VerdictPanelState;
  reason: ReasonState;
  /** AI 사유 문장을 다시 만들어 달라고 요청한다 */
  onRetryReason: () => void;
}

export function VerdictPanel({ state, reason, onRetryReason }: VerdictPanelProps) {
  return (
    <aside
      aria-label="적격 판단 결과"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 lg:sticky lg:top-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold">적격 판단 결과</h2>

      {state.phase === "idle" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          업체를 조회하면 적격 / 부적격 / 검토 필요 결과와 해당 사유가 이곳에 표시됩니다.
        </p>
      )}
      {state.phase === "loading" && (
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
          판정하는 중입니다…
        </p>
      )}
      {state.phase === "error" && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          판정 결과를 표시할 수 없습니다. 조회를 다시 시도해 주세요.
        </p>
      )}
      {state.phase === "done" && (
        <VerdictResult judgment={state.judgment} reason={reason} onRetryReason={onRetryReason} />
      )}

      <div className="mt-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Disclaimer variant="inline" />
      </div>
    </aside>
  );
}

function VerdictResult({
  judgment,
  reason,
  onRetryReason,
}: {
  judgment: Judgment;
  reason: ReasonState;
  onRetryReason: () => void;
}) {
  const badge = BADGE[judgment.verdict];
  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        aria-label={`판정 결과: ${judgment.verdict}`}
        className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-lg font-bold ${badge.className}`}
      >
        <span aria-hidden="true">{badge.symbol}</span>
        {judgment.verdict}
      </div>

      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">판정 기준일</dt>
        <dd className="tabular-nums">{judgment.evaluatedAt}</dd>
      </dl>

      {judgment.disqualifiers.length > 0 && (
        <ReasonList title="부적격 사유" items={judgment.disqualifiers} tone="red" />
      )}
      {judgment.reviewItems.length > 0 && (
        <ReasonList title="검토 필요 사유" items={judgment.reviewItems} tone="amber" />
      )}
      {judgment.verdict === "적격" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          부적격 또는 검토 필요에 해당하는 조건이 없습니다.
        </p>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        조달청에서 받은 정보만으로 판정한 결과입니다. 면허·영업 상태·행정처분은 확인하지 않았습니다.
      </p>

      {/* 판단 사유(AI 정리): 부적격·검토 필요일 때만. 실패해도 위의 판정 배지와 사유 목록은 그대로다. */}
      {judgment.verdict !== "적격" && <AiReason reason={reason} onRetry={onRetryReason} />}
    </div>
  );
}

function ReasonList({ title, items, tone }: { title: string; items: string[]; tone: "red" | "amber" }) {
  const dot = tone === "red" ? "marker:text-red-600" : "marker:text-amber-600";
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <ul className={`list-disc space-y-1 pl-5 text-sm ${dot}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** AI가 정리한 판단 사유 문장. 실패하면 정해진 문구와 [다시 시도]만 보여주고 판정은 건드리지 않는다. (PRD must 2) */
function AiReason({ reason, onRetry }: { reason: ReasonState; onRetry: () => void }) {
  return (
    <section aria-label="판단 사유" className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
      <h3 className="mb-1 text-sm font-semibold">판단 사유</h3>
      {reason.phase === "loading" && (
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
          판단 사유를 정리하는 중입니다…
        </p>
      )}
      {reason.phase === "done" && (
        <>
          <p className="text-sm leading-relaxed">{reason.text}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            AI가 위 사유를 문장으로 정리한 것이며, 판정은 위의 결과를 기준으로 합니다.
          </p>
        </>
      )}
      {reason.phase === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {reason.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="h-8 rounded-md border border-zinc-400 px-3 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-700"
          >
            다시 시도
          </button>
        </div>
      )}
    </section>
  );
}
