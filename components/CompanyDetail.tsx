// Design Ref: §3 ④ 조회 항목 7개 — 한 업체의 7개 항목을 카드로 보여준다.
// PRD: 항목마다 출처와 기준일 표시 / 확인하지 못한 항목은 "확인 불가"로 표시하고 추측해서 채우지 않는다.
import { InfoCard, InfoRow } from "@/components/InfoCard";
import { SourceValue } from "@/components/SourceValue";
import { daysBetween } from "@/lib/data/dates";
import type { CompanyView, LicenseName } from "@/lib/types";

interface CompanyDetailProps {
  view: CompanyView;
  /** 담당자가 고른 면허 — 면허 목록에서 이 행을 표시한다 */
  selectedLicense: LicenseName;
  /** 판정 기준일(오늘) — 만료까지 남은 일수 계산용 */
  evaluatedAt: string;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function CompanyDetail({ view, selectedLicense, evaluatedAt }: CompanyDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. 업체 기본정보 */}
      <InfoCard title="1. 업체 기본정보">
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <InfoRow label="상호">
            <SourceValue field={view.basic.companyName}>{(v) => <span className="font-medium">{v}</span>}</SourceValue>
          </InfoRow>
          <InfoRow label="사업자등록번호">
            <span className="tabular-nums">{view.bizNo}</span>
          </InfoRow>
          <InfoRow label="업종">
            <SourceValue field={view.basic.bizType}>{(v) => v}</SourceValue>
          </InfoRow>
          <InfoRow label="영업 상태">
            <SourceValue field={view.basic.bizStatus}>{(v) => v}</SourceValue>
          </InfoRow>
        </dl>
      </InfoCard>

      {/* 2. 주소지(시군구) */}
      <InfoCard title="2. 주소지(시군구)" notUsedForJudgment>
        <SourceValue field={view.address}>{(v) => v}</SourceValue>
      </InfoCard>

      {/* 3. 면허 */}
      <InfoCard title="3. 면허">
        <SourceValue field={view.licenses}>
          {(licenses) =>
            licenses.length === 0 ? (
              <span className="text-sm">보유 면허 없음</span>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">면허명</th>
                    <th scope="col" className="py-1 pr-3 font-medium">등록번호</th>
                    <th scope="col" className="py-1 pr-3 font-medium">만료일</th>
                    <th scope="col" className="py-1 font-medium">남은 일수</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((l) => {
                    const days = daysBetween(evaluatedAt, l.expiresAt);
                    return (
                      <tr key={l.regNo} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="py-1.5 pr-3">
                          {l.name}
                          {l.name === selectedLicense && (
                            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              선택 면허
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{l.regNo}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{l.expiresAt}</td>
                        <td className="py-1.5">
                          <ExpiryDays days={days} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </SourceValue>
      </InfoCard>

      {/* 4. 조달청 업체등록 */}
      <InfoCard title="4. 조달청 업체등록">
        <SourceValue field={view.procurement}>
          {(p) => (
            <dl>
              <InfoRow label="등록 여부">{p.registered ? "등록됨" : "등록되어 있지 않음"}</InfoRow>
              <InfoRow label="유효기간 만료일">
                {p.expiresAt ? (
                  <>
                    <span className="tabular-nums">{p.expiresAt}</span>{" "}
                    <ExpiryDays days={daysBetween(evaluatedAt, p.expiresAt)} />
                  </>
                ) : (
                  <span className="text-zinc-500 dark:text-zinc-400">만료일 정보 없음</span>
                )}
              </InfoRow>
            </dl>
          )}
        </SourceValue>
      </InfoCard>

      {/* 5. 계약 실적 */}
      <InfoCard title="5. 계약 실적" notUsedForJudgment>
        <SourceValue field={view.contracts}>
          {(contracts) =>
            contracts.length === 0 ? (
              <span className="text-sm">계약 실적 없음</span>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {contracts.map((c) => (
                  <li key={`${c.year}-${c.title}`} className="flex flex-wrap gap-x-3">
                    <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{c.year}년</span>
                    <span>{c.title}</span>
                    <span className="tabular-nums">{won(c.amountKrw)}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </SourceValue>
      </InfoCard>

      {/* 6. 신용·재무 */}
      <InfoCard title="6. 신용·재무" notUsedForJudgment>
        <SourceValue field={view.credit}>
          {(c) => (
            <dl>
              <InfoRow label="신용 등급">{c.grade}</InfoRow>
              <InfoRow label="평가일">
                <span className="tabular-nums">{c.evaluatedAt}</span>
              </InfoRow>
            </dl>
          )}
        </SourceValue>
      </InfoCard>

      {/* 7. 행정처분 이력 */}
      <InfoCard title="7. 행정처분 이력">
        <SourceValue field={view.sanctions}>
          {(sanctions) =>
            sanctions.length === 0 ? (
              <span className="text-sm">행정처분 이력 없음</span>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sanctions.map((s) => (
                  <li key={`${s.date}-${s.type}`} className="flex flex-wrap gap-x-3">
                    <span className="tabular-nums">{s.date}</span>
                    <span className="font-medium">{s.type}</span>
                    <span className="text-zinc-600 dark:text-zinc-300">{s.reason}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </SourceValue>
      </InfoCard>
    </div>
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
