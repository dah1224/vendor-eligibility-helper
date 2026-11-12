// Design Ref: §3.2 Disclaimer — "최종 결정은 담당자가 합니다" 문구 (머리글·판정 패널 2곳에서 쓴다)
// PRD: 이 문구는 화면에 항상 표시한다. (검색 전·후, 오류 상태 모두)

/** PRD에 정해진 문구 — 글자 하나도 바꾸지 않는다 */
export const FINAL_DECISION_NOTICE = "최종 결정은 담당자가 합니다";

interface DisclaimerProps {
  /** 자리에 맞춘 모양: 머리글 띠 / 판정 패널 안의 한 줄 */
  variant?: "banner" | "inline";
}

export function Disclaimer({ variant = "banner" }: DisclaimerProps) {
  if (variant === "inline") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
        <span aria-hidden="true">⚠</span>
        {FINAL_DECISION_NOTICE}
      </p>
    );
  }
  return (
    <div
      role="note"
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <span aria-hidden="true">⚠</span>
      {FINAL_DECISION_NOTICE}
    </div>
  );
}
