import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

type Candidate = { name:string; region:string; okved:string; inn:string; source:string };

export async function POST(req: NextRequest) {
  try {
    const { mode, query } = await req.json();
    if (!query || !["name","inn"].includes(mode)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Ask the model to produce a small list of candidates using web_search tool.
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
      // enable web search tool
      tools: [{ type: "web_search" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "CompanyCandidates", schema, strict: true }
      }
    });

    const text = resp.output_text || "{}";
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    return NextResponse.json({ candidates: data.candidates || [] });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
