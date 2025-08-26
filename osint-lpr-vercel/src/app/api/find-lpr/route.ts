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

type Person = { full_name:string; role_title:string; sources:{label?:string; url:string; date?:string}[] };

export async function POST(req: NextRequest) {
  try {
    const { inn } = await req.json();
    if (!inn) return NextResponse.json({ error: "Missing INN" }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений. Никакого Markdown и текста вне JSON.

Схема:
{"people":[{"full_name":"","role_title":"","sources":[{"label":"","url":"","date":""}]}]}

Задача:
- Найди 3–10 руководителей/ЛПР для компании с ИНН ${"${inn}"}.
Приоритет: генеральный директор/директор/президент/предсовета, коммерческий директор, директор по закупкам, директор по развитию, CFO, CTO, учредитель/собственник/бенефициар.
Для каждого верни: full_name, role_title, sources[{label,url,date}] с публичных источников (сайт компании/ЕГРЮЛ/топ-СМИ/агрегаторы).`;

    const resp = await client.responses.create({
      model: "gpt-5",
      input: prompt,
      tools: [{ type: "web_search_preview" }],
    });

    const text = resp.output_text || "{}";
    const data: any = extractJSON(text);
    const out: { people: Person[] } = { people: Array.isArray(data?.people) ? data.people : [] };
    return NextResponse.json(out);
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
