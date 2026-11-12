// Design Ref: §3 ④ 조회 항목 — 조달청에서 가져올 수 있는 항목만 대분류로 묶어 표로 보여준다.
//   1) 기본정보    — 상호, 사업자등록번호, 주소지(시군구)  (가로 한 줄 표)
//   2) 자격사항 검토 — 조달청 업체등록(등록된 업종과 유효기간)
// 조달청에서 받을 수 없는 항목(면허·영업 상태·행정처분·계약 실적·신용·재무)은 표시하지 않고, 맨 아래 출처 상자에 이름만 밝힌다.
// 출처·기준일은 항목마다 붙이지 않고 화면 맨 아래에 한 번에 모아 보여준다.
// 글자 크기: 세부 항목 이름(표 머리글) 13pt, 내용 12pt. 대분류 안은 가운데 정렬.
// PRD: 확인하지 못한 항목은 "확인 불가"로 표시하고 추측해서 채우지 않는다.
import type { ReactNode } from "react";
import { InfoCard } from "@/components/InfoCard";
import { SourceSummary, SourceValue } from "@/components/SourceValue";
import { daysBetween } from "@/lib/data/dates";
import type { CompanyView } from "@/lib/types";

interface CompanyDetailProps {
  view: CompanyView;
  /** 판정 기준일(오늘) — 만료까지 남은 일수 계산용 */
  evaluatedAt: string;
}

/** 표 머리글(세부 항목 이름) 13pt / 표 내용 12pt */
const TH = "py-1.5 px-2 text-center align-top text-[13pt] font-semibold text-zinc-700 dark:text-zinc-200";
const TD = "py-1.5 px-2 text-center align-top text-[12pt] break-words";
// 가로로 나란히 놓인 칸은 너비를 모두 같게(table-fixed) 한다
const TABLE = "w-full table-fixed text-center";
const ROW = "border-t border-zinc-100 dark:border-zinc-800";

export function CompanyDetail({ view, evaluatedAt }: CompanyDetailProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 1) 기본정보 — 구분 기준을 가로로 나란히 놓은 표 */}
      <Group title="1) 기본정보">
        <section
          aria-label="기본정보"
          className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="overflow-x-auto">
            <table className={`${TABLE} min-w-[420px]`}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>상호</th>
                  <th scope="col" className={TH}>사업자등록번호</th>
                  <th scope="col" className={TH}>주소지(시군구)</th>
                </tr>
              </thead>
              <tbody>
                <tr className={ROW}>
                  <td className={`${TD} font-medium`}>
                    <SourceValue field={view.basic.companyName}>{(v) => v}</SourceValue>
                  </td>
                  <td className={`${TD} tabular-nums`}>{view.bizNo}</td>
                  <td className={TD}>
                    <SourceValue field={view.address}>{(v) => v}</SourceValue>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </Group>

      {/* 2) 자격사항 검토 */}
      <Group title="2) 자격사항 검토">
        <InfoCard title="조달청 업체등록">
          <SourceValue field={view.procurement}>
            {({ industries }) =>
              industries.length === 0 ? (
                <span className="text-[12pt]">조달청에 등록된 업종 없음</span>
              ) : (
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>업종</th>
                      <th scope="col" className={TH}>등록일</th>
                      <th scope="col" className={TH}>유효기간 만료일</th>
                      <th scope="col" className={TH}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industries.map((i) => (
                      <tr key={`${i.name}-${i.registeredAt}`} className={ROW}>
                        <td className={TD}>
                          {i.name}
                          {i.representative && (
                            <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              대표
                            </span>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{i.registeredAt ?? "확인 불가"}</td>
                        <td className={TD}>
                          {i.expiresAt ? (
                            <>
                              <span className="whitespace-nowrap tabular-nums">{i.expiresAt}</span>{" "}
                              <ExpiryDays days={daysBetween(evaluatedAt, i.expiresAt)} />
                            </>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400">기한 없음</span>
                          )}
                        </td>
                        <td className={TD}>{i.status ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </SourceValue>
        </InfoCard>
      </Group>

      {/* 출처 — 화면 맨 아래에 한 번에 모아 보여준다 */}
      <section
        aria-label="출처"
        className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <SourceSummary
          items={[
            { label: "상호", field: view.basic.companyName },
            { label: "주소지", field: view.address },
            { label: "조달청 업체등록", field: view.procurement },
          ]}
          notUsedForJudgment={["주소지"]}
          notAvailable={["면허", "영업 상태", "행정처분 이력", "계약 실적", "신용·재무"]}
        />
      </section>
    </div>
  );
}

/** 대분류 묶음: 파란 제목 박스 + 그 안의 카드들 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="w-[5cm] rounded-md bg-blue-700 px-3 py-2 text-left text-[14pt] font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

/** 만료까지 남은 일수. 30일 이내(오늘 포함)는 노랗게, 이미 지났으면 붉게 — 표시용이며 판정은 서버가 한다. */
function ExpiryDays({ days }: { days: number }) {
  if (days < 0) {
    return <span className="text-xs font-medium text-red-700 dark:text-red-400">만료됨 ({-days}일 지남)</span>;
  }
  const soon = days <= 30;
  return (
    <span
      className={
        soon
          ? "rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          : "text-xs text-zinc-500 dark:text-zinc-400"
      }
    >
      D-{days}
    </span>
  );
}
