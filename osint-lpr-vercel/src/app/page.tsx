"use client";
import { useState } from "react";

type Candidate = { name:string; region:string; okved:string; inn:string; source:string };
type Person = { full_name:string; role_title:string; sources:{label:string; url:string; date?:string}[] };

export default function Page() {
  const [mode, setMode] = useState<"name" | "inn">("name");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedInn, setSelectedInn] = useState<string | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeopleIdx, setSelectedPeopleIdx] = useState<number[]>([]);

  const [productInfo, setProductInfo] = useState("");
  const [profilesMd, setProfilesMd] = useState<string>("");

  const [debugText, setDebugText] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  async function identifyCompany() {
    setLoading(true); setError(null); setCandidates([]); setPeople([]); setSelectedInn(null); setProfilesMd("");
    try {
      const res = await fetch("/api/identify-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCandidates(data.candidates || []);
      setDebugText(data.debugText || "");
      const only = (data.candidates && data.candidates.length === 1) ? data.candidates[0] : null;
      if (mode === "inn") {
        const innFromInput = query.trim();
        const inn = (only?.inn?.trim() || innFromInput);
        if (inn) {
          setSelectedInn(inn);
          await findPeople(inn);
        }
      }
    } catch (e:any) {
      setError(e.message || "Ошибка");
    } finally { setLoading(false); }
  }

  async function findPeople(inn: string) {
    setLoading(true); setError(null); setPeople([]);
    try {
      const res = await fetch("/api/find-lpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPeople(data.people || []);
      setDebugText((prev)=> (prev ? prev + "\n\n" : "") + (data.debugText || ""));
    } catch (e:any) {
      setError(e.message || "Ошибка");
    } finally { setLoading(false); }
  }

  async function makeProfiles() {
    setLoading(true); setError(null); setProfilesMd("");
    try {
      const chosen = selectedPeopleIdx.map(i => people[i]);
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: chosen, productInfo }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProfilesMd(data.markdown || "");
      setDebugText((prev)=> (prev ? prev + "\n\n" : "") + (data.debugText || ""));
    } catch (e:any) {
      setError(e.message || "Ошибка");
    } finally { setLoading(false); }
  }

  return (
    <main>
      <h1 style={{fontSize:32, fontWeight:700, marginBottom:12}}>OSINT ЛПР/ЛВПР — мастер из 3 шагов</h1>
      <p style={{opacity:.8, marginBottom:20}}>Шаг 1: найдите компанию → Шаг 2: выберите ЛПР → Шаг 3: получите портреты.</p>

      {/* Step 1 */}
      <section style={{background:"#fff", padding:16, borderRadius:14, boxShadow:"0 1px 2px rgba(0,0,0,0.06)", marginBottom:16}}>
        <h2 style={{fontSize:20, fontWeight:700}}>Шаг 1 — Поиск компании</h2>
        <div style={{display:"flex", gap:8, margin:"8px 0"}}>
          <label><input type="radio" checked={mode==="name"} onChange={()=>setMode("name")} /> По названию</label>
          <label><input type="radio" checked={mode==="inn"} onChange={()=>setMode("inn")} /> По ИНН</label>
        </div>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder={mode==="name" ? "Например: Газпром" : "Например: 7707083893"}
          style={{width:"100%", padding:12, border:"1px solid #e2e8f0", borderRadius:10}}
        />
        <button onClick={identifyCompany} disabled={loading || !query.trim()} style={btnStyle}>
          {loading ? "Ищу..." : "Найти компанию"}
        </button>

        {error && <p style={{color:"#b91c1c", marginTop:8}}>{error}</p>}

        {candidates.length>0 && (
          <div style={{marginTop:12}}>
            <p style={{fontWeight:600}}>Выберите компанию для продолжения:</p>
            <table style={{width:"100%", fontSize:14, borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={thtd}>Название</th><th style={thtd}>Регион</th><th style={thtd}>ОКВЭД</th><th style={thtd}>ИНН</th><th style={thtd}>Источник</th><th style={thtd}></th>
              </tr></thead>
              <tbody>
                {candidates.map((c, i)=> (
                  <tr key={i}>
                    <td style={thtd}>{c.name}</td>
                    <td style={thtd}>{c.region}</td>
                    <td style={thtd}>{c.okved}</td>
                    <td style={thtd}>{c.inn}</td>
                    <td style={thtd}><a href={c.source} target="_blank" rel="noreferrer">ссылка</a></td>
                    <td style={thtd}>
                      <button onClick={()=>{ setSelectedInn(c.inn); findPeople(c.inn); }} style={smallBtnStyle}>Выбрать</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {candidates.length===0 && !loading && (
          <p style={{marginTop:8, opacity:.8}}>Ничего не нашли? Если вы вводили ИНН — попробую перейти к шагу 2 напрямую.</p>
        )}
      </section>

      {/* Step 2 */}
      {selectedInn && (
        <section style={{background:"#fff", padding:16, borderRadius:14, boxShadow:"0 1px 2px rgba(0,0,0,0.06)", marginBottom:16}}>
          <h2 style={{fontSize:20, fontWeight:700}}>Шаг 2 — Поиск ЛПР/ЛВПР по ИНН {selectedInn}</h2>
          {people.length===0 && <p>Ищу персоналии…</p>}
          {people.length>0 && (
            <div>
              <p style={{marginBottom:8}}>Отметьте релевантных ЛПР (1–3):</p>
              <ul style={{listStyle:"none", padding:0, margin:0}}>
                {people.map((p, i)=> (
                  <li key={i} style={{border:"1px solid #e2e8f0", borderRadius:10, padding:12, marginBottom:8}}>
                    <label style={{display:"flex", gap:8, alignItems:"flex-start"}}>
                      <input
                        type="checkbox"
                        checked={selectedPeopleIdx.includes(i)}
                        onChange={(e)=>{
                          const checked = e.target.checked;
                          setSelectedPeopleIdx(prev => checked ? [...prev, i] : prev.filter(x=>x!==i));
                        }}
                      />
                      <div>
                        <div style={{fontWeight:600}}>{p.full_name} — {p.role_title}</div>
                        <div style={{fontSize:13, opacity:.8}}>
                          Источники: {p.sources.map((s, j)=>(<a key={j} href={s.url} target="_blank" rel="noreferrer" style={{marginRight:6}}>[{s.label || 'источник'}]</a>))}
                        </div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>

              <div style={{marginTop:12}}>
                <p style={{fontWeight:600}}>Перед портретом уточните про ваш продукт/компанию (это поможет сузить поиск):</p>
                <textarea
                  value={productInfo}
                  onChange={e=>setProductInfo(e.target.value)}
                  placeholder="Кому продаёте, какую боль решаете, приоритетные роли, география, конкуренты/стек..."
                  style={{width:"100%", minHeight:120, padding:12, border:"1px solid #e2e8f0", borderRadius:10}}
                />
                <button onClick={makeProfiles} disabled={selectedPeopleIdx.length===0 || loading} style={btnStyle}>
                  {loading ? "Готовлю портреты..." : "Сделать портреты"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Debug */}
      <details style={{marginBottom:12}} open={showDebug} onToggle={(e)=>setShowDebug((e.target as HTMLDetailsElement).open)}>
        <summary style={{cursor:"pointer"}}>Показать технические детали</summary>
        <pre style={{whiteSpace:"pre-wrap", background:"#0b1220", color:"#e2e8f0", padding:12, borderRadius:10, marginTop:8}}>
{debugText || "Логи появятся после первого запроса."}
        </pre>
      </details>

      {/* Step 3 */}
      {profilesMd && (
        <section style={{background:"#fff", padding:16, borderRadius:14, boxShadow:"0 1px 2px rgba(0,0,0,0.06)", whiteSpace:"pre-wrap"}}>
          <h2 style={{fontSize:20, fontWeight:700}}>Шаг 3 — Портреты</h2>
          <div dangerouslySetInnerHTML={{ __html: mdToHtml(profilesMd) }} />
        </section>
      )}
    </main>
  );
}

const thtd: React.CSSProperties = { borderBottom:"1px solid #e2e8f0", padding:"8px 6px", textAlign:"left" };
const btnStyle: React.CSSProperties = {
  marginTop: 10, background:"#2563eb", color:"#fff", border:"none",
  padding:"10px 14px", borderRadius:10, cursor:"pointer"
};
const smallBtnStyle: React.CSSProperties = {
  background:"#0ea5e9", color:"#fff", border:"none",
  padding:"6px 10px", borderRadius:8, cursor:"pointer"
};

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
