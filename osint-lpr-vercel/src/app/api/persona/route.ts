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

    const prompt = `Собери короткие customer profiles (портреты) для следующих персон:
${JSON.stringify(people, null, 2)}

Контекст о нашем продукте/компании:
${productInfo || '(не указан)'}

Правила:
- ТОЛЬКО публичные данные, обязательно добавляй ссылку и дату для важных утверждений.
- Формат вывода: Markdown, по каждой персоне карточка:
  ### ФИО — Должность
  Роль в сделке: DM | Economic Buyer | Tech Approver | Influencer | User | Blocker (и этапы: initiation/evaluation/approval/procurement)
  Зоны ответственности — 3–6 пунктов
  Боли/задачи + KPI — 2–4 пункта
  Триггеры (12–24 мес): по 1–3, «заголовок — дата — [ссылка] — почему важно»
  Сообщение (1–2 фразы) и 1–3 пары «возражение → краткий ответ»
  Каналы/контакты — указывай только то, что публично опубликовано
  Статус: verified | needs_review, confidence 0..1, recency (мес), приоритет A/B/C
- Ничего не выдумывай. Если чего-то не хватает — отметь needs_review.
`;

    async function call(withTool: boolean) {
      const resp = await client.responses.create({
        model: "gpt-5-mini",
        input: prompt,
        tools: withTool ? [{ type: "web_search_preview" }] : undefined,
      });
      const text = resp.output_text || "";
      return { text };
    }

    let out = await call(true);
    if (!out.text || out.text.trim().length === 0) {
      const fallback = await call(false);
      if (fallback.text) out = fallback;
    }

    return NextResponse.json({
      markdown: out.text || "",
      debugText: `persona raw output:\n${(out.text || '').slice(0, 4000)}`
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
