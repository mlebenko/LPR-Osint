# OSINT ЛПР/ЛВПР (Next.js + gpt-5-mini) — v9

Совместимо с последней версией из канваса:
- `page.tsx`: DetailPanel НЕ использует внешние хелперы (инлайн `new URL(...).hostname`), поэтому ошибка `domainFromUrl` исключена.
- Внутри `Page` остаётся локальный `domainFromUrl` — используется только в этом компоненте.
- Шаги: 1) Поиск → 2) Выбор компании + ЛПР → 3) Портреты.
- API по умолчанию — `gpt-5-mini`.

Развёртывание:
1) `npm i`
2) Переменные окружения: `OPENAI_API_KEY`, опционально `OPENAI_MODEL=gpt-5-mini`, `DEBUG_LOG=0`
3) `npm run build && npm start` или загрузка в новый проект Vercel (с Clear build cache).
