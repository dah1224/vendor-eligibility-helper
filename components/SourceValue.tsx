// Design Ref: §3.1, §3.2 SourceValue — 항목 값 1개를 보여준다. (출처·기준일은 대분류 맨 아래 SourceFooter에 모아 보여준다)
//   · 값이 있음   → 값
//   · 확인 불가   → 회색 "확인 불가" 배지 (빈칸·"-"·0으로 대신하지 않는다 — PRD)
//   · 출처 불일치 → 한쪽만 고르지 않고 출처별 값을 나란히 모두 보여주고 "출처 간 정보가 다릅니다" 경고를 붙인다 (PRD, 작업 14)
import type { ReactNode } from "react";
import type { FieldValue, SourceMeta, SourceName } from "@/lib/types";

/** 출처가 서로 다를 때 값 위에 붙는 경고 문구 */
export const SOURCE_CONFLICT_NOTICE = "출처 간 정보가 다릅니다";

/** 나란히 놓은 값 위에 붙이는 출처 이름 */
const SOURCE_SHORT_NAME: Record<SourceName, string> = { KISCON: "KISCON", PPS: "조달청" };

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
  /** 좁은 칸에서 출처 불일치 값을 나란히 놓지 않고 위아래로 쌓는다 */
  stacked?: boolean;
}

export function SourceValue<T>({ field, children, stacked = false }: SourceValueProps<T>) {
  if (field.kind === "unknown") {
    return <UnknownBadge />;
  }

  if (field.kind === "conflict") {
    // PRD: 출처마다 정보가 다르면 한쪽만 고르지 않고 두 값을 모두 보여준다 → 나란히 놓고 경고를 붙인다
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
        <p role="note" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <span aria-hidden="true">⚠</span>
          {SOURCE_CONFLICT_NOTICE}
        </p>
        <ul className={stacked ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
          {field.values.map((v) => (
            <li key={v.source.source} className="min-w-0 rounded bg-white/70 p-2 dark:bg-zinc-900/60">
              <span className="mb-0.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {SOURCE_SHORT_NAME[v.source.source]}
              </span>
              <div>{children(v.value)}</div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <div>{children(field.value)}</div>;
}

// ───────────── 화면 맨 아래에 모아 보여주는 출처 요약 ─────────────

/** 출처 요약에 올릴 항목 하나: 항목 이름 + 그 항목의 값(출처를 꺼내는 용도) */
export interface SourceItem {
  label: string;
  field: FieldValue<unknown>;
}

/** 항목 값에서 출처 목록을 꺼낸다 (확인 불가인데 출처도 모르면 빈 목록) */
function sourcesOf(field: FieldValue<unknown>): SourceMeta[] {
  if (field.kind === "value") return [field.source];
  if (field.kind === "conflict") return field.values.map((v) => v.source);
  return field.source ? [field.source] : [];
}

/**
 * 전체 항목의 출처를 "출처: KISCON, 조달청 · 기준일 2026-11-11" 한 줄로 요약한다.
 * (기준일이 출처마다 다르면 "KISCON(기준일), 조달청(기준일)" 형태로 적는다)
 * 아래 줄에는 판정에 쓰이지 않는 항목 이름만 간단히 적는다.
 */
export function SourceSummary({
  items,
  notUsedForJudgment,
}: {
  items: SourceItem[];
  /** 값을 판정에 쓰지 않는 항목 이름들 */
  notUsedForJudgment: string[];
}) {
  const byName = new Map<SourceName, Set<string>>();
  for (const { field } of items) {
    for (const source of sourcesOf(field)) {
      const dates = byName.get(source.source) ?? new Set<string>();
      dates.add(source.baseDate);
      byName.set(source.source, dates);
    }
  }
  const names = [...byName.keys()];
  const allDates = new Set([...byName.values()].flatMap((d) => [...d]));

  let sourceText: string | null = null;
  if (names.length > 0) {
    sourceText =
      allDates.size === 1
        ? `${names.map((n) => SOURCE_SHORT_NAME[n]).join(", ")} · 기준일 ${[...allDates][0]}`
        : names.map((n) => `${SOURCE_SHORT_NAME[n]}(기준일 ${[...(byName.get(n) ?? [])].sort().join("·")})`).join(", ");
  }

  return (
    <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {sourceText && (
        <p>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">출처:</span> {sourceText}
        </p>
      )}
      {notUsedForJudgment.length > 0 && (
        <p>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">판정에 쓰지 않는 항목:</span>{" "}
          {notUsedForJudgment.join(", ")}
        </p>
      )}
    </div>
  );
}
