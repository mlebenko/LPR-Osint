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
    const { inn, companyName = "", region = "", sourceDomain = "" } = await req.json();
if (!inn) return NextResponse.json({ error: "Missing INN" }, { status: 400 });
    
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений.
Компания: ИНН ${inn}${companyName ? `, название "${companyName}"` : ""}${region ? `, регион "${region}"` : ""}.
ВКЛЮЧАЙ только персон, чьи источники:
  – НА СТРАНИЦЕ явно содержат тот же ИНН ${inn}; ИЛИ
  – ${sourceDomain ? `размещены на официальном домене ${sourceDomain} ИЛИ ` : ""}в реестрах: egrul.nalog.ru, nalog.ru, companies.rbc.ru, rusprofile.ru, sbis.ru, kontur.ru, spark-interfax.ru.
ИГНОРИРУЙ одноимённые компании с иным ИНН.
Верни 3–6 записей; для каждой до 2 источников.
{"people":[{"full_name":"...","role_title":"...","sources":[{"label":"...","url":"https://...","date":"YYYY-MM-DD"}]}]}`;

    const resp = await client.responses.create({
      model,
      input: prompt,
      tools: [{ type: "web_search_preview" }],
      max_output_tokens: 600
    });

    const text = resp.output_text || "{}";
    const data: any = extractJSON(text);

    return NextResponse.json({
      people: data?.people || [],
      debugText: process.env.DEBUG_LOG === "1" ? `find-lpr raw:\n${text.slice(0,4000)}` : undefined
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
