"use client";

// Design Ref: §3.2 SearchBar — 업체명 또는 사업자등록번호 입력 + 조회 버튼
// PRD: 사업자등록번호는 하이픈 유무와 관계없이 똑같이 인식하고, 숫자가 10자리가 아니면 검색하지 않고 바로 형식 오류를 알린다.
// 번호 검사는 브라우저에서 먼저 한다(서버 호출 없이 즉시). 서버도 같은 함수로 한 번 더 검사한다.
import { useState, type FormEvent } from "react";
import { MAX_QUERY_LENGTH, parseSearchQuery } from "@/lib/bizNo";

interface SearchBarProps {
  /** 면허를 고른 뒤에만 조회할 수 있다 (PRD: 검색 전에 필요한 면허를 먼저 고른다) */
  licenseChosen: boolean;
  /** 조회 중이면 버튼을 막는다 */
  loading: boolean;
  /** 검사를 통과한 검색어로 조회를 요청한다 */
  onSearch: (query: string) => void;
  /** 형식 오류로 조회하지 않았을 때 알린다 (이전 검색 결과를 화면에서 치우는 데 쓴다) */
  onInvalid?: () => void;
}

export function SearchBar({ licenseChosen, loading, onSearch, onInvalid }: SearchBarProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEmpty = text.trim() === "";
  const canSubmit = licenseChosen && !isEmpty && !loading;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    const parsed = parseSearchQuery(text);
    if (parsed.kind === "invalidBizNo") {
      setError(parsed.message); // 형식 오류: 서버를 부르지 않는다
      onInvalid?.();
      return;
    }
    if (parsed.kind === "empty") return;

    setError(null);
    onSearch(text.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5" noValidate>
      <label htmlFor="search-input" className="text-sm font-semibold">
        2. 업체명 또는 사업자등록번호
      </label>
      <div className="flex gap-2">
        <input
          id="search-input"
          type="text"
          value={text}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="업체명 또는 사업자등록번호(10자리)"
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null); // 고쳐 쓰기 시작하면 오류 문구를 지운다
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "search-error" : undefined}
          className="h-10 w-80 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 aria-[invalid=true]:border-red-600 dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-10 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {loading ? "조회 중…" : "조회"}
        </button>
      </div>
      {error && (
        <p id="search-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
