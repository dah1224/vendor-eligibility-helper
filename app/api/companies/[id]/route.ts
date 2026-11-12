// Design Ref: §7.2 — GET /api/companies/{id} : 상세 조회 + 판정 (id = 사업자등록번호)
// 200: { company, judgment } / 404: NOT_FOUND / 502: PPS_FAILED
import type { NextRequest } from "next/server";
import { getCompanyDetail } from "@/lib/detail";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const outcome = await getCompanyDetail(id);

  if (!outcome.ok) {
    return Response.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: outcome.status },
    );
  }
  return Response.json({ company: outcome.company, judgment: outcome.judgment });
}
