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

// ───────────── 대분류 맨 아래에 모아 보여주는 출처 표 ─────────────

/** 출처 표에 올릴 항목 하나: 항목 이름 + 그 항목의 값(출처를 꺼내는 용도) */
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
 * 대분류 하나에 들어 있는 항목들의 출처·기준일을 표 하나로 모은다.
 * 같은 출처·같은 기준일이면 한 줄로 합친다. (예: "상호, 업종, 영업 상태 — 샘플(KISCON 형식) · 2026-11-11")
 */
export function SourceFooter({ items }: { items: SourceItem[] }) {
  const rows = new Map<string, { source: SourceMeta; labels: string[] }>();
  for (const { label, field } of items) {
    for (const source of sourcesOf(field)) {
      const key = `${source.source}|${source.label}|${source.baseDate}`;
      const row = rows.get(key) ?? { source, labels: [] };
      if (!row.labels.includes(label)) row.labels.push(label);
      rows.set(key, row);
    }
  }
  if (rows.size === 0) return null;

  return (
    <table aria-label="출처" className="w-full border-t border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <thead>
        <tr>
          <th scope="col" className="w-2/5 py-1.5 pr-3 pt-2 font-medium">출처 대상</th>
          <th scope="col" className="py-1.5 pr-3 pt-2 font-medium">출처</th>
          <th scope="col" className="w-28 py-1.5 pt-2 font-medium">기준일</th>
        </tr>
      </thead>
      <tbody>
        {[...rows.values()].map(({ source, labels }) => (
          <tr key={`${source.source}-${source.baseDate}`}>
            <td className="py-0.5 pr-3 align-top">{labels.join(", ")}</td>
            <td className="py-0.5 pr-3 align-top">{source.label}</td>
            <td className="py-0.5 align-top tabular-nums">{source.baseDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
