"use client";

// Design Ref: §3.2 SearchResultList — 검색 결과 안내
// PRD: 0건이면 정해진 안내 문구를, 2곳 이상이면 임의로 고르지 않고 목록을 보여주고 담당자가 고르게 한다.
// (1곳이면 이 목록을 거치지 않고 바로 상세로 넘어가므로, 화면에서 이 부품을 쓰지 않는다)
import { NO_COMPANY_MESSAGE } from "@/lib/messages";
import type { SearchResultItem } from "@/lib/search";

interface SearchResultListProps {
  results: SearchResultItem[];
  /** 지금 고른 업체 id (고르기 전에는 null) */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SearchResultList({ results, selectedId, onSelect }: SearchResultListProps) {
  if (results.length === 0) {
    return (
      <p
        role="status"
        className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {NO_COMPANY_MESSAGE}
      </p>
    );
  }

  return (
    <section aria-label="검색 결과 목록" className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <p role="status" className="border-b border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        일치하는 업체가 {results.length}곳입니다. 조회할 업체를 선택해 주세요.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-500 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">상호</th>
            <th scope="col" className="px-4 py-2 font-medium">사업자등록번호</th>
            <th scope="col" className="px-4 py-2 font-medium">시군구</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">선택</th>
          </tr>
        </thead>
        <tbody>
          {results.map((item) => {
            const selected = item.id === selectedId;
            return (
              <tr
                key={item.id}
                aria-selected={selected}
                className={`border-t border-zinc-100 dark:border-zinc-800 ${selected ? "bg-blue-50 dark:bg-blue-950" : ""}`}
              >
                <td className="px-4 py-2 font-medium">{item.companyName ?? <Unknown />}</td>
                <td className="px-4 py-2 tabular-nums">{item.bizNo}</td>
                <td className="px-4 py-2">{item.address ?? <Unknown />}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-label={`${item.companyName ?? item.bizNo} 선택`}
                    aria-pressed={selected}
                    className="h-8 rounded-md border border-blue-700 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 aria-pressed:bg-blue-700 aria-pressed:text-white dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950 dark:aria-pressed:bg-blue-500 dark:aria-pressed:text-white"
                  >
                    {selected ? "선택됨" : "선택"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** 값이 없을 때: 빈칸이나 "-" 대신 항상 "확인 불가"로 표시한다 (PRD) */
function Unknown() {
  return (
    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
      확인 불가
    </span>
  );
}
