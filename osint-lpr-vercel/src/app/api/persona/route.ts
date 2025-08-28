\
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { people, productInfo } = await req.json();
    if (!people || !Array.isArray(people) || people.length === 0) {
      return NextResponse.json({ error: "No people selected" }, { status: 400 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

    const prompt = `Собери компактные customer profiles (Markdown) по списку персон ниже.
${JSON.stringify({"people":"<<см. тело запроса>>"}, null, 2)}

Контекст о нашем продукте/компании:
${"${productInfo}"}

Правила:
- ТОЛЬКО публичные данные, давай ссылку и дату для важных утверждений.
- На персону кратко:
  ### ФИО — Должность
  Роль в сделке: одна строка (DM/Economic/Tech/Influencer/User/Blocker; этапы при наличии)
  Ответственности: 3 пункта
  Боли и KPI: по 2 пункта
  Триггеры 12–24 мес: 1–2 (заголовок — дата — [ссылка] — почему важно)
  Сообщение: 1–2 фразы
  Одно возражение → краткий ответ
  Статус: verified|needs_review; confidence 0..1; recency (мес); приоритет A/B/C
- Ничего не выдумывай. Если нет данных — пометь needs_review.`;

    const resp = await client.responses.create({
      model,
      input: prompt,
      temperature: 0.3,
      max_output_tokens: 800
    });

    const text = resp.output_text || "";

    return NextResponse.json({
      markdown: text,
      debugText: process.env.DEBUG_LOG === "1" ? `persona raw:\n${text.slice(0,4000)}` : undefined
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
