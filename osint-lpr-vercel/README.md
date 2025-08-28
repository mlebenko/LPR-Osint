# OSINT ЛПР/ЛВПР (Next.js + gpt-5-mini) — v7c

- Исправлено: `domainFromUrl` теперь объявлен на уровне модуля, поэтому доступен и в `DetailPanel` (ошибка TS была из-за области видимости).
- UI: поэтапный мастер s1-input → s1-choose → s2-people → s3-profiles.
- API использует `gpt-5-mini` по умолчанию и строгую фильтрацию по ИНН/домену/реестрам.

## Развёртывание
1. `npm i`
2. Env: `OPENAI_API_KEY`, опционально `OPENAI_MODEL=gpt-5-mini`, `DEBUG_LOG=0`
3. `npm run build && npm start` или загрузка на Vercel.
