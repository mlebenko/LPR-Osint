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

type Candidate = { name:string; region:string; okved:string; inn:string; source:string };

export async function POST(req: NextRequest) {
  try {
    const { mode, query } = await req.json();
    if (!query || !["name","inn"].includes(mode)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const schema = {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              region: { type: "string" },
              okved: { type: "string" },
              inn: { type: "string" },
              source: { type: "string", format: "uri" }
            },
            required: ["name","inn","source"],
            additionalProperties: false
          }
        }
      },
      required: ["candidates"],
      additionalProperties: false
    };

    const prompt = mode === "inn"
      ? `Проверь по ИНН ${query} карточку компании в открытых источниках (официальные/уважаемые). Верни до 1 кандидата. Поля: name, region, okved, inn, source (ссылка на карточку).`
      : `Найди 3–8 кандидатов по названию компании: "${query}". Для каждого дай name, region, okved (если видишь), inn (если видишь), source (ссылка на карточку). Обязательно используй только публичные источники (ЕГРЮЛ/Прозрачный бизнес, корпоративные сайты, Rusprofile и т.п.).`;

    const resp = await client.responses.create({
      model: "gpt-5",
      input: prompt,
      tools: [{ type: "web_search_preview" }]);

    const text = resp.output_text || \"{}\";
    const data: any = extractJSON(text);
    return NextResponse.json({ \1 });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
