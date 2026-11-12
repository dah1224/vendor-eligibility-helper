// Design Ref: §3.1, §3.2 SourceValue — 항목 값 1개를 출처·기준일과 함께 보여준다.
//   · 값이 있음   → 값 + "출처 · 기준일"
//   · 확인 불가   → 회색 "확인 불가" 배지 (빈칸·"-"·0으로 대신하지 않는다 — PRD)
//   · 출처 불일치 → 한쪽만 고르지 않고 출처별 값을 나란히 모두 보여주고 "출처 간 정보가 다릅니다" 경고를 붙인다 (PRD, 작업 14)
import type { ReactNode } from "react";
import type { FieldValue, SourceMeta, SourceName } from "@/lib/types";

/** 출처가 서로 다를 때 값 위에 붙는 경고 문구 */
export const SOURCE_CONFLICT_NOTICE = "출처 간 정보가 다릅니다";

/** 나란히 놓은 값 위에 붙이는 출처 이름 */
const SOURCE_SHORT_NAME: Record<SourceName, string> = { KISCON: "KISCON", PPS: "조달청" };

/** "출처: 샘플(KISCON 형식) · 기준일 2026-11-11" */
export function SourceNote({ source }: { source: SourceMeta }) {
  return (
    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
      {source.label} · 기준일 {source.baseDate}
    </span>
  );
}

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
  if (field.kind === "unknown") {
    return (
      <div>
        <UnknownBadge />
        {field.source && <SourceNote source={field.source} />}
      </div>
    );
  }

  if (field.kind === "conflict") {
    // PRD: 출처마다 정보가 다르면 한쪽만 고르지 않고 두 값을 모두 보여준다 → 나란히 놓고 경고를 붙인다
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
        <p role="note" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <span aria-hidden="true">⚠</span>
          {SOURCE_CONFLICT_NOTICE}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {field.values.map((v) => (
            <li key={v.source.source} className="min-w-0 rounded bg-white/70 p-2 dark:bg-zinc-900/60">
              <span className="mb-0.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {SOURCE_SHORT_NAME[v.source.source]}
              </span>
              <div>{children(v.value)}</div>
              <SourceNote source={v.source} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div>{children(field.value)}</div>
      <SourceNote source={field.source} />
    </div>
  );
}
