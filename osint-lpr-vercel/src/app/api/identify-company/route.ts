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
    const { mode, query } = await req.json();
    if (!query || !["name","inn"].includes(mode)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

    const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений.
Если ввод — ИНН: верни до 1 кандидата.
Если ввод — НАЗВАНИЕ: верни 1–5 кандидатов.
Для каждого: name (<=80), region (<=40), okved (<=40), inn (строка), source (URL).
Структура:
{"candidates":[{"name":"...","region":"...","okved":"...","inn":"...","source":"https://..."}]}`;

    const resp = await client.responses.create({
      model,
      input: `${prompt}\n\nРежим: ${mode}. Запрос: ${query}`,
      tools: [{ type: "web_search_preview" }],
      temperature: 0.2,
      max_output_tokens: 400
    });

    const text = resp.output_text || "{}";
    const data: any = extractJSON(text);

    return NextResponse.json({
      candidates: data?.candidates || [],
      debugText: process.env.DEBUG_LOG === "1" ? `identify-company raw:\n${text.slice(0,4000)}` : undefined
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
