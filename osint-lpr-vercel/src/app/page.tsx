"use client";
import React, { useMemo, useState } from "react";

export type Candidate = { name: string; region?: string; okved?: string; inn: string; source: string };
export type Person = { full_name: string; role_title: string; sources: { label?: string; url: string; date?: string }[] };

type Screen = "s1-input" | "s1-choose" | "s2-people" | "s3-profiles";

// ---- helper available module-wide
function domainFromUrl(url?: string) {
  try { if (!url) return "—"; const u = new URL(url); return u.hostname.replace(/^www\./, ""); } catch { return url || "—"; }
}
// light MD to HTML (for already validated text)
function mdToHtml(md: string) {
  return md
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .split("\n").join("<br/>");
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("s1-input");

  const [mode, setMode] = useState<"name" | "inn">("name");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const chosen: Candidate | null = chosenIdx === null ? null : candidates[chosenIdx] ?? null;

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeopleIdx, setSelectedPeopleIdx] = useState<number[]>([]);

  const [productInfo, setProductInfo] = useState("");
  const [profilesMd, setProfilesMd] = useState<string>("");
  const [activeProfileIdx, setActiveProfileIdx] = useState<number | null>(null);

  const [debugText, setDebugText] = useState<string>("");

  function splitProfiles(md: string): { title: string; html: string }[] {
    if (!md.trim()) return [];
    const chunks = md.split(/^###\s+/m);
    const arr: { title: string; html: string }[] = [];
    for (const chunk of chunks) {
      const text = chunk.trim(); if (!text) continue;
      const nl = text.indexOf("\n");
      const title = (nl === -1 ? text : text.slice(0, nl)).trim();
      const restored = "### " + text;
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

  async function identifyCompany() {
    setLoading(true); setError(null);
    setCandidates([]); setChosenIdx(null);
    setPeople([]); setSelectedPeopleIdx([]);
    setProfilesMd(""); setActiveProfileIdx(null);

    try {
      const res = await fetch("/api/identify-company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCandidates(data.candidates || []);
      if (data.debugText) setDebugText(data.debugText);

      if (mode === "inn") {
        const c = data.candidates?.[0];
        const inn = (c?.inn?.trim() || query.trim());
        await gotoPeople({
          inn, companyName: c?.name || "", region: c?.region || "", sourceDomain: c?.source ? domainFromUrl(c.source) : "",
        });
      } else {
        if (data.candidates?.length === 1) {
          setChosenIdx(0);
          const c = data.candidates[0];
          await gotoPeople({ inn: c.inn, companyName: c.name, region: c.region || "", sourceDomain: domainFromUrl(c.source) });
        } else {
          setScreen("s1-choose");
        }
      }
    } catch (e: any) {
      setError(e?.message || "Ошибка запроса");
    } finally { setLoading(false); }
  }

  async function gotoPeople({ inn, companyName = "", region = "", sourceDomain = "" }:
    { inn: string; companyName?: string; region?: string; sourceDomain?: string; }) {
    setScreen("s2-people");
    setPeople([]); setSelectedPeopleIdx([]); setProfilesMd(""); setActiveProfileIdx(null);
    try {
      const res = await fetch("/api/find-lpr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn, companyName, region, sourceDomain }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPeople(data.people || []);
      if (data.debugText) setDebugText((prev) => (prev ? prev + "\n\n" : "") + data.debugText);
    } catch (e: any) { setError(e?.message || "Ошибка запроса"); }
  }

  async function makeProfiles() {
    setLoading(true); setError(null); setProfilesMd("");
    try {
      const chosenPeople = selectedPeopleIdx.map((i) => people[i]);
      const res = await fetch("/api/persona", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: chosenPeople, productInfo }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProfilesMd(data.markdown || "");
      setActiveProfileIdx(0);
      setScreen("s3-profiles");
      if (data.debugText) setDebugText((prev) => (prev ? prev + "\n\n" : "") + data.debugText);
    } catch (e: any) {
      setError(e?.message || "Ошибка запроса");
    } finally { setLoading(false); }
  }

  function resetAll() {
    setScreen("s1-input"); setMode("name"); setQuery("");
    setCandidates([]); setChosenIdx(null);
    setPeople([]); setSelectedPeopleIdx([]);
    setProductInfo(""); setProfilesMd(""); setActiveProfileIdx(null);
    setError(null); setDebugText("");
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Header />
      <Stepper screen={screen} />

      {screen === "s1-input" && (
        <Screen>
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <Label>Введите ИНН или название</Label>
              <div style={{ display: "flex", gap: 8 }}>
                <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={mode==="inn"?"Введите ИНН…":"Введите название компании…"} />
                <Primary disabled={loading || !query.trim()} onClick={identifyCompany}>
                  <Icon name="search" /> Поиск руководителей
                </Primary>
              </div>
              <Seg>
                <SegTab active={mode==="inn"} onClick={()=>setMode("inn")}><Icon name="badge" /> По ИНН</SegTab>
                <SegTab active={mode==="name"} onClick={()=>setMode("name")}><Icon name="business" /> По названию</SegTab>
              </Seg>
            </div>
            {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
          </Card>
        </Screen>
      )}

      {screen === "s1-choose" && (
        <Screen>
          <Card>
            <Title>Выберите нужную компанию</Title>
            <div style={{ display: "grid", gap: 10 }}>
              {candidates.map((c, i)=>(
                <label key={i} style={companyItem(chosenIdx===i)}>
                  <input type="radio" name="candidate" checked={chosenIdx===i} onChange={()=>setChosenIdx(i)} style={{marginRight:8}} />
                  <div style={{ display:"grid", gap:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontWeight: 800 }}>{c.name}</span>
                      {c.inn && <Badge><Icon name="badge" /> ИНН: {c.inn}</Badge>}
                      {c.okved && <Badge>{c.okved}</Badge>}
                    </div>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:13 }}>
                      {c.region && <span><Icon name="location_on" /> {c.region}</span>}
                      <span><Icon name="public" /> Источник: <a href={c.source} target="_blank" rel="noreferrer">{domainFromUrl(c.source)}</a></span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <Primary disabled={chosenIdx===null || loading} onClick={()=>{
                if (chosenIdx===null) return;
                const c=candidates[chosenIdx];
                gotoPeople({ inn:c.inn, companyName:c.name, region:c.region||"", sourceDomain:domainFromUrl(c.source) });
              }}>Продолжить <Icon name="chevron_right" /></Primary>
              <Ghost onClick={()=>setScreen("s1-input")}><Icon name="chevron_left" /> Назад</Ghost>
              <Ghost onClick={resetAll}>Новый поиск</Ghost>
            </div>
          </Card>
        </Screen>
      )}

      {screen === "s2-people" && (
        <Screen>
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <Title>ЛПР/ЛВПР</Title>
              {chosen ? (<Badge><Icon name="domain" /> {chosen.name} · ИНН {chosen.inn}</Badge>) : null}
            </div>

            {people.length===0 ? (
              <p style={{ opacity:.8, marginTop:8 }}>{loading ? "Ищу персоналии…" : "Нет данных. Попробуйте другой запрос."}</p>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:12, marginTop:8 }}>
                {people.map((p,i)=>(
                  <div key={i} style={personCard(selectedPeopleIdx.includes(i))}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <AvatarLetter name={p.full_name} />
                      <div style={{ display:"grid", gap:2 }}>
                        <div style={{ fontWeight:800 }}>{p.full_name}</div>
                        <div style={{ opacity:.8 }}>{p.role_title}</div>
                      </div>
                    </div>

                    <BlockTitle><Icon name="link" /> Источники</BlockTitle>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {p.sources?.slice(0,3).map((s,j)=>(
                        <a key={j} href={s.url} target="_blank" rel="noreferrer" style={chip}>{s.label || domainFromUrl(s.url)}</a>
                      ))}
                    </div>

                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
                      <button style={outlineBtn} onClick={()=>{
                        if (!selectedPeopleIdx.includes(i)) setSelectedPeopleIdx(prev=>[...prev,i]);
                        setActiveProfileIdx(selectedPeopleIdx.indexOf(i)!==-1 ? selectedPeopleIdx.indexOf(i) : selectedPeopleIdx.length);
                      }}><Icon name="visibility" /> Детальная информация</button>
                      <label style={{ display:"inline-flex", gap:6, alignItems:"center", cursor:"pointer" }}>
                        <input type="checkbox" checked={selectedPeopleIdx.includes(i)} onChange={(e)=>{
                          const checked=e.target.checked;
                          setSelectedPeopleIdx(prev=> checked ? [...prev,i] : prev.filter(x=>x!==i));
                        }} />
                        Добавить к портрету
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"grid", gap:8, marginTop:12 }}>
              <Label>Коротко о вашем продукте/компании:</Label>
              <Textarea value={productInfo} onChange={(e)=>setProductInfo(e.target.value)} placeholder="Кому продаёте, какую боль решаете, ключевые роли, география, стек…" />
              <div style={{ display:"flex", gap:8 }}>
                <Primary disabled={selectedPeopleIdx.length===0 || loading} onClick={makeProfiles}>
                  <Icon name="auto_awesome" /> Сделать портреты
                </Primary>
                <Ghost onClick={()=>setScreen("s1-choose")}><Icon name="chevron_left" /> Назад</Ghost>
                <Ghost onClick={resetAll}>Новый поиск</Ghost>
              </div>
            </div>
          </Card>
        </Screen>
      )}

      {screen === "s3-profiles" && (
        <Screen>
          <Card>
            <Title>Портрет ЛПР</Title>
            <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16 }}>
              <div>
                <BlockTitle><Icon name="group" /> Выбранные</BlockTitle>
                <ul style={{ listStyle:"none", padding:0, margin:0, display:"grid", gap:8 }}>
                  {selectedPeopleIdx.map((idx,k)=>(
                    <li key={k}>
                      <button onClick={()=>setActiveProfileIdx(k)} style={{ ...listBtn, ...(k===activeProfileIdx ? listBtnActive : null) }}>
                        <span style={{ fontWeight:700 }}>{people[idx]?.full_name || "—"}</span>
                        <span style={{ opacity:.8 }}> — {people[idx]?.role_title || ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                {activeProfileIdx===null ? (
                  <p style={{ opacity:.8 }}>Выберите персону слева.</p>
                ) : (
                  <DetailPanel person={people[selectedPeopleIdx[activeProfileIdx]]} html={profileHtmlForPerson(people[selectedPeopleIdx[activeProfileIdx]])} />
                )}
              </div>
            </div>
            <div style={{ marginTop:12, display:"flex", gap:8 }}>
              <Ghost onClick={()=>setScreen("s2-people")}><Icon name="chevron_left" /> Назад</Ghost>
              <Ghost onClick={resetAll}>Новый поиск</Ghost>
            </div>
          </Card>
        </Screen>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer" }}>Показать технические детали</summary>
        <pre style={{ whiteSpace: "pre-wrap", background: "#0b1220", color: "#e2e8f0", padding: 12, borderRadius: 10, marginTop: 8 }}>
{debugText || "Логи появятся после первого запроса."}
        </pre>
      </details>
    </main>
  );
}

function Header() {
  return (
    <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:12, background:"#1d4ed8" }} />
        <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}>OSINT ЛПР/ЛВПР</h1>
      </div>
      <span style={{ opacity:.7, fontSize:14 }}>MVP</span>
    </header>
  );
}

function Stepper({ screen }: { screen: Screen }) {
  const map: Record<string, { n: number; label: string }> = {
    "s1-input": { n: 1, label: "Поиск компании" },
    "s1-choose": { n: 1, label: "Выбор компании" },
    "s2-people": { n: 2, label: "Поиск ЛПР/ЛВПР" },
    "s3-profiles": { n: 3, label: "Портрет ЛПР" },
  };
  const cur = map[screen];
  const item = (n: number, label: string, active: boolean) => (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width:28, height:28, borderRadius:"50%", lineHeight:"28px", textAlign:"center", fontWeight:700, color: active ? "#fff" : "#0f172a", background: active ? "#2563eb" : "#e2e8f0" }}>{n}</div>
      <span style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
    </div>
  );
  return (
    <nav style={{ display:"flex", gap:16, alignItems:"center" }}>
      {item(1, cur.n===1 ? cur.label : "Поиск компании", cur.n >= 1)}<span style={{opacity:.5}}>—</span>
      {item(2, cur.n===2 ? cur.label : "Поиск ЛПР/ЛВПР", cur.n >= 2)}<span style={{opacity:.5}}>—</span>
      {item(3, cur.n===3 ? cur.label : "Портрет ЛПР", cur.n >= 3)}
    </nav>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <section style={{ minHeight:"70vh", display:"grid", alignContent:"start" }}>{children}</section>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background:"#fff", padding:16, borderRadius:14, boxShadow:"0 1px 2px rgba(0,0,0,0.06)" }}>{children}</section>;
}
function Title({ children }: { children: React.ReactNode }) { return <h2 style={{ fontSize:18, fontWeight:800, margin:0, marginBottom:8 }}>{children}</h2>; }
function BlockTitle({ children }: { children: React.ReactNode }) { return <div style={{ marginTop:8, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>{children}</div>; }
function Label({ children }: { children: React.ReactNode }) { return <label style={{ fontSize:14, opacity:.8 }}>{children}</label>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} style={{ flex:1, padding:"12px 14px", border:"1px solid #e2e8f0", borderRadius:12, fontSize:14 }} />; }
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} style={{ width:"100%", minHeight:120, padding:12, border:"1px solid #e2e8f0", borderRadius:12 }} />; }
function Primary({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...rest} style={{ background:"#2563eb", color:"#fff", border:"none", padding:"12px 16px", borderRadius:12, cursor:"pointer", fontWeight:700 }}>{children}</button>; }
function Ghost({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...rest} style={{ background:"#f1f5f9", color:"#0f172a", border:"none", padding:"10px 14px", borderRadius:12, cursor:"pointer", fontWeight:600 }}>{children}</button>; }
function Seg({ children }: { children: React.ReactNode }) { return <div style={{ display:"inline-flex", background:"#e2e8f0", borderRadius:12, padding:4, width:"fit-content" }}>{children}</div>; }
function SegTab({ active, onClick, children }: { active?: boolean; onClick?: ()=>void; children: React.ReactNode }) { return <button onClick={onClick} style={{ border:"none", padding:"8px 12px", borderRadius:8, background: active ? "#ffffff" : "transparent", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none", cursor:"pointer", fontWeight: active ? 700 : 500 }}>{children}</button>; }
function Badge({ children }: { children: React.ReactNode }) { return <span style={{ background:"#e0f2fe", color:"#075985", borderRadius:999, padding:"2px 8px", fontSize:12, fontWeight:700, display:"inline-flex", alignItems:"center", gap:6 }}>{children}</span>; }
function AvatarLetter({ name }: { name: string }) { const letter=(name||"?").trim().charAt(0).toUpperCase(); return <div style={{ width:40, height:40, borderRadius:12, background:"#eff6ff", color:"#1d4ed8", display:"grid", placeItems:"center", fontWeight:800 }}>{letter}</div>; }
function Icon({ name, size=20 }: { name: string; size?: number }) { return <span className="material-symbols-outlined" style={{ fontSize:size, lineHeight:1, verticalAlign:"-4px" }}>{name}</span>; }
function DetailPanel({ person, html }: { person: Person; html: string | null }) {
  return (
    <div style={{ display:"grid", gap:10 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <AvatarLetter name={person.full_name} />
        <div style={{ display:"grid", gap:2 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>{person.full_name}</div>
          <div style={{ opacity:.8 }}>{person.role_title}</div>
        </div>
      </div>
      <BlockTitle><Icon name="link" /> Источники</BlockTitle>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {person.sources?.slice(0,5).map((s,i)=>(<a key={i} href={s.url} target="_blank" rel="noreferrer" style={chip}>{s.label || domainFromUrl(s.url)}</a>))}
      </div>
      {html ? (<div dangerouslySetInnerHTML={{ __html: html }} />) : (<div style={{ opacity:.8 }}>Карточка появится после генерации портретов.</div>)}
    </div>
  );
}

const companyItem = (active?: boolean): React.CSSProperties => ({ display:"grid", gridTemplateColumns:"auto 1fr", gap:12, padding:12, border:`1px solid ${active ? "#93c5fd" : "#e2e8f0"}`, background: active ? "#eff6ff" : "transparent", borderRadius:12, alignItems:"flex-start" });
const personCard = (active?: boolean): React.CSSProperties => ({ border:`1px solid ${active ? "#93c5fd" : "#e2e8f0"}`, borderRadius:12, padding:12, display:"grid", gap:8 });
const outlineBtn: React.CSSProperties = { background:"transparent", color:"#2563eb", border:"1px solid #bfdbfe", padding:"8px 12px", borderRadius:10, cursor:"pointer", fontWeight:700 };
const chip: React.CSSProperties = { background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:999, padding:"4px 8px", fontSize:12 };
const listBtn: React.CSSProperties = { width:"100%", textAlign:"left", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 12px", cursor:"pointer" };
const listBtnActive: React.CSSProperties = { background:"#eff6ff", borderColor:"#93c5fd" };
