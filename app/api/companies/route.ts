// Design Ref: §7.1 — GET /api/companies?q={검색어} : 업체 검색
// 200: { results: [...] } (0건이면 빈 배열) / 400: { error: { code, message } }
import type { NextRequest } from "next/server";
import { searchCompanies } from "@/lib/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const outcome = searchCompanies(q);

  if (!outcome.ok) {
    return Response.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: 400 },
    );
  }
  return Response.json({ results: outcome.results });
}
