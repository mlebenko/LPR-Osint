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

type Candidate = { name:string; region?:string; okved?:string; inn?:string; source:string };

export async function POST(req: NextRequest) {
  try {
    const { mode, query } = await req.json();
    if (!query || !["name","inn"].includes(mode)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `СТРОГО ВЕРНИ ТОЛЬКО JSON без пояснений. Никакого Markdown и текста вне JSON.

Схема:
{"candidates":[{"name":"","region":"","okved":"","inn":"","source":""}]}

Инструкции:
- Если ввод — ИНН: верни максимум одного кандидата (точное совпадение).
- Если ввод — название: верни 3–8 кандидатов.
- Источники: официальные/уважаемые (ЕГРЮЛ/Прозрачный бизнес, корпоративные сайты, Rusprofile и т.п.).
- Поля:
  - name (обязательно)
  - inn (если известен)
  - region (если виден)
  - okved (если виден)
  - source (ссылка на карточку — обязательно)

Ввод:
mode=${"${mode}"}
query=${"${query}"}
`;

    const resp = await client.responses.create({
      model: "gpt-5",
      input: prompt,
      tools: [{ type: "web_search_preview" }],
    });

    const text = resp.output_text || "{}";
    const data: any = extractJSON(text);
    const out: { candidates: Candidate[] } = { candidates: Array.isArray(data?.candidates) ? data.candidates : [] };
    return NextResponse.json(out);
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
