"use client";
import React, { useMemo, useState } from "react";

// Типы данных
export type Candidate = { name: string; region?: string; okved?: string; inn: string; source: string };
export type Person = {
  full_name: string;
  role_title: string;
  sources: { label?: string; url: string; date?: string }[];
};

export default function Page() {
  // Шаги мастера
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Режим поиска и запрос
  const [mode, setMode] = useState<"name" | "inn">("name");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Шаг 1 → 2: кандидаты-компании
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number | null>(null);

  // Шаг 2: ЛПР/ЛВПР
  const [selectedInn, setSelectedInn] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeopleIdx, setSelectedPeopleIdx] = useState<number[]>([]);
  const [activePersonIdx, setActivePersonIdx] = useState<number | null>(null); // для правой панели «Детальная информация»

  // Шаг 3: Портреты (Markdown)
  const [productInfo, setProductInfo] = useState("");
  const [profilesMd, setProfilesMd] = useState<string>("");

  // Технические детали
  const [debugText, setDebugText] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  // ─────────────────────── helpers
  function domainFromUrl(url?: string) {
    try {
      if (!url) return "—";
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url || "—";
    }
  }

  function mdToHtml(md: string) {
    return md
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/^\- (.*$)/gim, "<li>$1</li>")
      .split("\n")
      .join("<br/>");
  }

  function splitProfiles(md: string): { title: string; html: string }[] {
    if (!md.trim()) return [];
    const chunks = md.split(/^###\s+/m); // режем по заголовкам h3
    const arr: { title: string; html: string }[] = [];
    for (const chunk of chunks) {
      const text = chunk.trim();
      if (!text) continue;
      const nl = text.indexOf("\n");
      const title = (nl === -1 ? text : text.slice(0, nl)).trim();
      const restored = "### " + text; // возвращаем h3 для локального html
      arr.push({ title, html: mdToHtml(restored) });
    }
    return arr;
  }

  const profiles = useMemo(() => splitProfiles(profilesMd), [profilesMd]);

  function profileHtmlForPerson(p?: Person | null): string | null {
    if (!p || profiles.length === 0) return null;
    const byName = profiles.find((x) => x.title.toLowerCase().includes(p.full_name.toLowerCase()));
    return byName?.html || null;
  }

  // ─────────────────────── API вызовы
  async function identifyCompany() {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelectedCandidateIdx(null);
    setPeople([]);
    setSelectedPeopleIdx([]);
    setActivePersonIdx(null);
    setProfilesMd("");
    setSelectedInn(null);
    setStep(1);

    try {
      const res = await fetch("/api/identify-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCandidates(data.candidates || []);
      if (data.debugText) setDebugText(data.debugText);

      if (mode === "inn") {
        const innFromInput = query.trim();
        const inn = (data.candidates?.[0]?.inn?.trim() || innFromInput);
        if (inn) {
          setSelectedInn(inn);
          setStep(2);
          await findPeople(inn);
          return;
        }
      }

      // Если несколько кандидатов — остаёмся на шаге выбора (Шаг 2 по макету 2)
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  async function findPeople(inn: string) {
    setLoading(true);
    setError(null);
    setPeople([]);
    setSelectedPeopleIdx([]);
    setActivePersonIdx(null);
    setProfilesMd("");

    try {
      const res = await fetch("/api/find-lpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPeople(data.people || []);
      if (data.debugText) setDebugText((prev) => (prev ? prev + "\n\n" : "") + data.debugText);
      setStep(2); // по макету список ЛПР показываем на шаге 2
    } catch (e: any) {
      setError(e?.message || "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  async function makeProfiles() {
    setLoading(true);
    setError(null);
    setProfilesMd("");

    try {
      const chosen = selectedPeopleIdx.map((i) => people[i]);
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: chosen, productInfo }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProfilesMd(data.markdown || "");
      if (chosen.length && activePersonIdx === null) setActivePersonIdx(selectedPeopleIdx[0] ?? 0);
      if (data.debugText) setDebugText((prev) => (prev ? prev + "\n\n" : "") + data.debugText);
      setStep(3); // переходим на шаг 3 «Портрет ЛПР» согласно макету 3
    } catch (e: any) {
      setError(e?.message || "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStep(1);
    setMode("name");
    setQuery("");
    setCandidates([]);
    setSelectedCandidateIdx(null);
    setSelectedInn(null);
    setPeople([]);
    setSelectedPeopleIdx([]);
    setActivePersonIdx(null);
    setProductInfo("");
    setProfilesMd("");
    setError(null);
  }

  // ─────────────────────── UI
  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Header />
      <Stepper step={step} />

      {/* Шаг 1 — Поиск (макет 1) */}
      {step === 1 && (
        <section style={card}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ fontSize: 14, opacity: 0.8 }}>Введите ИНН или название</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === "inn" ? "Введите ИНН…" : "Введите название компании…"}
                style={input}
              />
              <button style={primary} disabled={loading || !query.trim()} onClick={identifyCompany}>
                {loading ? "Ищу…" : "Поиск руководителей"}
              </button>
            </div>
            <div style={{ display: "inline-flex", background: "#e2e8f0", borderRadius: 12, padding: 4, width: "fit-content" }}>
              <SegTab active={mode === "inn"} onClick={() => setMode("inn")}>Искать по ИНН</SegTab>
              <SegTab active={mode === "name"} onClick={() => setMode("name")}>Искать по названию</SegTab>
            </div>
          </div>
          {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
        </section>
      )}

      {/* Шаг 2 — Выбор компании (макет 2) + список ЛПР */}
      {step === 2 && (
        <section style={{ display: "grid", gap: 16 }}>
          {/* Блок выбора компании (если есть кандидаты) */}
          {candidates.length > 0 && (
            <section style={card}>
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <h2 style={h2}>По вашему запросу найдено несколько компаний</h2>
                <p style={{ opacity: 0.8 }}>Пожалуйста, выберите нужную и нажмите «Продолжить».</p>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {candidates.map((c, i) => (
                  <label key={i} style={companyItem(selectedCandidateIdx === i)}>
                    <input
                      type="radio"
                      name="candidate"
                      checked={selectedCandidateIdx === i}
                      onChange={() => setSelectedCandidateIdx(i)}
                      style={{ marginRight: 8 }}
                    />
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>{c.name}</span>
                        {c.inn && <Badge>ИНН: {c.inn}</Badge>}
                        {c.okved && <Badge>{c.okved}</Badge>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.region && <span style={{ opacity: 0.8 }}>{c.region}</span>}
                        <span style={{ opacity: 0.8 }}>
                          Источник: <a href={c.source} target="_blank" rel="noreferrer">{domainFromUrl(c.source)}</a>
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  style={primary}
                  disabled={selectedCandidateIdx === null || loading}
                  onClick={() => {
                    if (selectedCandidateIdx === null) return;
                    const chosen = candidates[selectedCandidateIdx];
                    setSelectedInn(chosen.inn);
                    findPeople(chosen.inn);
                  }}
                >
                  Продолжить
                </button>
                <button style={ghost} onClick={resetAll}>Новый поиск</button>
              </div>
            </section>
          )}

          {/* Блок ЛПР/ЛВПР (карточки) */}
          <section style={card}>
            <h2 style={h2}>ЛПР/ЛВПР компании {selectedInn ? `с ИНН ${selectedInn}` : "(выберите компанию)"}</h2>

            {people.length === 0 ? (
              <p style={{ opacity: 0.8 }}>{loading ? "Ищу персоналии…" : "Нет данных. Выберите компанию и продолжите поиск."}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12 }}>
                {people.map((p, i) => (
                  <div key={i} style={personCard(i === activePersonIdx)}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{p.full_name}</div>
                      <div style={{ opacity: 0.8 }}>{p.role_title}</div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        Источник: {p.sources?.[0]?.url ? (
                          <a href={p.sources[0].url} target="_blank" rel="noreferrer">{domainFromUrl(p.sources[0].url)}</a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        style={outline}
                        onClick={() => setActivePersonIdx(i)}
                        title="Открыть в правой панели"
                      >
                        Детальная информация
                      </button>
                      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selectedPeopleIdx.includes(i)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedPeopleIdx((prev) =>
                              checked ? [...prev, i] : prev.filter((x) => x !== i)
                            );
                          }}
                        />
                        Добавить в портрет
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Панель построения портретов */}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <label style={{ fontWeight: 600 }}>Опишите ваш продукт/компанию (поможет сузить поиск):</label>
              <textarea
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                placeholder="Кому продаёте, какую боль решаете, ключевые роли, география, стек…"
                style={textarea}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={primary}
                  disabled={selectedPeopleIdx.length === 0 || loading}
                  onClick={makeProfiles}
                >
                  {loading ? "Готовлю портреты…" : "Сделать портреты"}
                </button>
                <button style={ghost} onClick={resetAll}>Новый поиск</button>
              </div>
            </div>
          </section>

          {/* Двухколоночный блок: слева список, справа «Детальная информация» */}
          <section style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
            <div>
              <h3 style={h3}>Список персон</h3>
              {people.length === 0 ? (
                <p style={{ opacity: 0.8 }}>Нет данных.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {people.map((p, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setActivePersonIdx(i)}
                        style={{ ...listBtn, ...(i === activePersonIdx ? listBtnActive : null) }}
                        title="Открыть детальную карточку справа"
                      >
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                        <span style={{ opacity: 0.8 }}> — {p.role_title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Правая панель детальной информации (макет 3) */}
            <div>
              <h3 style={h3}>Детальная информация</h3>
              {!people.length || activePersonIdx === null ? (
                <p style={{ opacity: 0.8 }}>Выберите персону слева. После генерации портретов здесь появится подробная карточка.</p>
              ) : (
                <DetailPanel person={people[activePersonIdx]} html={profileHtmlForPerson(people[activePersonIdx])} />
              )}
            </div>
          </section>
        </section>
      )}

      {/* Шаг 3 — Портреты (итоговый блок, макет 3) */}
      {step === 3 && (
        <section style={card}>
          <h2 style={h2}>Портреты (Markdown → HTML)</h2>
          {!profilesMd ? (
            <p style={{ opacity: 0.8 }}>Сначала отметьте персон и нажмите «Сделать портреты» на шаге 2.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
              <div>
                <h3 style={h3}>Сгенерированные карточки</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {people.map((p, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setActivePersonIdx(i)}
                        style={{ ...listBtn, ...(i === activePersonIdx ? listBtnActive : null) }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                        <span style={{ opacity: 0.8 }}> — {p.role_title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={h3}>Детальная информация</h3>
                {activePersonIdx === null ? (
                  <p style={{ opacity: 0.8 }}>Выберите персону слева.</p>
                ) : (
                  <DetailPanel person={people[activePersonIdx]} html={profileHtmlForPerson(people[activePersonIdx])} />
                )}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button style={ghost} onClick={resetAll}>Новый поиск</button>
          </div>
        </section>
      )}

      {/* Debug */}
      <details style={{ marginBottom: 12 }} open={showDebug} onToggle={(e) => setShowDebug((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: "pointer" }}>Показать технические детали</summary>
        <pre style={{ whiteSpace: "pre-wrap", background: "#0b1220", color: "#e2e8f0", padding: 12, borderRadius: 10, marginTop: 8 }}>
{debugText || "Логи появятся после первого запроса."}
        </pre>
      </details>
    </main>
  );
}

// ─────────────────────── Презентационные компоненты
function Header() {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "#1d4ed8" }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>OSINT ЛПР/ЛВПР</h1>
      </div>
      <span style={{ opacity: 0.7, fontSize: 14 }}>MVP</span>
    </header>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const item = (n: number, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          lineHeight: "28px",
          textAlign: "center",
          fontWeight: 700,
          color: step >= (n as any) ? "#fff" : "#0f172a",
          background: step >= (n as any) ? "#2563eb" : "#e2e8f0",
        }}
      >
        {n}
      </div>
      <span style={{ fontWeight: step >= (n as any) ? 700 : 500 }}>{label}</span>
    </div>
  );
  return (
    <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
      {item(1, "Поиск компании")}
      <span style={{ opacity: 0.5 }}>—</span>
      {item(2, "Поиск ЛПР/ЛВПР")}
      <span style={{ opacity: 0.5 }}>—</span>
      {item(3, "Портрет ЛПР")}
    </nav>
  );
}

function SegTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        padding: "8px 12px",
        borderRadius: 8,
        background: active ? "#ffffff" : "transparent",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
        cursor: "pointer",
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: "#e0f2fe",
        color: "#075985",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function DetailPanel({ person, html }: { person: Person; html: string | null }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{person.full_name}</div>
        <div style={{ opacity: 0.8 }}>{person.role_title}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {person.sources?.slice(0, 3).map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            {s.label || new URL(s.url).hostname.replace(/^www\./, "")}
          </a>
        ))}
      </div>

      {/* При наличии — показываем сгенерированный HTML портрета; иначе — плейсхолдер */}
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div style={{ opacity: 0.8 }}>
          Карточка будет доступна после нажатия «Сделать портреты». Разделы: Зоны ответственности, Боли/задачи и KPI/OKR, Триггеры.
        </div>
      )}
    </div>
  );
}

// ─────────────────────── стили
const card: React.CSSProperties = {
  background: "#fff",
  padding: 16,
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 14,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
};

const primary: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "12px 16px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const outline: React.CSSProperties = {
  background: "transparent",
  color: "#2563eb",
  border: "1px solid #bfdbfe",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const ghost: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#0f172a",
  border: "none",
  padding: "10px 14px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 600,
};

const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: 0 };
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 8 };

const companyItem = (active?: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 10,
  padding: 12,
  border: `1px solid ${active ? "#93c5fd" : "#e2e8f0"}`,
  background: active ? "#eff6ff" : "transparent",
  borderRadius: 12,
  alignItems: "flex-start",
});

const personCard = (active?: boolean): React.CSSProperties => ({
  border: `1px solid ${active ? "#93c5fd" : "#e2e8f0"}`,
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 6,
});

const listBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
};

const listBtnActive: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#93c5fd",
};

