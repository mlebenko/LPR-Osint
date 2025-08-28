# OSINT ЛПР/ЛВПР (Next.js + gpt-5-mini)

## Развёртывание
1. Установить зависимости: `npm i`
2. Создать переменные окружения (Vercel → Project → Settings → Environment Variables):
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL = gpt-5-mini` (опционально; по умолчанию mini)
   - `DEBUG_LOG = 0`
3. `vercel deploy` или билд локально `npm run build && npm start`

## Что внутри
- Поэкранный мастер: s1-input → s1-choose → s2-people → s3-profiles
- Жёсткая фильтрация по ИНН/официальному домену/реестрам в /api/find-lpr
- Используются Material Symbols (подключение в `src/app/layout.tsx`)
