"use client";

// Design Ref: §3.2 LicenseSelect — 이번 계약에 필요한 면허를 고르는 선택 상자
// PRD: 검색 전에 필요한 면허를 먼저 고르게 한다. 고르기 전에는 안내 문구를 보여주고, 검색은 막는다(작업 11에서 연결).
import { LICENSE_NAMES, LICENSE_REQUIRED_MESSAGE, type LicenseName } from "@/lib/data/licenses";

/** 아직 고르지 않은 상태는 빈 문자열 */
export type LicenseChoice = LicenseName | "";

interface LicenseSelectProps {
  value: LicenseChoice;
  onChange: (next: LicenseChoice) => void;
}

export function LicenseSelect({ value, onChange }: LicenseSelectProps) {
  const messageId = "license-required-message";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="license-select" className="text-sm font-semibold">
        1. 필요 면허
      </label>
      <select
        id="license-select"
        value={value}
        onChange={(e) => onChange(e.target.value as LicenseChoice)}
        aria-describedby={value === "" ? messageId : undefined}
        className="h-10 min-w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:border-zinc-600 dark:bg-zinc-900"
      >
        <option value="">선택하세요</option>
        {LICENSE_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {value === "" && (
        <p id={messageId} className="text-xs text-amber-700 dark:text-amber-300">
          {LICENSE_REQUIRED_MESSAGE}
        </p>
      )}
    </div>
  );
}
