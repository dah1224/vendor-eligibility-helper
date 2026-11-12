// Design Ref: §7.1 — GET /api/companies?bizNo={사업자등록번호} : 조달청에서 업체 검색 (사업자등록번호만)
// 200: { results: [...] } (0건이면 빈 배열) / 400: 입력 오류 / 502: 조달청 조회 실패
import type { NextRequest } from "next/server";
import { searchCompanies } from "@/lib/search";

export async function GET(request: NextRequest) {
  const bizNo = request.nextUrl.searchParams.get("bizNo") ?? "";
  const outcome = await searchCompanies(bizNo);

  if (!outcome.ok) {
    return Response.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: outcome.status },
    );
  }
  return Response.json({ results: outcome.results });
}
