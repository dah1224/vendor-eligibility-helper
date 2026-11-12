"use client";

// Design Ref: §3.2 SearchBar — 사업자등록번호 입력 + 조회 버튼 (업체명 검색은 하지 않는다)
// PRD: 사업자등록번호는 하이픈 유무와 관계없이 똑같이 인식하고, 숫자가 10자리가 아니면 검색하지 않고 바로 형식 오류를 알린다.
// 번호 검사는 브라우저에서 먼저 한다(서버 호출 없이 즉시). 서버도 같은 함수로 한 번 더 검사한다.
import { useState, type FormEvent } from "react";
import { BIZ_NO_FORMAT_ERROR, MAX_QUERY_LENGTH, normalizeBizNo } from "@/lib/bizNo";

interface SearchBarProps {
  /** 조회 중이면 버튼을 막는다 */
  loading: boolean;
  /** 검사를 통과한 사업자등록번호로 조회를 요청한다 */
  onSearch: (bizNo: string) => void;
  /** 형식 오류로 조회하지 않았을 때 알린다 (이전 검색 결과를 화면에서 치우는 데 쓴다) */
  onInvalid?: () => void;
}

export function SearchBar({ loading, onSearch, onInvalid }: SearchBarProps) {
  const [bizNo, setBizNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = bizNo.trim() !== "" && !loading;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    if (normalizeBizNo(bizNo) === null) {
      setError(BIZ_NO_FORMAT_ERROR); // 형식 오류: 서버를 부르지 않는다
      onInvalid?.();
      return;
    }

    setError(null);
    onSearch(bizNo.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="search-biz-no" className="text-sm font-semibold">
            사업자등록번호
          </label>
          <input
            id="search-biz-no"
            type="text"
            value={bizNo}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="사업자등록번호(10자리)"
            autoComplete="off"
            onChange={(e) => {
              setBizNo(e.target.value);
              if (error) setError(null); // 고쳐 쓰기 시작하면 오류 문구를 지운다
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "search-error" : undefined}
            className="h-10 w-72 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 aria-[invalid=true]:border-red-600 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-10 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {loading ? "조회 중…" : "조회"}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        사업자등록번호로만 조회할 수 있습니다. 하이픈(-)은 있어도 없어도 됩니다.
      </p>
      {error && (
        <p id="search-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
