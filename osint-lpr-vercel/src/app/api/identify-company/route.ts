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

    const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений. Никакого Markdown и текста вне JSON.

Если ввод — ИНН: проверь карточку компании в открытых источниках (официальные/уважаемые) и верни до 1 кандидата.
Если ввод — НАЗВАНИЕ: найди 3–8 кандидатов.
Для каждого кандидата дай поля:
- name (строка), region (строка или пусто), okved (строка или пусто), inn (строка, если видишь), source (URL карточки).
Структура ответа:
{ "candidates": [ { "name": "...", "region": "...", "okved": "...", "inn": "...", "source": "https://..." } ] }`;

    async function call(withTool: boolean) {
      const resp = await client.responses.create({
        model: "gpt-5-mini",
        input: `${prompt}\n\nРежим: ${mode}. Запрос: ${query}`,
        tools: withTool ? [{ type: "web_search_preview" }] : undefined,
      });
      const text = resp.output_text || "{}";
      const data: any = extractJSON(text);
      return { data, text };
    }

    let out = await call(true);
    if (!out.data?.candidates || !Array.isArray(out.data.candidates)) {
      const fallback = await call(false);
      if ((fallback.data?.candidates || []).length > 0) out = fallback;
    }

    return NextResponse.json({
      candidates: out.data?.candidates || [],
      debugText: `identify-company raw output:\n${out.text.slice(0, 4000)}`
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
