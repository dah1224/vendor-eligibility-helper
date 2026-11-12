// Design Ref: §3.1, §3.2 SourceValue — 항목 값 1개를 보여준다. (출처·기준일은 화면 맨 아래 SourceSummary에 모아 보여준다)
//   · 값이 있음 → 값
//   · 확인 불가 → 회색 "확인 불가" 배지 (빈칸·"-"·0으로 대신하지 않는다 — PRD)
// 출처는 조달청 하나뿐이라 "출처 불일치" 표시는 없다.
import type { ReactNode } from "react";
import type { FieldValue, SourceMeta, SourceName } from "@/lib/types";

/** 출처 이름 표시 */
const SOURCE_SHORT_NAME: Record<SourceName, string> = { PPS: "조달청" };

/** 값이 없을 때 보여주는 배지 */
export function UnknownBadge() {
  return (
    <span className="inline-block rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
      확인 불가
    </span>
  );
}

interface SourceValueProps<T> {
  field: FieldValue<T>;
  /** 값 1개를 화면 조각으로 바꾸는 방법 */
  children: (value: T) => ReactNode;
}

export function SourceValue<T>({ field, children }: SourceValueProps<T>) {
  if (field.kind === "unknown") return <UnknownBadge />;
  return <div>{children(field.value)}</div>;
}

// ───────────── 화면 맨 아래에 모아 보여주는 출처 요약 ─────────────

/** 출처 요약에 올릴 항목 하나: 항목 이름 + 그 항목의 값(출처를 꺼내는 용도) */
export interface SourceItem {
  label: string;
  field: FieldValue<unknown>;
}

/** 출처 요약의 한 줄: 굵은 제목 + 내용 */
function Line({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{title}</span> {children}
    </p>
  );
}

/**
 * 전체 항목의 출처를 "출처: 조달청 · 기준일 2026-11-12" 한 줄로 요약한다.
 * 아래 줄들에는 판정에 쓰이지 않는 항목, 그리고 조달청에서 받을 수 없어 표시하지 않는 항목 이름만 간단히 적는다.
 */
export function SourceSummary({
  items,
  notUsedForJudgment,
  notAvailable,
}: {
  items: SourceItem[];
  /** 값을 판정에 쓰지 않는 항목 이름들 */
  notUsedForJudgment: string[];
  /** 조달청에서 조회되지 않아 표시하지 않는 항목 이름들 */
  notAvailable: string[];
}) {
  const sources = new Map<SourceName, Set<string>>();
  for (const { field } of items) {
    const meta: SourceMeta | undefined = field.source;
    if (!meta) continue;
    const dates = sources.get(meta.source) ?? new Set<string>();
    dates.add(meta.baseDate);
    sources.set(meta.source, dates);
  }
  const names = [...sources.keys()];
  const allDates = new Set([...sources.values()].flatMap((d) => [...d]));
  const sourceText =
    names.length === 0
      ? null
      : allDates.size === 1
        ? `${names.map((n) => SOURCE_SHORT_NAME[n]).join(", ")} · 기준일 ${[...allDates][0]}`
        : names.map((n) => `${SOURCE_SHORT_NAME[n]}(기준일 ${[...(sources.get(n) ?? [])].sort().join("·")})`).join(", ");

  return (
    <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {sourceText && <Line title="출처:">{sourceText}</Line>}
      {notUsedForJudgment.length > 0 && <Line title="판정에 쓰지 않는 항목:">{notUsedForJudgment.join(", ")}</Line>}
      {notAvailable.length > 0 && <Line title="조달청에서 조회되지 않는 항목:">{notAvailable.join(", ")}</Line>}
    </div>
  );
}
