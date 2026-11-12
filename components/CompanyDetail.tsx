// Design Ref: §3 ④ 조회 항목 — 한 업체의 항목을 대분류 3개로 묶어 표로 보여준다.
//   1) 기본정보    — 상호, 사업자등록번호, 업종, 영업 상태, 주소지(시군구)  (가로 한 줄 표)
//   2) 자격사항 검토 — 면허(윗줄) / 조달청 업체등록 · 행정처분 이력(아랫줄에 가로로 나란히)
//   3) 그 외 사항   — 계약 실적 · 신용·재무 (가로로 나란히)
// 출처·기준일은 항목마다 붙이지 않고, 대분류 맨 아래에 표로 모아 보여준다.
// 글자 크기: 세부 항목 이름(표 머리글) 13pt, 내용 12pt.
// PRD: 확인하지 못한 항목은 "확인 불가"로 표시하고 추측해서 채우지 않는다 / 출처가 다르면 두 값을 모두 보여준다.
import type { ReactNode } from "react";
import { InfoCard } from "@/components/InfoCard";
import { SourceFooter, SourceValue } from "@/components/SourceValue";
import { daysBetween } from "@/lib/data/dates";
import type { CompanyView } from "@/lib/types";

interface CompanyDetailProps {
  view: CompanyView;
  /** 판정 기준일(오늘) — 만료까지 남은 일수 계산용 */
  evaluatedAt: string;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 표 머리글(세부 항목 이름) 13pt / 표 내용 12pt */
const TH = "py-1.5 pr-3 text-left align-top text-[13pt] font-semibold text-zinc-700 dark:text-zinc-200";
const TD = "py-1.5 pr-3 align-top text-[12pt] break-words";
// 가로로 나란히 놓인 칸은 너비를 모두 같게(table-fixed) 한다
const TABLE = "w-full table-fixed text-left";
const ROW = "border-t border-zinc-100 dark:border-zinc-800";

export function CompanyDetail({ view, evaluatedAt }: CompanyDetailProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 1) 기본정보 — 구분 기준을 가로로 나란히 놓은 표 */}
      <Group title="1) 기본정보">
        <section
          aria-label="기본정보"
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="overflow-x-auto">
            <table className={`${TABLE} min-w-[640px]`}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>상호</th>
                  <th scope="col" className={TH}>사업자등록번호</th>
                  <th scope="col" className={TH}>업종</th>
                  <th scope="col" className={TH}>영업 상태</th>
                  <th scope="col" className={TH}>주소지(시군구)</th>
                </tr>
              </thead>
              <tbody>
                <tr className={ROW}>
                  <td className={`${TD} font-medium`}>
                    <SourceValue field={view.basic.companyName} stacked>{(v) => v}</SourceValue>
                  </td>
                  <td className={`${TD} tabular-nums`}>{view.bizNo}</td>
                  <td className={TD}>
                    <SourceValue field={view.basic.bizType} stacked>{(v) => v}</SourceValue>
                  </td>
                  <td className={TD}>
                    <SourceValue field={view.basic.bizStatus} stacked>{(v) => v}</SourceValue>
                  </td>
                  <td className={TD}>
                    <SourceValue field={view.address} stacked>{(v) => v}</SourceValue>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            주소지 값은 판정에 쓰지 않음 (확인 불가·불일치는 검토 필요에 반영)
          </p>
        </section>
      </Group>

      {/* 2) 자격사항 검토 */}
      <Group title="2) 자격사항 검토">
        <InfoCard title="면허">
          <SourceValue field={view.licenses}>
            {(licenses) =>
              licenses.length === 0 ? (
                <span className="text-[12pt]">보유 면허 없음</span>
              ) : (
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>면허명</th>
                      <th scope="col" className={TH}>등록번호</th>
                      <th scope="col" className={TH}>만료일</th>
                      <th scope="col" className={TH}>남은 일수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((l) => (
                      <tr key={l.regNo} className={ROW}>
                        <td className={TD}>{l.name}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{l.regNo}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{l.expiresAt}</td>
                        <td className={TD}>
                          <ExpiryDays days={daysBetween(evaluatedAt, l.expiresAt)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </SourceValue>
        </InfoCard>

        {/* 조달청 업체등록 · 행정처분 이력은 가로로 나란히 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard title="조달청 업체등록">
            <SourceValue field={view.procurement} stacked>
              {(p) => (
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>등록 여부</th>
                      <th scope="col" className={TH}>유효기간 만료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={ROW}>
                      <td className={TD}>{p.registered ? "등록됨" : "등록되어 있지 않음"}</td>
                      <td className={TD}>
                        {p.expiresAt ? (
                          <>
                            <span className="tabular-nums">{p.expiresAt}</span>{" "}
                            <ExpiryDays days={daysBetween(evaluatedAt, p.expiresAt)} />
                          </>
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">만료일 정보 없음</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </SourceValue>
          </InfoCard>

          <InfoCard title="행정처분 이력">
            <SourceValue field={view.sanctions} stacked>
              {(sanctions) =>
                sanctions.length === 0 ? (
                  <span className="text-[12pt]">행정처분 이력 없음</span>
                ) : (
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th scope="col" className={TH}>처분일</th>
                        <th scope="col" className={TH}>유형</th>
                        <th scope="col" className={TH}>사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sanctions.map((s) => (
                        <tr key={`${s.date}-${s.type}`} className={ROW}>
                          <td className={`${TD} whitespace-nowrap tabular-nums`}>{s.date}</td>
                          <td className={`${TD} font-medium`}>{s.type}</td>
                          <td className={TD}>{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </SourceValue>
          </InfoCard>
        </div>

      </Group>

      {/* 3) 그 외 사항 — 계약 실적 · 신용·재무를 가로로 나란히. 값은 판정에 쓰지 않는다 */}
      <Group title="3) 그 외 사항">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard title="계약 실적" notUsedForJudgment>
            <SourceValue field={view.contracts} stacked>
              {(contracts) =>
                contracts.length === 0 ? (
                  <span className="text-[12pt]">계약 실적 없음</span>
                ) : (
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th scope="col" className={TH}>연도</th>
                        <th scope="col" className={TH}>계약명</th>
                        <th scope="col" className={TH}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => (
                        <tr key={`${c.year}-${c.title}`} className={ROW}>
                          <td className={`${TD} whitespace-nowrap tabular-nums`}>{c.year}년</td>
                          <td className={TD}>{c.title}</td>
                          <td className={`${TD} whitespace-nowrap tabular-nums`}>{won(c.amountKrw)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </SourceValue>
          </InfoCard>

          <InfoCard title="신용·재무" notUsedForJudgment>
            <SourceValue field={view.credit} stacked>
              {(c) => (
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>신용 등급</th>
                      <th scope="col" className={TH}>평가일</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={ROW}>
                      <td className={TD}>{c.grade}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{c.evaluatedAt}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </SourceValue>
          </InfoCard>
        </div>

      </Group>

      {/* 출처 — 대분류별로 나누지 않고 화면 맨 아래에 한 번에 모아 보여준다 */}
      <SourceBox
        items={[
          { label: "상호", field: view.basic.companyName },
          { label: "업종", field: view.basic.bizType },
          { label: "영업 상태", field: view.basic.bizStatus },
          { label: "주소지", field: view.address },
          { label: "면허", field: view.licenses },
          { label: "조달청 업체등록", field: view.procurement },
          { label: "행정처분 이력", field: view.sanctions },
          { label: "계약 실적", field: view.contracts },
          { label: "신용·재무", field: view.credit },
        ]}
      />
    </div>
  );
}

/** 대분류 묶음: 큰 제목 + 그 안의 카드들 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="border-l-4 border-blue-700 pl-2 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** 화면 맨 아래에 놓는 출처 상자 (전체 항목의 출처·기준일을 한 표로) */
function SourceBox({ items }: { items: Parameters<typeof SourceFooter>[0]["items"] }) {
  return (
    <section
      aria-label="출처"
      className="rounded-lg border border-zinc-200 bg-white px-4 pb-2 pt-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-sm font-semibold">출처</h3>
      <SourceFooter items={items} />
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
