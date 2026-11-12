// Design Ref: §7.1 — GET /api/companies?name={업체명}&bizNo={사업자등록번호} : 업체 검색 (둘 중 하나 이상 필수)
// 200: { results: [...] } (0건이면 빈 배열) / 400: { error: { code, message } }
import type { NextRequest } from "next/server";
import { searchCompanies } from "@/lib/search";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  const bizNo = request.nextUrl.searchParams.get("bizNo") ?? "";
  const outcome = searchCompanies(name, bizNo);

  if (!outcome.ok) {
    return Response.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: 400 },
    );
  }
  return Response.json({ results: outcome.results });
}
