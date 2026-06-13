import { useState, useEffect, useCallback, useMemo } from "react";
import { S } from "./supabase.js";

const COVER = 300;
const SCORING = {
  groups: { exact: 5, result: 2 },
  r32: { exact: 7, result: 3, advance: 1 },
  r16: { exact: 10, result: 4, advance: 2 },
  qf: { exact: 15, result: 5, advance: 3 },
  sf: { exact: 20, result: 7, advance: 4 },
  third: { exact: 10, result: 4 },
  final: { exact: 30, result: 10, advance: 5 },
};

const GROUPS = {
  A:[{n:"México",f:"🇲🇽"},{n:"Corea del Sur",f:"🇰🇷"},{n:"Sudáfrica",f:"🇿🇦"},{n:"Chequia",f:"🇨🇿"}],
  B:[{n:"Canadá",f:"🇨🇦"},{n:"Bosnia-Herz.",f:"🇧🇦"},{n:"Qatar",f:"🇶🇦"},{n:"Suiza",f:"🇨🇭"}],
  C:[{n:"Brasil",f:"🇧🇷"},{n:"Marruecos",f:"🇲🇦"},{n:"Haití",f:"🇭🇹"},{n:"Escocia",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿"}],
  D:[{n:"Estados Unidos",f:"🇺🇸"},{n:"Paraguay",f:"🇵🇾"},{n:"Australia",f:"🇦🇺"},{n:"Turquía",f:"🇹🇷"}],
  E:[{n:"Alemania",f:"🇩🇪"},{n:"Curazao",f:"🇨🇼"},{n:"Costa de Marfil",f:"🇨🇮"},{n:"Ecuador",f:"🇪🇨"}],
  F:[{n:"Países Bajos",f:"🇳🇱"},{n:"Japón",f:"🇯🇵"},{n:"Suecia",f:"🇸🇪"},{n:"Túnez",f:"🇹🇳"}],
  G:[{n:"Bélgica",f:"🇧🇪"},{n:"Egipto",f:"🇪🇬"},{n:"Irán",f:"🇮🇷"},{n:"Nueva Zelanda",f:"🇳🇿"}],
  H:[{n:"España",f:"🇪🇸"},{n:"Cabo Verde",f:"🇨🇻"},{n:"Arabia Saudita",f:"🇸🇦"},{n:"Uruguay",f:"🇺🇾"}],
  I:[{n:"Francia",f:"🇫🇷"},{n:"Senegal",f:"🇸🇳"},{n:"Irak",f:"🇮🇶"},{n:"Noruega",f:"🇳🇴"}],
  J:[{n:"Argentina",f:"🇦🇷"},{n:"Argelia",f:"🇩🇿"},{n:"Austria",f:"🇦🇹"},{n:"Jordania",f:"🇯🇴"}],
  K:[{n:"Portugal",f:"🇵🇹"},{n:"RD Congo",f:"🇨🇩"},{n:"Uzbekistán",f:"🇺🇿"},{n:"Colombia",f:"🇨🇴"}],
  L:[{n:"Inglaterra",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"},{n:"Croacia",f:"🇭🇷"},{n:"Ghana",f:"🇬🇭"},{n:"Panamá",f:"🇵🇦"}],
};

const MP = [[0,2],[1,3],[3,2],[0,1],[3,0],[2,1]];
const GK = Object.keys(GROUPS);

// ══════════════════════════════════════════════════════
//  RESULTADOS REALES — Actualizar diario
//  Formato: [[g1,g2],[g1,g2],...] — null = no jugado
// ══════════════════════════════════════════════════════
const RESULTS = {
  // A: [[2,0],[2,1], null,null, null,null],
};

function calcStandings(gk, scores) {
  const t = GROUPS[gk];
  const st = t.map((x, i) => ({ i, ...x, pts:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, mp:0 }));
  MP.forEach(([a, b], mi) => {
    const sc = scores?.[mi];
    if (!sc || sc[0] === null || sc[1] === null) return;
    const s1 = parseInt(sc[0]), s2 = parseInt(sc[1]);
    if (isNaN(s1) || isNaN(s2)) return;
    st[a].mp++; st[b].mp++;
    st[a].gf += s1; st[a].ga += s2; st[b].gf += s2; st[b].ga += s1;
    st[a].gd = st[a].gf - st[a].ga; st[b].gd = st[b].gf - st[b].ga;
    if (s1 > s2) { st[a].w++; st[a].pts += 3; st[b].l++; }
    else if (s1 < s2) { st[b].w++; st[b].pts += 3; st[a].l++; }
    else { st[a].d++; st[b].d++; st[a].pts++; st[b].pts++; }
  });
  return [...st].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

function calcMatchPts(pred, real, sc) {
  if (!pred || !real || pred[0] === null || pred[1] === null || real[0] === null || real[1] === null) return 0;
  const p0 = +pred[0], p1 = +pred[1], r0 = +real[0], r1 = +real[1];
  if (isNaN(p0) || isNaN(p1) || isNaN(r0) || isNaN(r1)) return 0;
  if (p0 === r0 && p1 === r1) return sc.exact;
  const pR = p0 > p1 ? 1 : p0 < p1 ? -1 : 0;
  const rR = r0 > r1 ? 1 : r0 < r1 ? -1 : 0;
  return pR === rR ? sc.result : 0;
}

function calcTotal(preds) {
  let total = 0, ex = 0;
  GK.forEach(g => {
    const ps = preds?.groups?.[g]?.matches, rs = RESULTS[g];
    if (!ps || !rs) return;
    MP.forEach((_, mi) => {
      if (!rs[mi]) return;
      const pt = calcMatchPts(ps[mi], rs[mi], SCORING.groups);
      total += pt;
      if (pt === SCORING.groups.exact) ex++;
    });
  });
  return { total, ex };
}

function ScoreBtn({ value, onChange, disabled }) {
  const v = value === null || value === "" ? null : parseInt(value);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, (v || 0) - 1))}
        disabled={disabled || v === 0 || v === null}
        className="w-7 h-7 rounded-full bg-[#484D31] text-[#F8F8F8] text-sm font-bold flex items-center justify-center disabled:opacity-30 hover:bg-[#5F6844] active:scale-95"
      >-</button>
      <div className="w-8 h-8 rounded-lg bg-[#1a1a17] border border-[#484D31] flex items-center justify-center text-lg font-bold">
        {v !== null ? v : "-"}
      </div>
      <button
        onClick={() => onChange(Math.min(9, (v ?? -1) + 1))}
        disabled={disabled}
        className="w-7 h-7 rounded-full bg-[#484D31] text-[#F8F8F8] text-sm font-bold flex items-center justify-center disabled:opacity-30 hover:bg-[#5F6844] active:scale-95"
      >+</button>
    </div>
  );
}

function StTable({ standings }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[#ACACAC] border-b border-[#484D31]">
          <th className="text-left py-1">#</th>
          <th className="text-left py-1">Equipo</th>
          <th className="text-center w-6">PJ</th>
          <th className="text-center w-6">G</th>
          <th className="text-center w-6">E</th>
          <th className="text-center w-6">P</th>
          <th className="text-center w-8">DG</th>
          <th className="text-center w-8 font-bold text-[#A4AC8C]">Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <tr key={s.i} className={`border-b border-[#333] ${i < 2 ? "text-[#A4AC8C]" : i === 2 ? "text-[#8a8a6a]" : "text-[#666]"}`}>
            <td className="py-1 text-center">{i + 1}</td>
            <td className="py-1"><span className="mr-1">{s.f}</span>{s.n}</td>
            <td className="text-center">{s.mp}</td>
            <td className="text-center">{s.w}</td>
            <td className="text-center">{s.d}</td>
            <td className="text-center">{s.l}</td>
            <td className="text-center">{s.gd > 0 ? "+" + s.gd : s.gd}</td>
            <td className="text-center font-bold">{s.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function QuinielAliah() {
  const [view, setView] = useState("dashboard");
  const [nick, setNick] = useState(null);
  const [userData, setUserData] = useState(null);
  const [allUsers, setAllUsers] = useState({});
  const [allPreds, setAllPreds] = useState({});
  const [loading, setLoading] = useState(true);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [myPreds, setMyPreds] = useState({ groups: {} });
  const [activeGroup, setActiveGroup] = useState(null);
  const [tempScores, setTempScores] = useState({});
  const [confirmLock, setConfirmLock] = useState(null);
  const [notif, setNotif] = useState(null);

  const notify = (msg, type = "success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  };

  useEffect(() => {
    (async () => {
      const u = await S.get("qa-users");
      if (u) setAllUsers(u);
      setLoading(false);
    })();
  }, []);

  const loadAll = useCallback(async () => {
    const users = await S.get("qa-users") || {};
    const preds = {};
    for (const n of Object.keys(users)) {
      const p = await S.get("qa-p-" + n);
      if (p) preds[n] = p;
    }
    setAllPreds(preds);
    setAllUsers(users);
  }, []);

  const handleLogin = async () => {
    const n = loginInput.trim();
    if (!n) { setLoginError("Escribe tu apodo"); return; }
    const users = await S.get("qa-users") || {};
    if (users[n]) {
      setNick(n); setUserData(users[n]);
      const p = await S.get("qa-p-" + n);
      if (p) setMyPreds(p);
      setLoginError("");
      await loadAll();
    } else {
      users[n] = { nickname: n, registeredAt: new Date().toISOString() };
      await S.set("qa-users", users);
      setAllUsers(users); setNick(n); setUserData(users[n]);
      notify("¡Bienvenido a Quiniel_Aliah 2026!");
      await loadAll();
    }
  };

  const saveGroup = async (gk) => {
    const scores = tempScores[gk];
    const rg = RESULTS[gk];
    const finalScores = MP.map((_, mi) => {
      const r = rg ? rg[mi] : null;
      if (r && r[0] !== null && r[1] !== null) return [null, null];
      return scores ? scores[mi] || [null, null] : [null, null];
    });
    const up = {
      ...myPreds,
      groups: {
        ...myPreds.groups,
        [gk]: { matches: finalScores, locked: true, lockedAt: new Date().toISOString() }
      }
    };
    await S.set("qa-p-" + nick, up);
    setMyPreds(up); setConfirmLock(null); setActiveGroup(null);
    notify("Grupo " + gk + " sellado ✓");
  };

  const leaderboard = useMemo(() => {
    const entries = Object.entries(allUsers).map(([n, u]) => {
      const preds = n === nick ? myPreds : allPreds[n];
      const r = calcTotal(preds);
      return { nick: n, ...u, total: r.total, ex: r.ex };
    });
    entries.sort((a, b) => b.total - a.total || b.ex - a.ex || new Date(a.registeredAt) - new Date(b.registeredAt));
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [allUsers, allPreds, myPreds, nick]);

  const myRank = leaderboard.find(e => e.nick === nick);
  const nUsers = Object.keys(allUsers).length;
  const pot = nUsers * COVER;
  const dPot = Math.max(0, pot - COVER);
  const prizes = {
    first: Math.round(dPot * 0.6),
    second: Math.round(dPot * 0.3),
    third: Math.round(dPot * 0.1),
    last: COVER
  };
  const completedG = GK.filter(g => myPreds.groups?.[g]?.locked).length;

  const NAV = [
    { id: "dashboard", icon: "◈", label: "Inicio" },
    { id: "predictions", icon: "⚽", label: "Pronósticos" },
    { id: "leaderboard", icon: "🏆", label: "Tabla" },
    { id: "rules", icon: "📋", label: "Reglas" },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#282823] flex items-center justify-center">
      <p className="text-[#A4AC8C] text-sm tracking-widest animate-pulse">CARGANDO...</p>
    </div>
  );

  const NotifEl = notif ? (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all ${notif.type === "error" ? "bg-red-900/90 text-red-200" : "bg-[#5F6844]/90 text-[#F8F8F8]"}`}>
      {notif.msg}
    </div>
  ) : null;

  // ── LOGIN ──
  if (!userData) return (
    <div className="min-h-screen bg-[#282823] flex flex-col items-center justify-center p-6">
      {NotifEl}
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <p className="text-[#F8F8F8] text-2xl font-light tracking-[0.2em] mb-1">
            QUINIEL<span className="text-[#A4AC8C]">_</span>ALIAH
          </p>
          <p className="text-[#ACACAC] text-xs tracking-[0.3em]">MUNDIAL 2026</p>
        </div>
        <input
          type="text"
          placeholder="Tu apodo / nickname"
          value={loginInput}
          onChange={e => { setLoginInput(e.target.value); setLoginError(""); }}
          onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
          className="w-full bg-[#1a1a17] border border-[#484D31] rounded-xl px-4 py-3 text-[#F8F8F8] text-center text-lg placeholder:text-[#555] placeholder:text-sm focus:outline-none focus:border-[#A4AC8C]"
          maxLength={20}
          autoFocus
        />
        {loginError && <p className="text-red-400 text-xs mt-2">{loginError}</p>}
        <button
          onClick={handleLogin}
          className="w-full bg-[#5F6844] hover:bg-[#484D31] text-[#F8F8F8] rounded-xl py-3 font-medium tracking-wider mt-4 active:scale-[0.98] transition-colors"
        >
          ENTRAR
        </button>
        <p className="text-[#666] text-xs mt-6">Escribe tu apodo. Si es la primera vez, se crea tu cuenta.</p>
        <p className="text-[#484D31] text-[10px] mt-8 tracking-widest">ALIAH DEVELOPMENTS</p>
      </div>
    </div>
  );

  // ── APP ──
  return (
    <div className="min-h-screen bg-[#282823] text-[#F8F8F8] pb-20">
      {NotifEl}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#282823]/95 backdrop-blur-sm border-b border-[#333] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-xs font-light tracking-[0.15em]">
            QUINIEL<span className="text-[#A4AC8C]">_</span>ALIAH
          </span>
          <span className="text-xs text-[#ACACAC]">{userData.nickname}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#484D31] to-[#282823] rounded-2xl p-5 border border-[#5F6844]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#A4AC8C] tracking-widest mb-1">TU POSICIÓN</p>
                  <p className="text-5xl font-bold">{myRank ? myRank.rank : "-"}°</p>
                  <p className="text-xs text-[#ACACAC] mt-1">de {nUsers} participantes</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[#A4AC8C]">{myRank ? myRank.total : 0}</p>
                  <p className="text-[10px] text-[#ACACAC]">PUNTOS</p>
                  <p className="text-[10px] text-[#666] mt-1">{myRank ? myRank.ex : 0} exactos</p>
                </div>
              </div>
              {myRank && myRank.rank <= 3 && dPot > 0 && (
                <div className="mt-3 pt-3 border-t border-[#5F6844]">
                  <p className="text-xs text-[#A4AC8C]">
                    Premio proyectado: <span className="font-bold">
                      ${(myRank.rank === 1 ? prizes.first : myRank.rank === 2 ? prizes.second : prizes.third).toLocaleString()} MXN
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="bg-[#1a1a17] rounded-xl p-4 border border-[#333]">
              <p className="text-[10px] text-[#ACACAC] tracking-widest mb-1">PROGRESO</p>
              <p className="text-2xl font-bold">{completedG}<span className="text-sm text-[#666]">/12</span></p>
              <div className="w-full h-1.5 bg-[#333] rounded-full mt-2">
                <div className="h-full bg-[#A4AC8C] rounded-full transition-all" style={{ width: (completedG / 12 * 100) + "%" }} />
              </div>
            </div>

            {pot > 0 && (
              <div className="bg-[#1a1a17] rounded-xl p-4 border border-[#333]">
                <p className="text-[10px] text-[#ACACAC] tracking-widest mb-2">POT EN JUEGO</p>
                <p className="text-3xl font-bold text-[#A4AC8C]">${pot.toLocaleString()} MXN</p>
                <div className="flex gap-4 mt-3">
                  <div><p className="text-xs text-[#666]">1ro</p><p className="text-sm font-bold">${prizes.first.toLocaleString()}</p></div>
                  <div><p className="text-xs text-[#666]">2do</p><p className="text-sm font-bold">${prizes.second.toLocaleString()}</p></div>
                  <div><p className="text-xs text-[#666]">3ro</p><p className="text-sm font-bold">${prizes.third.toLocaleString()}</p></div>
                  <div><p className="text-xs text-[#666]">Último</p><p className="text-sm font-bold">${prizes.last.toLocaleString()}</p></div>
                </div>
              </div>
            )}

            <div className="bg-[#1a1a17] rounded-xl p-4 border border-[#333]">
              <p className="text-[10px] text-[#ACACAC] tracking-widest mb-3">TOP 5</p>
              {leaderboard.slice(0, 5).map(e => (
                <div key={e.nick} className={`flex items-center justify-between py-1.5 ${e.nick === nick ? "text-[#A4AC8C]" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5 text-center font-bold">{e.rank}</span>
                    <span className="text-sm">{e.nickname}</span>
                  </div>
                  <span className="text-sm font-bold">{e.total}</span>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-[#666] text-xs text-center">Sin participantes aún</p>}
            </div>
          </div>
        )}

        {/* ── PREDICTIONS ── */}
        {view === "predictions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm tracking-widest text-[#ACACAC]">FASE DE GRUPOS</h2>
              <span className="text-xs text-[#A4AC8C]">{completedG}/12</span>
            </div>

            {activeGroup === null ? (
              <div className="grid grid-cols-3 gap-2">
                {GK.map(g => {
                  const locked = myPreds.groups?.[g]?.locked;
                  return (
                    <button key={g}
                      onClick={() => {
                        setActiveGroup(g);
                        if (!locked && !tempScores[g])
                          setTempScores(p => ({ ...p, [g]: MP.map(() => [null, null]) }));
                      }}
                      className={`rounded-xl p-3 border active:scale-[0.97] transition-colors ${locked ? "bg-[#484D31]/30 border-[#5F6844] opacity-80" : "bg-[#1a1a17] border-[#333] hover:border-[#5F6844]"}`}
                    >
                      <p className="text-lg font-bold mb-1">{g}</p>
                      <div className="text-lg mb-2">{GROUPS[g].map(t => t.f).join("")}</div>
                      {locked
                        ? <span className="text-[10px] text-[#A4AC8C]">SELLADO ✓</span>
                        : <span className="text-[10px] text-[#ACACAC]">PENDIENTE</span>
                      }
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <button onClick={() => setActiveGroup(null)} className="text-xs text-[#ACACAC] hover:text-[#F8F8F8] mb-4">← Volver</button>
                <div className="bg-[#1a1a17] rounded-2xl p-4 border border-[#333]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Grupo {activeGroup}</h3>
                    {myPreds.groups?.[activeGroup]?.locked && (
                      <span className="text-xs bg-[#5F6844] px-3 py-1 rounded-full">SELLADO ✓</span>
                    )}
                  </div>

                  <div className="flex gap-2 mb-4">
                    {GROUPS[activeGroup].map((t, i) => (
                      <div key={i} className="flex-1 bg-[#282823] rounded-lg p-2 text-center">
                        <p className="text-xl">{t.f}</p>
                        <p className="text-[10px] text-[#ACACAC] mt-1">{t.n}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 mb-4">
                    {MP.map((pair, mi) => {
                      const [a, b] = pair;
                      const teams = GROUPS[activeGroup];
                      const groupLocked = myPreds.groups?.[activeGroup]?.locked;
                      const scores = groupLocked
                        ? myPreds.groups[activeGroup].matches
                        : (tempScores[activeGroup] || MP.map(() => [null, null]));
                      const realS = RESULTS[activeGroup]?.[mi] ?? null;
                      const played = realS && realS[0] !== null && realS[1] !== null;
                      const matchLocked = groupLocked || played;
                      const pts = groupLocked && played ? calcMatchPts(scores[mi], realS, SCORING.groups) : null;

                      return (
                        <div key={mi}>
                          {mi % 2 === 0 && (
                            <p className="text-[9px] text-[#666] tracking-widest mt-3 mb-1">
                              JORNADA {mi < 2 ? 1 : mi < 4 ? 2 : 3}
                            </p>
                          )}
                          <div className={`rounded-xl p-3 border ${
                            played && !groupLocked ? "border-[#484D31] bg-[#484D31]/10" :
                            pts !== null ? (pts === 5 ? "border-green-600 bg-green-900/10" : pts === 2 ? "border-yellow-600 bg-yellow-900/10" : "border-red-900 bg-red-900/10") :
                            "border-[#333]"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 text-right">
                                <p className="text-xs">{teams[a].f} {teams[a].n}</p>
                              </div>
                              <div className="flex items-center gap-1 mx-2">
                                <ScoreBtn
                                  value={played && !groupLocked ? realS[0] : (scores[mi] ? scores[mi][0] : null)}
                                  disabled={matchLocked}
                                  onChange={v => {
                                    if (!matchLocked) setTempScores(p => {
                                      const g = p[activeGroup] ? [...p[activeGroup]] : MP.map(() => [null, null]);
                                      g[mi] = [v, g[mi] ? g[mi][1] : null];
                                      return { ...p, [activeGroup]: g };
                                    });
                                  }}
                                />
                                <span className="text-[#666] text-xs px-0.5">-</span>
                                <ScoreBtn
                                  value={played && !groupLocked ? realS[1] : (scores[mi] ? scores[mi][1] : null)}
                                  disabled={matchLocked}
                                  onChange={v => {
                                    if (!matchLocked) setTempScores(p => {
                                      const g = p[activeGroup] ? [...p[activeGroup]] : MP.map(() => [null, null]);
                                      g[mi] = [g[mi] ? g[mi][0] : null, v];
                                      return { ...p, [activeGroup]: g };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs">{teams[b].n} {teams[b].f}</p>
                              </div>
                            </div>
                            {played && !groupLocked && <p className="text-[10px] text-[#5F6844] text-center mt-1">Resultado final</p>}
                            {pts !== null && (
                              <div className="mt-1 text-center">
                                <span className={`text-[10px] font-bold ${pts === 5 ? "text-green-400" : pts === 2 ? "text-yellow-400" : "text-red-400"}`}>
                                  {pts === 5 ? "EXACTO! +5" : pts === 2 ? "Resultado +2" : "Fallo +0"}
                                </span>
                                <span className="text-[10px] text-[#666] ml-2">Real: {realS[0]}-{realS[1]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-[#282823] rounded-xl p-3 mb-4">
                    <p className="text-[10px] text-[#ACACAC] tracking-widest mb-2">TABLA PROYECTADA</p>
                    <StTable standings={calcStandings(
                      activeGroup,
                      myPreds.groups?.[activeGroup]?.locked
                        ? myPreds.groups[activeGroup].matches
                        : tempScores[activeGroup]
                    )} />
                  </div>

                  {!myPreds.groups?.[activeGroup]?.locked && (
                    confirmLock === activeGroup ? (
                      <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center space-y-3">
                        <p className="text-sm font-bold text-red-300">¿Estás seguro?</p>
                        <p className="text-xs text-[#ACACAC]">IRREVERSIBLE. Tus predicciones del Grupo {activeGroup} quedan bloqueadas para siempre.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmLock(null)} className="flex-1 bg-[#333] py-2 rounded-lg text-sm">Cancelar</button>
                          <button onClick={() => saveGroup(activeGroup)} className="flex-1 bg-red-800 py-2 rounded-lg text-sm font-bold">SELLAR {activeGroup}</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const s = tempScores[activeGroup];
                          const rg = RESULTS[activeGroup];
                          let missing = false;
                          MP.forEach((_, mi) => {
                            const r = rg ? rg[mi] : null;
                            if (r && r[0] !== null) return;
                            if (!s || !s[mi] || s[mi][0] === null || s[mi][0] === "" || s[mi][1] === null || s[mi][1] === "") missing = true;
                          });
                          if (missing) { notify("Completa todos los partidos pendientes", "error"); return; }
                          setConfirmLock(activeGroup);
                        }}
                        className="w-full bg-[#5F6844] hover:bg-[#484D31] py-3 rounded-xl text-sm font-bold tracking-wider active:scale-[0.98] transition-colors"
                      >
                        SELLAR GRUPO {activeGroup}
                      </button>
                    )
                  )}

                  {myPreds.groups?.[activeGroup]?.locked && (
                    <p className="text-center text-xs text-[#5F6844] py-2">
                      Sellado el {new Date(myPreds.groups[activeGroup].lockedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => {
                      const i = GK.indexOf(activeGroup);
                      if (i > 0) {
                        const p = GK[i - 1];
                        setActiveGroup(p);
                        if (!myPreds.groups?.[p]?.locked && !tempScores[p])
                          setTempScores(prev => ({ ...prev, [p]: MP.map(() => [null, null]) }));
                      }
                    }}
                    disabled={GK.indexOf(activeGroup) === 0}
                    className="text-xs text-[#ACACAC] disabled:opacity-30"
                  >
                    ← {GK[GK.indexOf(activeGroup) - 1] || ""}
                  </button>
                  <button
                    onClick={() => {
                      const i = GK.indexOf(activeGroup);
                      if (i < 11) {
                        const n = GK[i + 1];
                        setActiveGroup(n);
                        if (!myPreds.groups?.[n]?.locked && !tempScores[n])
                          setTempScores(prev => ({ ...prev, [n]: MP.map(() => [null, null]) }));
                      }
                    }}
                    disabled={GK.indexOf(activeGroup) === 11}
                    className="text-xs text-[#ACACAC] disabled:opacity-30"
                  >
                    {GK[GK.indexOf(activeGroup) + 1] || ""} →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {view === "leaderboard" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm tracking-widest text-[#ACACAC]">LEADERBOARD</h2>
              <button onClick={loadAll} className="text-[10px] text-[#5F6844] hover:text-[#A4AC8C]">↻ Actualizar</button>
            </div>
            <div className="space-y-1.5">
              {leaderboard.map((e, i) => (
                <div key={e.nick} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${e.nick === nick ? "bg-[#484D31]/40 border border-[#5F6844]" : "bg-[#1a1a17] border border-transparent"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-yellow-600 text-[#282823]" : i === 1 ? "bg-gray-400 text-[#282823]" : i === 2 ? "bg-amber-700" : "bg-[#333] text-[#ACACAC]"}`}>
                    {e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium truncate ${e.nick === nick ? "text-[#A4AC8C]" : ""}`}>{e.nickname}</span>
                    <p className="text-[10px] text-[#666]">{e.ex} exactos</p>
                  </div>
                  <p className="text-lg font-bold text-[#A4AC8C]">{e.total}</p>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-[#666] text-xs text-center py-8">Sin participantes aún</p>}
            </div>
          </div>
        )}

        {/* ── RULES ── */}
        {view === "rules" && (
          <div className="space-y-4">
            <h2 className="text-sm tracking-widest text-[#ACACAC]">REGLAS Y PREMIOS</h2>
            <div className="bg-[#1a1a17] rounded-2xl p-5 border border-[#333]">
              <p className="text-[10px] text-[#A4AC8C] tracking-widest mb-3">PUNTUACIÓN</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#ACACAC] border-b border-[#333]">
                    <th className="text-left py-1">Ronda</th>
                    <th className="text-center">Exacto</th>
                    <th className="text-center">Resultado</th>
                    <th className="text-center">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { r: "Grupos", e: 5, s: 2, a: "-" },
                    { r: "R32", e: 7, s: 3, a: "+1" },
                    { r: "R16", e: 10, s: 4, a: "+2" },
                    { r: "Cuartos", e: 15, s: 5, a: "+3" },
                    { r: "Semis", e: 20, s: 7, a: "+4" },
                    { r: "Final", e: 30, s: 10, a: "+5" },
                  ].map(x => (
                    <tr key={x.r} className="border-b border-[#333]">
                      <td className="py-1.5">{x.r}</td>
                      <td className="text-center text-[#A4AC8C] font-bold">{x.e}</td>
                      <td className="text-center">{x.s}</td>
                      <td className="text-center">{x.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#1a1a17] rounded-2xl p-5 border border-[#333]">
              <p className="text-[10px] text-[#A4AC8C] tracking-widest mb-3">REGLAS CLAVE</p>
              <div className="space-y-2 text-xs text-[#ACACAC] leading-relaxed">
                <p>Predice el marcador exacto de cada partido. Los pronósticos se registran por grupo completo.</p>
                <p>Una vez sellado un grupo, <strong className="text-[#F8F8F8]">NO hay vuelta atrás.</strong></p>
                <p>Partidos ya jugados se bloquean automáticamente.</p>
                <p>Premios: 1ro 60% / 2do 30% / 3ro 10% del pot. Último lugar: reembolso de $300.</p>
                <p>Desempate: más exactos → más puntos en fases avanzadas → registro más temprano.</p>
                <p>Costo de participación: <strong className="text-[#F8F8F8]">$300 MXN</strong>. Referencia de pago: QA26-[INICIALES].</p>
              </div>
            </div>
            <div className="text-center py-4">
              <p className="text-[10px] text-[#484D31] tracking-widest">QUINIEL_ALIAH 2026</p>
              <p className="text-[10px] text-[#333]">Powered by Aliah Developments</p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a17]/95 backdrop-blur-sm border-t border-[#333] z-40">
        <div className="max-w-lg mx-auto flex">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); if (item.id === "leaderboard") loadAll(); }}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${view === item.id ? "text-[#A4AC8C]" : "text-[#666]"}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[9px] tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
