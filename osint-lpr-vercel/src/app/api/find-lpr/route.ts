import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const code = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/i);
  if (code) {
    const inner = code[0].replace(/```json/i, '').replace(/```/g, '').trim();
    try { return JSON.parse(inner); } catch {}
  }
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const { inn } = await req.json();
    if (!inn) return NextResponse.json({ error: "Missing INN" }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений. Никакого Markdown.
Найди 3–10 руководителей/ЛПР для компании с ИНН ${inn}.
Приоритет: гендиректор/директор/президент/предсовета, коммерческий директор, директор по закупкам, директор по развитию, CFO, CTO, учредитель/собственник/бенефициар.
Верни структуру:
{ "people": [ { "full_name": "...", "role_title": "...", "sources": [ { "label":"...", "url":"https://...", "date":"YYYY-MM-DD" } ] } ] }
Используй только публичные источники (сайт компании/ЕГРЮЛ/топ-СМИ/агрегаторы).`;

    async function call(withTool: boolean) {
      const resp = await client.responses.create({
        model: "gpt-5-mini",
        input: prompt,
        tools: withTool ? [{ type: "web_search_preview" }] : undefined,
      });
      const text = resp.output_text || "{}";
      const data: any = extractJSON(text);
      return { data, text };
    }

    let out = await call(true);
    if (!out.data?.people || !Array.isArray(out.data.people)) {
      const fallback = await call(false);
      if ((fallback.data?.people || []).length > 0) out = fallback;
    }

    return NextResponse.json({
      people: out.data?.people || [],
      debugText: `find-lpr raw output:\n${out.text.slice(0, 4000)}`
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
