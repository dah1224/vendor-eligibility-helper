// Design Ref: §7.2 — GET /api/companies/{id}?license={면허명} : 상세 조회 + 판정
// 200: { company, judgment } / 400: INVALID_LICENSE / 404: NOT_FOUND
import type { NextRequest } from "next/server";
import { getCompanyDetail } from "@/lib/detail";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const license = request.nextUrl.searchParams.get("license");
  const outcome = getCompanyDetail(id, license);

  if (!outcome.ok) {
    return Response.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: outcome.status },
    );
  }
  return Response.json({ company: outcome.company, judgment: outcome.judgment });
}
