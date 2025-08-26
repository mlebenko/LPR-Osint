import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { inn } = await req.json();
    if (!inn) return NextResponse.json({ error: "Missing INN" }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const schema = {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              full_name: { type: "string" },
              role_title: { type: "string" },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string", format: "uri" },
                    date: { type: "string" }
                  },
                  required: ["url"],
                  additionalProperties: true
                }
              }
            },
            required: ["full_name", "role_title", "sources"],
            additionalProperties: false
          }
        }
      },
      required: ["people"],
      additionalProperties: false
    };

    const prompt = `Найди 3–10 руководителей/ЛПР для компании с ИНН ${inn}.
Приоритет: генеральный директор/директор/президент/предсовета, коммерческий директор, директор по закупкам, директор по развитию, CFO, CTO, учредитель/собственник/бенефициар.
Верни список с полями full_name, role_title, sources[{label,url,date}]. Используй только публичные источники (сайт компании/ЕГРЮЛ/топ-СМИ/агрегаторы).`;

    const resp = await client.responses.create({
      model: "gpt-5",
      input: prompt,
      tools: [{ type: "web_search_preview" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "PeopleShortlist", schema, strict: true }
      }
    });

    const text = resp.output_text || "{}";
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    return NextResponse.json({ people: data.people || [] });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
