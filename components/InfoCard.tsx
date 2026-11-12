// Design Ref: §3.2 InfoCard — 조회 항목 카드 1개 (제목 + 내용)
// 주소지·계약 실적·신용·재무는 값을 판정에 쓰지 않으므로 제목 옆에 작게 밝힌다 (PRD, Design §3.1).
import type { ReactNode } from "react";

interface InfoCardProps {
  /** 예: "1. 업체 기본정보" */
  title: string;
  /** true면 "값은 판정에 쓰지 않음" 표시 */
  notUsedForJudgment?: boolean;
  children: ReactNode;
}

export function InfoCard({ title, notUsedForJudgment = false, children }: InfoCardProps) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-[12pt] font-semibold">
        {title}
        {notUsedForJudgment && (
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            값은 판정에 쓰지 않음 (확인 불가·불일치는 검토 필요에 반영)
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

/** 카드 안의 "이름: 값" 한 줄 */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-3 py-1.5 text-sm">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
