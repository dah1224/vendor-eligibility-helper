// 시험용: 조달청 사용자정보 서비스 응답을 흉내 낸다. (실제 조달청은 부르지 않는다)
// 응답 모양은 실제 호출에서 확인한 것과 같다: { response: { header: { resultCode }, body: { items: [...] } } }
import { addDays, todayString } from "../../lib/data/dates";

export const TODAY = todayString();

export interface MockIndustry {
  name: string;
  /** 오늘 기준 만료까지 며칠. null = 만료일 비어 있음, "2099" = 2099-12-31 */
  expiresInDays: number | null | "2099";
  status?: string;
  rep?: boolean;
}

export interface MockCompany {
  bizNo: string;
  name: string;
  /** 응답의 rgnNm (동까지 들어 있음) */
  rgnNm: string;
  industries: MockIndustry[];
  /** true면 업종 호출만 실패 */
  industryFails?: boolean;
  /** true면 기본정보 호출이 실패 */
  basicFails?: boolean;
}

/** 시험용 업체들 (모두 가짜 번호·가짜 이름) */
export const MOCK_COMPANIES: MockCompany[] = [
  // 적격: 만료일 없는 업종 + 유효한 업종
  {
    bizNo: "1000000001",
    name: "가람시설관리(가상)",
    rgnNm: "서울특별시 강남구 역삼동",
    industries: [
      { name: "시설물유지관리업", expiresInDays: null, status: "정상", rep: true },
      { name: "전기공사업", expiresInDays: "2099", status: "정상" },
    ],
  },
  // 부적격: 모든 업종 유효기간 지남
  {
    bizNo: "1000000002",
    name: "나래전기(가상)",
    rgnNm: "인천광역시 남동구 구월동",
    industries: [
      { name: "전기공사업", expiresInDays: -40, status: "정상" },
      { name: "정보통신공사업", expiresInDays: -5, status: "정상" },
    ],
  },
  // 검토 필요: 유효기간 18일 뒤
  {
    bizNo: "1000000003",
    name: "다온빌딩서비스(가상)",
    rgnNm: "부산광역시 해운대구 우동",
    industries: [{ name: "시설물유지관리업", expiresInDays: 18, status: "정상", rep: true }],
  },
  // 검토 필요: 등록된 업종 없음
  { bizNo: "1000000004", name: "라온시설(가상)", rgnNm: "대구광역시 수성구 범어동", industries: [] },
  // 검토 필요: 업종 호출만 실패 → 업종 확인 불가
  {
    bizNo: "1000000005",
    name: "마루관리(가상)",
    rgnNm: "세종특별자치시 한솔동",
    industries: [],
    industryFails: true,
  },
  // 조달청 오류: 기본정보 호출 실패
  { bizNo: "1000000006", name: "바른설비(가상)", rgnNm: "광주광역시 북구 용봉동", industries: [], basicFails: true },
];

const okHeader = { resultCode: "00", resultMsg: "정상" };

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** 조달청 URL 하나에 대한 가짜 응답. 조달청 주소가 아니면 null */
export function mockPpsResponse(url: string, today: string = TODAY): Response | null {
  if (!url.startsWith("https://apis.data.go.kr/1230000/ao/UsrInfoService02/")) return null;
  const u = new URL(url);
  const operation = u.pathname.split("/").pop();
  const params = u.searchParams;
  const bizno = params.get("bizno") ?? "";
  const company = MOCK_COMPANIES.find((c) => c.bizNo === bizno);

  if (operation === "getPrcrmntCorpBasicInfo02") {
    // 실제처럼 inqryDiv=3 + bizno가 있어야 번호로 찾는다
    if (params.get("inqryDiv") !== "3" || !bizno) {
      return jsonResponse({ "nkoneps.com.response.ResponseError": { header: { resultCode: "08", resultMsg: "필수값 입력 에러" } } });
    }
    if (company?.basicFails) return jsonResponse({}, 500);
    const items = company
      ? [
          {
            bizno: company.bizNo,
            corpNm: company.name,
            rgnNm: company.rgnNm,
            adrs: "서울특별시 어딘가 1길",
            dtlAdrs: "비밀 상세주소 101호",
            telNo: "010-0000-0000",
            ceoNm: "홍길동",
          },
        ]
      : [];
    return jsonResponse({ response: { header: okHeader, body: { items, totalCount: items.length } } });
  }

  if (operation === "getPrcrmntCorpIndstrytyInfo02") {
    // 실제처럼 inqryDiv=1 + bizno + 기간이 있어야 한다
    if (params.get("inqryDiv") !== "1" || !bizno || !params.get("inqryBgnDt") || !params.get("inqryEndDt")) {
      return jsonResponse({ "nkoneps.com.response.ResponseError": { header: { resultCode: "08", resultMsg: "필수값 입력 에러" } } });
    }
    if (company?.industryFails) return jsonResponse({}, 500);
    const items = (company?.industries ?? []).map((i) => ({
      bizno,
      indstrytyNm: i.name,
      rgstDt: "2020-01-02 00:00:00",
      vldPrdExprtDt:
        i.expiresInDays === null
          ? ""
          : i.expiresInDays === "2099"
            ? "2099-12-31 00:00:00"
            : `${addDays(today, i.expiresInDays)} 00:00:00`,
      indstrytyStatsNm: i.status ?? "",
      rprsntIndstrytyYn: i.rep ? "Y" : "N",
    }));
    return jsonResponse({ response: { header: okHeader, body: { items, totalCount: items.length } } });
  }

  return jsonResponse({}, 404);
}
