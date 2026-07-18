// GEO Studio 파이프라인 리포트 다운로드 — GET ?brand&category&keywords&competitors&budget
// → runPipeline 실행 → 마크다운(.md) 첨부 응답. 고객 전달용 진단서.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { runPipeline } from "@/server/geo-studio/pipeline";
import { renderPipelineReport } from "@/server/geo-studio/pipeline-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csv = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const brand = (sp.get("brand") ?? "").trim();
  const category = (sp.get("category") ?? "").trim();
  const keywords = csv(sp.get("keywords"));
  if (!brand || !category || keywords.length === 0) {
    return NextResponse.json({ error: "brand·category·keywords가 필요합니다." }, { status: 400 });
  }

  const result = runPipeline({
    brand,
    category,
    keywords,
    competitors: csv(sp.get("competitors")),
    budget: Number(sp.get("budget")) || undefined
  });
  const md = renderPipelineReport(result);

  // 파일명은 ASCII로 안전화(브랜드 한글은 filename* UTF-8로 별도 제공).
  const asciiBrand = brand.replace(/[^A-Za-z0-9.-]+/g, "");
  const safe = asciiBrand || "brand";
  const filename = `GEO-Report-${safe}-${result.scanDate}.md`;
  const utf8 = encodeURIComponent(`GEO-리포트-${brand}-${result.scanDate}.md`);

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${utf8}`,
      "Cache-Control": "no-store"
    }
  });
}
