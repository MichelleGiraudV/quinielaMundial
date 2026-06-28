import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import { deleteEntryRemote, saveResultsRemote, submitEntry } from "./lib/api";
import { getEntryEditToken, saveEntryEditToken } from "./lib/entryTokens";
import { isDemoMode, supabase } from "./lib/supabase";

// LocalStorage helpers for Demo/Offline Mode
const getLocalEntries = () => {
  try {
    const raw = localStorage.getItem("wc26-demo-entries");
    return raw ? JSON.parse(raw) : [];
  } catch { 
    return []; 
  }
};

const saveLocalEntries = (entries) => {
  try {
    localStorage.setItem("wc26-demo-entries", JSON.stringify(entries));
  } catch {
    // Ignore storage errors
  }
};

const getLocalResults = () => {
  try {
    const raw = localStorage.getItem("wc26-demo-results");
    return raw ? JSON.parse(raw) : null;
  } catch { 
    return null; 
  }
};

const saveLocalResults = (results) => {
  try {
    localStorage.setItem("wc26-demo-results", JSON.stringify(results));
  } catch {
    // Ignore storage errors
  }
};

const saveResultsDirect = async (results) => {
  const payload = {
    id: 1,
    data: results,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("results").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }
};

// 48 teams flags dictionary
const TEAM_FLAGS = {
  "México": "🇲🇽", "Sudáfrica": "🇿🇦", "Corea del Sur": "🇰🇷", "Chequia": "🇨🇿",
  "Canadá": "🇨🇦", "Bosnia-Herz.": "🇧🇦", "Catar": "🇶🇦", "Suiza": "🇨🇭",
  "Brasil": "🇧🇷", "Marruecos": "🇲🇦", "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "EE.UU.": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺", "Turquía": "🇹🇷",
  "Alemania": "🇩🇪", "Curazao": "🇨🇼", "C. de Marfil": "🇨🇮", "Ecuador": "🇪🇨",
  "P. Bajos": "🇳🇱", "Japón": "🇯🇵", "Suecia": "🇸🇪", "Túnez": "🇹🇳",
  "Bélgica": "🇧🇪", "Egipto": "🇪🇬", "Irán": "🇮🇷", "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸", "Cabo Verde": "🇨🇻", "Arabia Saudí": "🇸🇦", "Uruguay": "🇺🇾",
  "Francia": "🇫🇷", "Senegal": "🇸🇳", "Noruega": "🇳🇴", "Iraq": "🇮🇶",
  "Argentina": "🇦🇷", "Algeria": "🇩🇿", "Austria": "🇦🇹", "Jordania": "🇯🇴",
  "Portugal": "🇵🇹", "DR Congo": "🇨🇩", "Uzbekistán": "🇺🇿", "Colombia": "🇨🇴",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷", "Ghana": "🇬🇭", "Panamá": "🇵🇦"
};

const getTeamFlag = (name) => {
  if (!name) return "🏳️";
  const cleaned = name.trim();
  return TEAM_FLAGS[cleaned] || "🏳️";
};

const GROUPS = [
  { name:"A", matches:[["México","Sudáfrica"],["Corea del Sur","Chequia"],["México","Corea del Sur"],["Sudáfrica","Chequia"],["México","Chequia"],["Sudáfrica","Corea del Sur"]] },
  { name:"B", matches:[["Canadá","Bosnia-Herz."],["Catar","Suiza"],["Canadá","Catar"],["Bosnia-Herz.","Suiza"],["Canadá","Suiza"],["Catar","Bosnia-Herz."]] },
  { name:"C", matches:[["Brasil","Marruecos"],["Haití","Escocia"],["Brasil","Haití"],["Marruecos","Escocia"],["Brasil","Escocia"],["Marruecos","Haití"]] },
  { name:"D", matches:[["EE.UU.","Paraguay"],["Australia","Turquía"],["EE.UU.","Australia"],["Paraguay","Turquía"],["EE.UU.","Turquía"],["Paraguay","Australia"]] },
  { name:"E", matches:[["Alemania","Curazao"],["C. de Marfil","Ecuador"],["Alemania","C. de Marfil"],["Curazao","Ecuador"],["Alemania","Ecuador"],["C. de Marfil","Curazao"]] },
  { name:"F", matches:[["P. Bajos","Japón"],["Suecia","Túnez"],["P. Bajos","Suecia"],["Japón","Túnez"],["P. Bajos","Túnez"],["Japón","Suecia"]] },
  { name:"G", matches:[["Bélgica","Egipto"],["Irán","Nueva Zelanda"],["Bélgica","Irán"],["Egipto","Nueva Zelanda"],["Bélgica","Nueva Zelanda"],["Egipto","Irán"]] },
  { name:"H", matches:[["España","Cabo Verde"],["Arabia Saudí","Uruguay"],["España","Arabia Saudí"],["Uruguay","Cabo Verde"],["España","Uruguay"],["Arabia Saudí","Cabo Verde"]] },
  { name:"I", matches:[["Francia","Senegal"],["Noruega","Iraq"],["Francia","Noruega"],["Senegal","Iraq"],["Francia","Iraq"],["Senegal","Noruega"]] },
  { name:"J", matches:[["Argentina","Algeria"],["Austria","Jordania"],["Argentina","Austria"],["Algeria","Jordania"],["Argentina","Jordania"],["Algeria","Austria"]] },
  { name:"K", matches:[["Portugal","DR Congo"],["Uzbekistán","Colombia"],["Portugal","Uzbekistán"],["DR Congo","Colombia"],["Portugal","Colombia"],["DR Congo","Uzbekistán"]] },
  { name:"L", matches:[["Inglaterra","Croacia"],["Ghana","Panamá"],["Inglaterra","Ghana"],["Croacia","Panamá"],["Inglaterra","Panamá"],["Croacia","Ghana"]] },
];

const R32_PAIRS = [
  ["1E","3ABCDF"],["1I","3CDFGH"],["2A","2B"],["1F","2C"],
  ["2K","2L"],["1H","2J"],["1D","3BEFIJ"],["1G","3AEHIJ"],
  ["1C","2F"],["2E","2I"],["1A","3CEFHI"],["1L","3EHIJK"],
  ["1J","2H"],["2D","2G"],["1B","3EFGIJ"],["1K","3DEIJL"],
];
const OFFICIAL_R32_MATCHES = [
  { teamA:"Sudáfrica", teamB:"Canadá" },
  { teamA:"Brasil", teamB:"Japón" },
  { teamA:"Alemania", teamB:"Paraguay" },
  { teamA:"P. Bajos", teamB:"Marruecos" },
  { teamA:"C. de Marfil", teamB:"Noruega" },
  { teamA:"Francia", teamB:"Suecia" },
  { teamA:"México", teamB:"Ecuador" },
  { teamA:"Inglaterra", teamB:"DR Congo" },
  { teamA:"Bélgica", teamB:"Senegal" },
  { teamA:"EE.UU.", teamB:"Bosnia-Herz." },
  { teamA:"España", teamB:"Austria" },
  { teamA:"Portugal", teamB:"Croacia" },
  { teamA:"Suiza", teamB:"Algeria" },
  { teamA:"Australia", teamB:"Egipto" },
  { teamA:"Argentina", teamB:"Cabo Verde" },
  { teamA:"Colombia", teamB:"Ghana" },
];
const THIRD_SLOTS_ORDER = ["3ABCDF","3CDFGH","3CEFHI","3EHIJK","3BEFIJ","3AEHIJ","3EFGIJ","3DEIJL"];
const R16_PAIRS = [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15]];
const QF_PAIRS  = [[0,1],[2,3],[4,5],[6,7]];
const SF_PAIRS  = [[0,1],[2,3]];
const KNOCKOUT_ROUNDS = [
  { id:"r32", label:"Ronda de 32",     badge:"28 Jun – 3 Jul", count:16 },
  { id:"r16", label:"Octavos de Final", badge:"4–7 Jul",      count:8  },
  { id:"qf",  label:"Cuartos de Final",badge:"9–11 Jul",     count:4  },
  { id:"sf",  label:"Semifinales",     badge:"14–15 Jul",    count:2  },
  { id:"tp",  label:"Tercer Puesto",   badge:"18 Jul",       count:1  },
];
const KO_BONUS = { r32:1, r16:2, qf:3, sf:4, tp:5 };
const ENTRY_NAME_PREFIX = "Round 32";

function sortEntriesBySubmittedAt(entries) {
  return [...entries].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
}

function formatEntryName(name) {
  return `${ENTRY_NAME_PREFIX} - ${name}`;
}

function isRound32EntryName(name) {
  return typeof name === "string" && name.startsWith(`${ENTRY_NAME_PREFIX} - `);
}

function applyOfficialR32Matches(preds) {
  if (!preds) return preds;
  const next = { ...preds };
  OFFICIAL_R32_MATCHES.forEach((match, i) => {
    const key = `r32_${i}`;
    next[key] = {
      ...(next[key] || {}),
      teamA: match.teamA,
      teamB: match.teamB,
    };
  });
  return next;
}

function emptyPredictions() {
  const p = { champion:"", finalist:"", topScorer:"", finalScoreA:"", finalScoreB:"" };
  GROUPS.forEach(g => g.matches.forEach((_,i) => { p[`G${g.name}_${i}`]={home:"",away:""}; }));
  KNOCKOUT_ROUNDS.forEach(r => { for(let i=0;i<r.count;i++) p[`${r.id}_${i}`]={teamA:"",teamB:"",scoreA:"",scoreB:""}; });
  return applyOfficialR32Matches(p);
}

function calcStandings(gName, preds) {
  const g = GROUPS.find(x=>x.name===gName); if (!g) return [];
  const teams = {};
  g.matches.forEach(m => { [m[0],m[1]].forEach(t => { if(!teams[t]) teams[t]={team:t,pts:0,gf:0,ga:0,gd:0,w:0,d:0,l:0}; }); });
  g.matches.forEach((m,i) => {
    const p=preds[`G${gName}_${i}`]; if(!p) return;
    const h=parseInt(p.home),a=parseInt(p.away); if(isNaN(h)||isNaN(a)) return;
    teams[m[0]].gf+=h; teams[m[0]].ga+=a; teams[m[0]].gd+=h-a;
    teams[m[1]].gf+=a; teams[m[1]].ga+=h; teams[m[1]].gd+=a-h;
    if(h>a){teams[m[0]].pts+=3;teams[m[0]].w++;teams[m[1]].l++;}
    else if(h<a){teams[m[1]].pts+=3;teams[m[1]].w++;teams[m[0]].l++;}
    else{teams[m[0]].pts+=1;teams[m[1]].pts+=1;teams[m[0]].d++;teams[m[1]].d++;}
  });
  return Object.values(teams).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
}

function groupComplete(gName, preds) {
  return GROUPS.find(x=>x.name===gName).matches.every((_,i)=>{ const p=preds[`G${gName}_${i}`]; return p&&p.home!==""&&p.away!==""; });
}
function allGroupsComplete(preds) {
  if (!preds) return false;
  return GROUPS.every(g => groupComplete(g.name, preds));
}
function getThird(gName, preds) { if(!groupComplete(gName,preds)) return null; return calcStandings(gName,preds)[2]??null; }
function resolveGroupSlot(slot, preds) {
  const pos=parseInt(slot[0])-1, gName=slot[1];
  if(!groupComplete(gName,preds)) return null;
  return calcStandings(gName,preds)[pos]?.team??null;
}
function resolveAllThirds(preds) {
  const result=new Map(), used=new Set();
  const available=GROUPS.map(g=>{ const d=getThird(g.name,preds); return d?{team:d.team,pts:d.pts,gd:d.gd,gf:d.gf,group:g.name}:null; }).filter(Boolean);
  for(const slot of THIRD_SLOTS_ORDER){
    const eg=slot.slice(1).split("");
    if(!eg.every(g=>groupComplete(g,preds))) continue;
    const candidates=available.filter(t=>!used.has(t.team)&&eg.includes(t.group)).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
    if(candidates.length>0){result.set(slot,candidates[0].team);used.add(candidates[0].team);}
  }
  return result;
}

function scoreEntry(pred, results) {
  if(!results) return null;
  let total=0;
  GROUPS.forEach(g=>g.matches.forEach((_,i)=>{
    const k=`G${g.name}_${i}`,p=pred[k],r=results[k];
    if(!p||!r||r.home===""||r.away==="") return;
    const ph=parseInt(p.home),pa=parseInt(p.away),rh=parseInt(r.home),ra=parseInt(r.away);
    if(isNaN(ph)||isNaN(pa)||isNaN(rh)||isNaN(ra)) return;
    const pW=ph>pa?"h":ph<pa?"a":"d",rW=rh>ra?"h":rh<ra?"a":"d";
    if(pW===rW) total+=1; if(ph===rh&&pa===ra) total+=2;
  }));
  KNOCKOUT_ROUNDS.forEach(r=>{
    const bonus=KO_BONUS[r.id]??1;
    for(let i=0;i<r.count;i++){
      const k=`${r.id}_${i}`,p=pred[k],res=results[k]; if(!p||!res) continue;
      const pA=parseInt(p.scoreA),pB=parseInt(p.scoreB),rA=parseInt(res.scoreA),rB=parseInt(res.scoreB);
      const played=res.teamA&&res.teamB&&!isNaN(rA)&&!isNaN(rB);
      if(!played) continue;
      const pW=!isNaN(pA)&&!isNaN(pB)?(pA>pB?p.teamA:pA<pB?p.teamB:null):null;
      const rW=rA>rB?res.teamA:rA<rB?res.teamB:null;
      if(pW&&rW&&pW.trim().toLowerCase()===rW.trim().toLowerCase()) total+=bonus;
      if(!isNaN(pA)&&!isNaN(pB)&&!isNaN(rA)&&!isNaN(rB)&&pA===rA&&pB===rB) total+=bonus;
    }
  });
  if(pred.champion&&results.champion&&pred.champion.trim().toLowerCase()===results.champion.trim().toLowerCase()) total+=5;
  if(pred.topScorer&&results.topScorer&&pred.topScorer.trim().toLowerCase()===results.topScorer.trim().toLowerCase()) total+=2;
  return total;
}

function scoreKnockoutRound(pred, results, roundId) {
  if(!results) return null;
  const round=KNOCKOUT_ROUNDS.find(r=>r.id===roundId);
  if(!round) return null;
  const bonus=KO_BONUS[roundId]??1;
  let total=0;
  let hasPlayedMatch=false;

  for(let i=0;i<round.count;i++){
    const k=`${roundId}_${i}`,p=pred[k],res=results[k];
    if(!p||!res) continue;
    const pA=parseInt(p.scoreA),pB=parseInt(p.scoreB),rA=parseInt(res.scoreA),rB=parseInt(res.scoreB);
    const played=res.teamA&&res.teamB&&!isNaN(rA)&&!isNaN(rB);
    if(!played) continue;

    hasPlayedMatch=true;
    const pW=!isNaN(pA)&&!isNaN(pB)?(pA>pB?p.teamA:pA<pB?p.teamB:null):null;
    const rW=rA>rB?res.teamA:rA<rB?res.teamB:null;
    const winOk=pW&&rW&&pW.trim().toLowerCase()===rW.trim().toLowerCase();
    const exactOk=!isNaN(pA)&&!isNaN(pB)&&pA===rA&&pB===rB;

    if(winOk) total+=bonus;
    if(exactOk) total+=bonus;
  }

  return hasPlayedMatch?total:null;
}

function scoreGroupStageOnly(pred, results) {
  if(!results) return null;
  let total=0;
  let hasPlayedMatch=false;

  GROUPS.forEach(g=>g.matches.forEach((_,i)=>{
    const k=`G${g.name}_${i}`,p=pred[k],r=results[k];
    if(!p||!r||r.home===""||r.away==="") return;
    const ph=parseInt(p.home),pa=parseInt(p.away),rh=parseInt(r.home),ra=parseInt(r.away);
    if(isNaN(ph)||isNaN(pa)||isNaN(rh)||isNaN(ra)) return;

    hasPlayedMatch=true;
    const pW=ph>pa?"h":ph<pa?"a":"d";
    const rW=rh>ra?"h":rh<ra?"a":"d";
    if(pW===rW) total+=1;
    if(ph===rh&&pa===ra) total+=2;
  }));

  return hasPlayedMatch?total:null;
}

function groupMatchPts(p,r){
  if(!p||!r||r.home===""||r.away===""||p.home===""||p.away==="") return null;
  const ph=parseInt(p.home),pa=parseInt(p.away),rh=parseInt(r.home),ra=parseInt(r.away);
  if(isNaN(ph)||isNaN(pa)||isNaN(rh)||isNaN(ra)) return null;
  let pts=0;
  if((ph>pa?"h":ph<pa?"a":"d")===(rh>ra?"h":rh<ra?"a":"d")) pts+=1;
  if(ph===rh&&pa===ra) pts+=2;
  return pts;
}

const c={
  primary: "hsl(143, 60%, 15%)",
  primaryMid: "hsl(143, 45%, 28%)",
  primaryLight: "hsl(143, 30%, 45%)",
  accent: "hsl(47, 95%, 53%)",
  ink: "hsl(143, 40%, 10%)",
  gray50: "hsl(143, 15%, 97%)",
  gray100: "hsl(143, 12%, 93%)",
  gray200: "hsl(143, 10%, 86%)",
  gray400: "hsl(143, 8%, 62%)",
  gray600: "hsl(143, 8%, 40%)",
};

export default function App() {
  const [view,setView]=useState("fill");
  const [name,setName]=useState("");
  const [preds,setPreds]=useState(emptyPredictions);
  const [entries,setEntries]=useState([]);
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null);
  const [saved,setSaved]=useState(false);
  const [adminTab,setAdminTab]=useState("entries");

  const flash=msg=>{setToast(msg);setTimeout(()=>setToast(null),2800);};

  useEffect(()=>{
    (async()=>{
      if (isDemoMode) {
        setEntries(sortEntriesBySubmittedAt(getLocalEntries()));
        setResults(applyOfficialR32Matches(getLocalResults()));
      } else {
        try {
          const [{ data: ents }, { data: res }] = await Promise.all([
            supabase.from("entries").select("*").order("submitted_at", { ascending: true }),
            supabase.from("results").select("*").limit(1),
          ]);
          if(ents) setEntries(sortEntriesBySubmittedAt(ents));
          if(res&&res[0]) setResults(applyOfficialR32Matches(res[0].data));
        } catch(e) {
          // Log connection issues to the console
          console.error("Error connecting to Supabase database:", e);
        }
      }
      try {
        const draft=localStorage.getItem("wc26-draft");
        if(draft){const{name:n,preds:p}=JSON.parse(draft);if(n)setName(n);if(p)setPreds(applyOfficialR32Matches(p));}
      } catch {
        // Ignore draft parse errors
      }
      setLoading(false);
    })();
  },[]);

  // Realtime updates (only if not in demo mode)
  useEffect(()=>{
    if (isDemoMode) return;
    const entriesSub = supabase.channel("entries-changes")
      .on("postgres_changes", { event:"*", schema:"public", table:"entries" }, async()=>{
        const { data } = await supabase.from("entries").select("*").order("submitted_at", { ascending: true });
        if(data) setEntries(sortEntriesBySubmittedAt(data));
      }).subscribe();
    const resultsSub = supabase.channel("results-changes")
      .on("postgres_changes", { event:"*", schema:"public", table:"results" }, async()=>{
        const { data } = await supabase.from("results").select("*").limit(1);
        if(data&&data[0]) setResults(applyOfficialR32Matches(data[0].data));
      }).subscribe();
    return ()=>{ supabase.removeChannel(entriesSub); supabase.removeChannel(resultsSub); };
  },[]);

  const saveDraft=useCallback((n,p)=>{ try{localStorage.setItem("wc26-draft",JSON.stringify({name:n,preds:p}));}catch{ /* ignore */ } },[]);
  const setF=useCallback((key,field,val)=>{ setPreds(p=>{const u={...p,[key]:{...p[key],[field]:val}};saveDraft(name,u);return u;});setSaved(false); },[name,saveDraft]);
  const setTop=useCallback((field,val)=>{ setPreds(p=>{const u={...p,[field]:val};saveDraft(name,u);return u;});setSaved(false); },[name,saveDraft]);
  const handleSetName=useCallback((n)=>{setName(n);setSaved(false);saveDraft(n,preds);},[preds,saveDraft]);

  const autoSlots=useMemo(()=>{
    const seedPreds=results&&allGroupsComplete(results)?results:preds;
    const slots={}, thirdsMap=resolveAllThirds(seedPreds);
    const r32Resolved=R32_PAIRS.map(([sA,sB],i)=>{
      const official=OFFICIAL_R32_MATCHES[i];
      const autoA=official?.teamA||(sA.startsWith("3")?(thirdsMap.get(sA)??null):resolveGroupSlot(sA,seedPreds));
      const autoB=official?.teamB||(sB.startsWith("3")?(thirdsMap.get(sB)??null):resolveGroupSlot(sB,seedPreds));
      const tA=autoA||(preds[`r32_${i}`]?.teamA||null);
      const tB=autoB||(preds[`r32_${i}`]?.teamB||null);
      slots[`r32_${i}`]={teamA:tA,teamB:tB};
      const p=preds[`r32_${i}`],sA2=parseInt(p?.scoreA),sB2=parseInt(p?.scoreB);
      const hasScore=!isNaN(sA2)&&!isNaN(sB2)&&p?.scoreA!==""&&p?.scoreB!=="";
      return{teamA:tA,teamB:tB,winner:hasScore&&tA&&tB?(sA2>sB2?tA:sB2>sA2?tB:null):null};
    });
    const r16Winners=R16_PAIRS.map(([a,b],i)=>{
      const tA=r32Resolved[a]?.winner||(preds[`r16_${i}`]?.teamA||null);
      const tB=r32Resolved[b]?.winner||(preds[`r16_${i}`]?.teamB||null);
      slots[`r16_${i}`]={teamA:tA,teamB:tB};
      const p=preds[`r16_${i}`],sA=parseInt(p?.scoreA),sB=parseInt(p?.scoreB);
      const hasScore=!isNaN(sA)&&!isNaN(sB)&&p?.scoreA!==""&&p?.scoreB!=="";
      return hasScore&&tA&&tB?(sA>sB?tA:sB>sA?tB:null):null;
    });
    const qfWinners=QF_PAIRS.map(([a,b],i)=>{
      const tA=r16Winners[a]||(preds[`qf_${i}`]?.teamA||null);
      const tB=r16Winners[b]||(preds[`qf_${i}`]?.teamB||null);
      slots[`qf_${i}`]={teamA:tA,teamB:tB};
      const p=preds[`qf_${i}`],sA=parseInt(p?.scoreA),sB=parseInt(p?.scoreB);
      const hasScore=!isNaN(sA)&&!isNaN(sB)&&p?.scoreA!==""&&p?.scoreB!=="";
      return hasScore&&tA&&tB?(sA>sB?tA:sB>sA?tB:null):null;
    });
    const sfLosers=SF_PAIRS.map(([a,b],i)=>{
      const tA=qfWinners[a]||(preds[`sf_${i}`]?.teamA||null);
      const tB=qfWinners[b]||(preds[`sf_${i}`]?.teamB||null);
      slots[`sf_${i}`]={teamA:tA,teamB:tB};
      const p=preds[`sf_${i}`],sA=parseInt(p?.scoreA),sB=parseInt(p?.scoreB);
      const hasScore=!isNaN(sA)&&!isNaN(sB)&&p?.scoreA!==""&&p?.scoreB!=="";
      return hasScore&&tA&&tB?(sA>sB?tB:sB>sA?tA:null):null;
    });
    slots[`tp_0`]={teamA:sfLosers[0]??null,teamB:sfLosers[1]??null};
    return slots;
  },[preds,results]);

  async function submit(){
    if(!name.trim()){flash("⚠️ Escribe tu nombre primero");return;}
    
    // Merge auto-calculated bracket values into predictions for submission
    const mergedPreds = { ...preds };
    Object.entries(autoSlots).forEach(([k, { teamA, teamB }]) => {
      if (teamA) mergedPreds[k] = { ...mergedPreds[k], teamA };
      if (teamB) mergedPreds[k] = { ...mergedPreds[k], teamB };
    });
    
    const trimmedName=name.trim();
    const entryName=formatEntryName(trimmedName);
    const payload={name:entryName,predictions:mergedPreds};
    const existing=entries.find(e=>e.name.toLowerCase()===entryName.toLowerCase());
    
    if (isDemoMode) {
      const submittedAt = new Date().toISOString();
      const nextEntries = existing
        ? entries.map(e => e.id === existing.id ? { ...e, ...payload, submitted_at: submittedAt } : e)
        : [...entries, { id: Date.now(), ...payload, submitted_at: submittedAt }];
        
      const sortedEntries = sortEntriesBySubmittedAt(nextEntries);
      saveLocalEntries(sortedEntries);
      setEntries(sortedEntries);
      setSaved(true);
      localStorage.removeItem("wc26-draft");
      flash("✅ ¡Quiniela enviada con éxito (Guardada localmente)!");
      return;
    }

    try {
      const { entry, editToken } = await submitEntry({
        ...payload,
        editToken: getEntryEditToken(entryName),
      });

      if (editToken) {
        saveEntryEditToken(entryName, editToken);
      }

      setEntries(prev => sortEntriesBySubmittedAt([
        ...prev.filter(e => e.id !== entry.id),
        entry,
      ]));
      setSaved(true);
      localStorage.removeItem("wc26-draft");
      flash(existing ? "✅ ¡Quiniela actualizada!" : "✅ ¡Quiniela enviada!");
    } catch (error) {
      flash("❌ Error: " + error.message);
    }
  }

  async function saveResults(r){
    const normalizedResults = applyOfficialR32Matches(r);
    if (isDemoMode) {
      saveLocalResults(normalizedResults);
      setResults(normalizedResults);
      flash("✅ Resultados guardados localmente");
      return;
    }

    try {
      await saveResultsRemote(normalizedResults);
      setResults(normalizedResults);
      flash("✅ Resultados guardados");
    } catch (error) {
      try {
        await saveResultsDirect(normalizedResults);
        setResults(normalizedResults);
        flash("✅ Resultados guardados en Supabase");
      } catch (directError) {
        flash("❌ Error: " + (directError.message || error.message));
      }
    }
  }

  async function delEntry(id,password){
    if (isDemoMode) {
      const remainingEntries = entries.filter(e => e.id !== id);
      saveLocalEntries(remainingEntries);
      setEntries(remainingEntries);
      flash("🗑️ Quiniela eliminada");
      return;
    }

    try {
      await deleteEntryRemote(id, password);
      setEntries(prev=>prev.filter(e=>e.id!==id));
      flash("🗑️ Quiniela eliminada");
    } catch (error) {
      flash("❌ Error: " + error.message);
    }
  }

  if(loading) return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:c.primary,color:"white",fontSize:18,fontWeight:700,gap:16}}><div>⚽</div><div>Cargando quiniela...</div></div>;

  return (
    <div style={{fontFamily:"var(--font-sans)",minHeight:"100vh",background:"transparent",color:c.ink}}>
      {/* Header Container */}
      <div style={{background:c.primary, position:"relative", overflow:"hidden", borderBottom:`4px solid ${c.accent}`}}>
        {/* Dynamic decorative strip */}
        <div style={{height:6,background:`repeating-linear-gradient(90deg,${c.accent} 0 34px,#0a2e17 34px 50px)`}}/>
        <div style={{maxWidth:960,margin:"0 auto",padding:"30px 20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <span style={{fontSize:"clamp(32px, 6vw, 48px)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))"}}>🏆</span>
            <div>
              <div style={{fontFamily:"var(--font-heading)",fontSize:"clamp(24px,5vw,40px)",fontWeight:900,lineHeight:1,color:"white", letterSpacing:"-1px"}}>
                QUINIELA <span style={{color:c.accent, textShadow:"0 2px 10px rgba(245,197,24,0.3)"}}>MUNDIAL</span> 2026
              </div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:13,marginTop:4, fontWeight:500}}>
                🇲🇽 México · 🇺🇸 EE.UU. · 🇨🇦 Canadá &nbsp;·&nbsp; 48 Equipos &nbsp;·&nbsp; 104 Partidos
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10, background:"rgba(0,0,0,0.18)", padding:5, borderRadius:12}}>
            {[["fill","📝 Mi Quiniela"],["admin","📊 Panel de Control"]].map(([v,lbl])=>(
              <button 
                key={v} 
                className="btn" 
                style={{
                  padding:"8px 16px",
                  fontSize:13,
                  boxShadow:"none",
                  borderRadius:8,
                  background:view===v?c.accent:"transparent",
                  color:view===v?c.primary:"rgba(255,255,255,0.8)"
                }} 
                onClick={()=>setView(v)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Mode Alert Banner */}
      {isDemoMode && (
        <div style={{
          background:"rgba(245, 197, 24, 0.12)",
          borderBottom:`1.5px solid rgba(245,197,24,0.3)`,
          backdropFilter: "blur(10px)",
          color:"#725103",
          padding:"12px 20px"
        }}>
          <div style={{maxWidth:960, margin:"0 auto", display:"flex", alignItems:"center", gap:12, fontSize:13, fontWeight:600}}>
            <span style={{fontSize:16}}>⚙️</span>
            <span style={{flex:1}}>
              <strong>Modo de Demostración Activo:</strong> No se han detectado credenciales de Supabase. La quiniela está funcionando en modo offline; todos los datos se guardarán en la memoria local de tu navegador. Configura el archivo <code>.env</code> para habilitar la base de datos compartida.
            </span>
          </div>
        </div>
      )}

      {/* Main views */}
      <div style={{maxWidth:960, margin:"0 auto", padding:"24px 20px 80px"}}>
        {view==="fill"
          ?<FillView name={name} setName={handleSetName} preds={preds} setF={setF} setTop={setTop} submit={submit} saved={saved} autoSlots={autoSlots} results={results}/>
          :<AdminView key={results ? "loaded" : "loading"} entries={entries} results={results} saveResults={saveResults} delEntry={delEntry} tab={adminTab} setTab={setAdminTab}/>
        }
      </div>
      
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:c.primary,color:"white",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:9999,boxShadow:"0 10px 32px rgba(0,0,0,.25)",whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:10}}>{toast}</div>}
    </div>
  );
}

// ── Componentes de Relleno (FillView) ──

function FillView({name,setName,preds,setF,setTop,submit,saved,autoSlots,results}){
  const officialGroupResultsReady=useMemo(()=>allGroupsComplete(results),[results]);
  const groupDisplayPreds=officialGroupResultsReady?results:preds;
  const standings=useMemo(()=>{const s={};GROUPS.forEach(g=>{s[g.name]=calcStandings(g.name,groupDisplayPreds);});return s;},[groupDisplayPreds]);
  const icons={r32:"⚡",r16:"🎯",qf:"🔥",sf:"⭐",tp:"🥉"};
  
  return (
    <div>
      {/* User Info & Instructions */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:16, marginBottom:24}}>
        <div className="quiniela-card" style={{padding:"18px 24px", display:"flex", alignItems:"center", gap:14}}>
          <span style={{fontSize:24}}>👤</span>
          <div style={{flex:1}}>
            <label style={{fontSize:11, fontWeight:800, color:c.gray600, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5}}>Tu Nombre:</label>
            <input 
              className="quiniela-input-text" 
              style={{width:"100%", boxSizing:"border-box"}}
              placeholder="Ej. Michelle Giraud" 
              value={name} 
              onChange={e=>setName(e.target.value)}
            />
            <div style={{fontSize:11,color:c.gray400,marginTop:6,fontWeight:600}}>
              Se guardará como: {ENTRY_NAME_PREFIX}{name.trim()?` - ${name.trim()}`:" - Tu Nombre"}
            </div>
          </div>
        </div>
        <div className="quiniela-card" style={{padding:"18px 24px", display:"flex", flexDirection:"column", justifyContent:"center"}}>
          <div style={{fontSize:11, fontWeight:800, color:c.gray600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>Puntuación:</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:12}}>
            {[["+3", "Marcador exacto"], ["+1", "Resultado (+ganador)"], ["×Rnd", "Fase final multiplica"]].map(([p,d])=>(
              <div key={p} style={{display:"flex",alignItems:"center",gap:6,fontSize:11, fontWeight:600}}>
                <span style={{background:c.primaryMid,color:"white",fontWeight:900,fontSize:10,padding:"2px 6px",borderRadius:4}}>{p}</span>
                <span style={{color:c.gray600}}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fase de Grupos */}
      <SectionTitle icon="🏟️" label="Fase de Grupos" badge="11 – 27 Jun" />
      <div style={{background:"rgba(245, 197, 24, 0.12)",borderRadius:12,border:`1.5px solid rgba(245,197,24,0.3)`,padding:"14px 16px",marginBottom:16,color:"#725103",fontSize:13,fontWeight:700}}>
        La fase de grupos está cerrada y no se puede editar.
        {officialGroupResultsReady ? " Aquí ves los resultados oficiales." : " Los resultados oficiales aparecerán aquí cuando estén cargados."}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16,marginBottom:32}}>
        {GROUPS.map(g=><GroupCard key={g.name} g={g} preds={groupDisplayPreds} setF={setF} standings={standings[g.name]} results={results} lockResults={true}/>)}
      </div>

      {/* Fase Eliminatoria */}
      {KNOCKOUT_ROUNDS.map(r=>(
        <div key={r.id}>
          <SectionTitle icon={icons[r.id]} label={r.label} badge={r.badge}/>
          {r.id==="r32"&&(
            <div style={{background:"rgba(26,122,64,0.05)",borderRadius:12,border:`1.5px solid rgba(26,122,64,0.18)`,padding:"14px 16px",marginBottom:20,textAlign:"center",color:c.primaryMid,fontSize:13,fontWeight:700}}>
              ✅ Esta ronda ya está cargada con los partidos oficiales de la Eliminatoria de 32.
            </div>
          )}
          {r.id!=="r32"&&(
            <div style={{background:"rgba(0,0,0,0.03)",borderRadius:12,border:`1.5px dashed ${c.gray200}`,padding:"14px 16px",marginBottom:20,textAlign:"center",color:c.gray600,fontSize:13,fontWeight:700}}>
              🔒 Esta ronda aún no se puede rellenar. Por ahora solo está habilitada la Ronda de 32.
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:12,marginBottom:28}}>
            {Array.from({length:r.count},(_,i)=>{
              const auto=autoSlots[`${r.id}_${i}`]||{};
              return <KOCard key={i} rid={r.id} idx={i} preds={preds} setF={setF} autoA={auto.teamA} autoB={auto.teamB} editable={r.id==="r32"}/>;
            })}
          </div>
        </div>
      ))}

      {/* Campeón y Goleador */}
      <SectionTitle icon="🏆" label="Final &amp; Campeón" badge="19 Jul · New York / New Jersey"/>
      <div style={{background:"rgba(0,0,0,0.03)",borderRadius:12,border:`1.5px dashed ${c.gray200}`,padding:"14px 16px",marginBottom:20,textAlign:"center",color:c.gray600,fontSize:13,fontWeight:700}}>
        🔒 La final, campeón y goleador se habilitarán después. Por ahora solo está habilitada la Ronda de 32.
      </div>
      <ChampCard preds={preds} setTop={setTop} editable={false}/>

      {/* Submit Action */}
      <div style={{textAlign:"center",marginTop:40,paddingTop:24,borderTop:`2px solid ${c.gray100}`}}>
        {saved ? (
          <div style={{background:"rgba(26,122,64,0.12)", color:c.primaryMid, fontWeight:800, padding:"12px 32px", borderRadius:12, display:"inline-block", border:`1.5px solid ${c.primaryMid}`}}>
            ✅ ¡Tu quiniela ha sido enviada y guardada con éxito!
          </div>
        ) : (
          <button className="btn btn-primary" style={{fontSize:16, padding:"14px 44px", borderRadius:12}} onClick={submit}>
            🚀 Enviar Mi Quiniela
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({icon,label,badge}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginTop:32,marginBottom:16,paddingBottom:8,borderBottom:`2.5px solid ${c.primaryMid}`}}>
      <span style={{fontFamily:"var(--font-heading)",fontWeight:900,fontSize:20,color:c.primaryMid}} dangerouslySetInnerHTML={{__html:`${icon} ${label}`}}/>
      <span style={{background:c.primaryMid,color:"white",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6, textTransform:"uppercase", letterSpacing:0.5}}>{badge}</span>
    </div>
  );
}

function GroupCard({g,preds,setF,standings,results,lockResults}){
  return (
    <div className="quiniela-card" style={{overflow:"hidden", display:"flex", flexDirection:"column"}}>
      <div style={{background:c.primaryMid,color:"white",padding:"10px 16px",fontWeight:900,fontSize:14,fontFamily:"var(--font-heading)", letterSpacing:0.5, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span>GRUPO <span style={{color:c.accent}}>{g.name}</span></span>
        <span style={{fontSize:11, opacity:0.75}}>Fase de Grupos</span>
      </div>
      
      {/* Matches List */}
      <div style={{padding:"8px 0", flexGrow:1}}>
        {g.matches.map((m,i)=>{
          const k=`G${g.name}_${i}`,p=preds[k]||{},official=results?.[k];
          const hasOfficial=official&&official.home!==""&&official.away!=="";
          return (
            <div key={i} className="standing-row" style={{padding:"8px 12px",borderBottom:`1px solid ${c.gray100}`,background:hasOfficial?"rgba(26,122,64,0.025)":"transparent"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto 1fr",alignItems:"center",gap:8}}>
              {/* Home Team */}
                <div style={{textAlign:"right",fontWeight:700,fontSize:12, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6}}>
                <span style={{whiteSpace:"nowrap"}}>{m[0]}</span>
                <span style={{fontSize:14}}>{getTeamFlag(m[0])}</span>
                </div>
              
              {/* Home Input */}
                <input 
                  className="quiniela-input-num" 
                  type="number" 
                  min={0} 
                  max={20} 
                  value={p.home||""} 
                  placeholder="–" 
                  readOnly={lockResults}
                  disabled={lockResults}
                  onChange={e=>setF(k,"home",e.target.value)}
                  style={lockResults?{opacity:0.55,cursor:"not-allowed",background:c.gray50}:{}} 
                />
              
                <span style={{color:c.gray400,fontWeight:800,fontSize:12}}>–</span>
              
              {/* Away Input */}
                <input 
                  className="quiniela-input-num" 
                  type="number" 
                  min={0} 
                  max={20} 
                  value={p.away||""} 
                  placeholder="–" 
                  readOnly={lockResults}
                  disabled={lockResults}
                  onChange={e=>setF(k,"away",e.target.value)}
                  style={lockResults?{opacity:0.55,cursor:"not-allowed",background:c.gray50}:{}} 
                />
              
              {/* Away Team */}
                <div style={{textAlign:"left",fontWeight:700,fontSize:12, display:"flex", alignItems:"center", gap:6}}>
                <span style={{fontSize:14}}>{getTeamFlag(m[1])}</span>
                <span style={{whiteSpace:"nowrap"}}>{m[1]}</span>
                </div>
              </div>
              {hasOfficial&&(
                <div style={{display:"flex",justifyContent:"center",marginTop:6}}>
                  <span style={{fontSize:10,fontWeight:800,color:c.primaryMid,background:"rgba(26,122,64,0.08)",border:`1px solid rgba(26,122,64,0.16)`,borderRadius:999,padding:"4px 10px",letterSpacing:0.2}}>
                    Resultado real: {official.home} - {official.away}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Mini Standings Table */}
      {standings.some(s=>s.pts>0||s.gf>0)&&(
        <div style={{borderTop:`1.5px solid ${c.gray100}`,padding:"8px 0", background:"rgba(26,122,64,0.02)"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"0 16px 4px", fontSize:9, fontWeight:800, color:c.gray400, textTransform:"uppercase"}}>
            <span style={{width:12}}>#</span>
            <span style={{flex:1}}>Equipo</span>
            <span style={{width:16,textAlign:"center"}}>G</span>
            <span style={{width:16,textAlign:"center"}}>E</span>
            <span style={{width:16,textAlign:"center"}}>P</span>
            <span style={{width:20,textAlign:"center"}}>DG</span>
            <span style={{width:22,textAlign:"right"}}>Pts</span>
          </div>
          {standings.map((s,i)=>(
            <div key={s.team} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 16px",background:i<2?"rgba(26,122,64,0.06)":"transparent"}}>
              <span style={{fontSize:10,fontWeight:900,color:i<2?c.primaryMid:c.gray400,width:12}}>{i+1}</span>
              <span style={{flex:1,fontSize:11,fontWeight:i<2?700:500, display:"flex", alignItems:"center", gap:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                <span>{getTeamFlag(s.team)}</span>
                <span>{s.team}</span>
              </span>
              {["w","d","l"].map(k=><span key={k} style={{fontSize:10,color:c.gray600,width:16,textAlign:"center"}}>{s[k]}</span>)}
              <span style={{fontSize:10,color:c.gray600,width:20,textAlign:"center",fontWeight:600}}>{s.gd>0?"+":""}{s.gd}</span>
              <span style={{fontSize:11,fontWeight:800,color:i<2?c.primaryMid:c.ink,width:22,textAlign:"right"}}>{s.pts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KOCard({rid,idx,preds,setF,autoA,autoB,editable}){
  const k=`${rid}_${idx}`,p=preds[k]||{};
  const valA=autoA||p.teamA||"",valB=autoB||p.teamB||"";
  const resolvedA=!!autoA,resolvedB=!!autoB;
  const locked=!editable;
  const sA=parseInt(p.scoreA),sB=parseInt(p.scoreB);
  const hasScore=!isNaN(sA)&&!isNaN(sB)&&p.scoreA!==""&&p.scoreB!=="";
  const winA=hasScore&&sA>sB,winB=hasScore&&sB>sA;
  
  return (
    <div className="quiniela-card" style={{overflow:"hidden", border:hasScore?`1.5px solid rgba(26,122,64,0.3)`:`1.5px solid var(--white)`}}>
      <div style={{background:hasScore?"#1d432b":"#2a5545",color:"white",padding:"6px 12px",fontSize:10,fontWeight:800,display:"flex",justifyContent:"space-between",alignItems:"center", letterSpacing:0.5}}>
        <span>PARTIDO {idx+1}</span>
        {(resolvedA||resolvedB) && <span style={{color:c.accent,fontSize:9, fontWeight:800}}>✓ AUTO</span>}
      </div>
      <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
        {/* Team A Row */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{getTeamFlag(valA)}</span>
          <input 
            className="quiniela-input-text"
            style={{
              flex:1, 
              padding:"5px 10px", 
              fontSize:12,
              background:resolvedA?"rgba(26,122,64,0.06)":"#fff",
              borderColor:winA?"rgba(26,122,64,0.4)":"var(--gray-200)",
              fontWeight:winA||resolvedA?700:500
            }}
            type="text" 
            placeholder="Equipo A" 
            value={valA} 
            readOnly={resolvedA||locked} 
            disabled={locked}
            onChange={e=>{if(!resolvedA&&!locked)setF(k,"teamA",e.target.value);}}
          />
          <input 
            className="quiniela-input-num"
            type="number" 
            min={0} 
            max={20} 
            value={p.scoreA||""} 
            placeholder="0" 
            readOnly={locked}
            disabled={locked}
            style={locked?{opacity:0.55,cursor:"not-allowed",background:c.gray50}:undefined}
            onChange={e=>setF(k,"scoreA",e.target.value)}
          />
        </div>
        
        {/* Team B Row */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{getTeamFlag(valB)}</span>
          <input 
            className="quiniela-input-text"
            style={{
              flex:1, 
              padding:"5px 10px", 
              fontSize:12,
              background:resolvedB?"rgba(26,122,64,0.06)":"#fff",
              borderColor:winB?"rgba(26,122,64,0.4)":"var(--gray-200)",
              fontWeight:winB||resolvedB?700:500
            }}
            type="text" 
            placeholder="Equipo B" 
            value={valB} 
            readOnly={resolvedB||locked} 
            disabled={locked}
            onChange={e=>{if(!resolvedB&&!locked)setF(k,"teamB",e.target.value);}}
          />
          <input 
            className="quiniela-input-num"
            type="number" 
            min={0} 
            max={20} 
            value={p.scoreB||""} 
            placeholder="0" 
            readOnly={locked}
            disabled={locked}
            style={locked?{opacity:0.55,cursor:"not-allowed",background:c.gray50}:undefined}
            onChange={e=>setF(k,"scoreB",e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function ChampCard({preds,setTop,editable}){
  return (
    <div style={{
      background:`linear-gradient(135deg, ${c.primary}, #061a0d)`,
      borderRadius:18,
      padding:"28px 24px",
      color:"white",
      textAlign:"center",
      boxShadow: "var(--shadow-lg)",
      border: `2px solid ${c.accent}`,
      position:"relative",
      overflow:"hidden"
    }}>
      {/* Background decorations */}
      <div style={{position:"absolute", top:-10, right:-10, fontSize:90, opacity:0.15, transform:"rotate(15deg)"}}>🏆</div>
      
      <div style={{fontFamily:"var(--font-heading)",fontWeight:900,fontSize:22,color:c.accent,marginBottom:20, letterSpacing:0.5}}>
        🏆 PREDICE EL CAMPEÓN DEL MUNDO
      </div>
      
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,flexWrap:"wrap", position:"relative", zIndex:2}}>
        {[["champion","FINALISTA 1 / CAMPEÓN"],["finalist","FINALISTA 2"]].map(([f,lbl],ii)=>(
          <div key={f} style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
            <label style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:800, letterSpacing:0.5}}>{lbl}</label>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontSize:22}}>{getTeamFlag(preds[f])}</span>
              <input 
                className="quiniela-input-text"
                style={{
                  width:170,
                  background:editable?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
                  border:`2px solid rgba(245,197,24,0.3)`,
                  color:"white",
                  fontSize:13,
                  fontWeight:700,
                  textAlign:"center",
                  opacity:editable?1:0.6,
                  cursor:editable?"text":"not-allowed"
                }} 
                placeholder="Escribe el país..." 
                value={preds[f]||""} 
                readOnly={!editable}
                disabled={!editable}
                onChange={e=>setTop(f,e.target.value)}
              />
            </div>
            {ii===0&&(
              <div style={{display:"flex",alignItems:"center",gap:8, marginTop:4}}>
                <input 
                  className="quiniela-input-num"
                  style={{width:48,height:40,background:editable?"rgba(255,255,255,.08)":"rgba(255,255,255,.04)",border:`1.5px solid rgba(245,197,24,.3)`,fontSize:18,color:c.accent,opacity:editable?1:0.6,cursor:editable?"text":"not-allowed"}} 
                  type="number" 
                  min={0} 
                  max={20} 
                  value={preds.finalScoreA||""} 
                  placeholder="0" 
                  readOnly={!editable}
                  disabled={!editable}
                  onChange={e=>setTop("finalScoreA",e.target.value)}
                />
                <span style={{color:"rgba(255,255,255,.4)",fontSize:20,fontWeight:800}}>–</span>
                <input 
                  className="quiniela-input-num"
                  style={{width:48,height:40,background:editable?"rgba(255,255,255,.08)":"rgba(255,255,255,.04)",border:`1.5px solid rgba(245,197,24,.3)`,fontSize:18,color:c.accent,opacity:editable?1:0.6,cursor:editable?"text":"not-allowed"}} 
                  type="number" 
                  min={0} 
                  max={20} 
                  value={preds.finalScoreB||""} 
                  placeholder="0" 
                  readOnly={!editable}
                  disabled={!editable}
                  onChange={e=>setTop("finalScoreB",e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div style={{marginTop:24,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.12)", position:"relative", zIndex:2}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:800,marginBottom:6, letterSpacing:0.5}}>⚽ MÁXIMO GOLEADOR DEL TORNEO</div>
        <input 
          className="quiniela-input-text"
          style={{
            width:220,
            background:editable?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
            border:`2px solid rgba(245,197,24,0.3)`,
            color:"white",
            fontSize:13,
            fontWeight:700,
            textAlign:"center",
            opacity:editable?1:0.6,
            cursor:editable?"text":"not-allowed"
          }} 
          placeholder="Nombre del jugador..." 
          value={preds.topScorer||""} 
          readOnly={!editable}
          disabled={!editable}
          onChange={e=>setTop("topScorer",e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Vistas de Administrador (AdminView) ──

function AdminView({entries,results,saveResults,delEntry,tab,setTab}){
  const [editR,setEditR]=useState(results||emptyPredictions());
  const scores=[...entries].map(e=>({...e,pts:scoreEntry(e.predictions,results)})).sort((a,b)=>(b.pts||0)-(a.pts||0));
  
  return (
    <div style={{marginTop:8}}>
      <div style={{background:"rgba(10, 46, 23, 0.05)", borderRadius:12, padding:6, display:"flex", gap:6, marginBottom:24}}>
        {[["entries","📋 Quinielas Recibidas"],["results","⚽ Cargar Resultados"],["leaderboard","🏆 Tabla de Posiciones"]].map(([id,lbl])=>(
          <button 
            key={id} 
            onClick={()=>setTab(id)} 
            className="btn"
            style={{
              flex:1,
              padding:"10px 14px",
              boxShadow:"none",
              borderRadius:8,
              fontSize:13,
              background:tab===id?c.primaryMid:"transparent",
              color:tab===id?"white":c.gray600
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
      
      <div style={{minHeight:300}}>
        {tab==="entries"&&<EntriesTab entries={entries} results={results} delEntry={delEntry}/>}
        {tab==="results"&&<ResultsTab editR={editR} setEditR={setEditR} saveResults={saveResults}/>}
        {tab==="leaderboard"&&<LeaderboardTab scores={scores} results={results}/>}
      </div>
    </div>
  );
}

function EntriesTab({entries,results,delEntry}){
  const [sel,setSel]=useState(null);
  if(!entries.length) return (
    <div className="quiniela-card" style={{textAlign:"center",padding:"60px 20px",color:c.gray400}}>
      <div style={{fontSize:44,marginBottom:10}}>📭</div>
      <div style={{fontWeight:700, color:c.gray600}}>Aún no se han enviado quinielas.</div>
    </div>
  );
  const entry=sel?entries.find(e=>e.id===sel):null;
  const isRound32Entry=entry?isRound32EntryName(entry.name):false;
  const entryTotalPts=entry&&results
    ? (isRound32Entry ? scoreKnockoutRound(entry.predictions,results,"r32") : scoreEntry(entry.predictions,results))
    : null;
  
  return (
    <div>
      <div style={{fontWeight:900,fontSize:18,color:c.primaryMid,marginBottom:16}}>{entries.length} quiniela{entries.length!==1?"s":""} recibida{entries.length!==1?"s":""}</div>
      
      {/* Entries List */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:26}}>
        {entries.map(e=>{
          const pts=results?scoreEntry(e.predictions,results):null;
          const isSelected = sel === e.id;
          return (
            <div 
              key={e.id} 
              onClick={()=>setSel(isSelected?null:e.id)} 
              className="quiniela-card"
              style={{
                padding:"14px 18px",
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                justifyContent:"space-between",
                borderColor:isSelected?c.primaryMid:"var(--white)",
                borderWidth:isSelected?2:1.5
              }}
            >
              <div>
                <div style={{fontWeight:800,fontSize:14, color:c.ink}}>{e.name}</div>
                <div style={{fontSize:11,color:c.gray400,marginTop:2}}>
                  {new Date(e.submitted_at).toLocaleDateString("es-ES",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {pts!==null&&<span style={{background:c.accent,color:c.primary,fontWeight:900,fontSize:12,padding:"4px 8px",borderRadius:6}}>{pts} pts</span>}
                <button 
                  className="btn" 
                  style={{background:"#ffebee",color:"#c62828",padding:"6px 10px",fontSize:11, boxShadow:"none", borderRadius:6}} 
                  onClick={ev=>{
                    ev.stopPropagation();
                    if (!confirm(`¿Seguro que deseas eliminar la quiniela de ${e.name}?`)) {
                      return;
                    }
                    const password = window.prompt("Introduce la contraseña para eliminar esta quiniela:");
                    if (password === null) {
                      return;
                    }
                    delEntry(e.id, password);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Detailed Entry view */}
      {entry&&(
        <div className="quiniela-card" style={{padding:"24px", background:"rgba(255, 255, 255, 0.9)"}}>
          <div style={{fontWeight:900,fontSize:18,color:c.primaryMid,marginBottom:16,paddingBottom:10,borderBottom:`3px solid ${c.primaryMid}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span>📋 Quiniela Detallada: {entry.name}</span>
            {results && entryTotalPts!==null && <span style={{fontSize:14,color:c.primaryMid,background:"rgba(26,122,64,0.1)",padding:"4px 12px",borderRadius:6}}>{isRound32Entry?"R32":"Total"}: {entryTotalPts} puntos</span>}
          </div>
          
          {!isRound32Entry&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16,marginBottom:24}}>
              {GROUPS.map(g=>{
                const gPts=g.matches.reduce((s,_,i)=>{const p=groupMatchPts(entry.predictions[`G${g.name}_${i}`],results?.[`G${g.name}_${i}`]);return s+(p||0);},0);
                return (
                  <div key={g.name} className="quiniela-card" style={{overflow:"hidden", border:"1.5px solid var(--gray-100)"}}>
                    <div style={{background:c.primaryMid,color:"white",padding:"8px 12px",fontWeight:900,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>GRUPO <span style={{color:c.accent}}>{g.name}</span></span>
                      {results&&<span style={{background:"rgba(245,197,24,.2)",color:c.accent,fontSize:11,fontWeight:900,padding:"1px 6px",borderRadius:4}}>{gPts} pt</span>}
                    </div>
                    {g.matches.map((m,i)=>{
                      const k=`G${g.name}_${i}`,p=entry.predictions[k]||{},rr=results?.[k];
                      const pts=groupMatchPts(p,rr),played=rr&&rr.home!==""&&rr.away!=="";
                      
                      let bg = "white";
                      if (played) {
                        bg = pts === 3 ? "rgba(26,122,64,0.08)" : pts === 1 ? "rgba(26,122,64,0.03)" : "rgba(0,0,0,0.02)";
                      }
                      
                      return (
                        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto 1fr",alignItems:"center",padding:"6px 12px",borderBottom:`1px solid ${c.gray100}`,background:bg,gap:6}}>
                          <div style={{textAlign:"right",fontWeight:600,fontSize:11, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4}}>
                            <span>{m[0]}</span>
                            <span>{getTeamFlag(m[0])}</span>
                          </div>
                          <div style={{textAlign:"center",minWidth:60}}>
                            <div style={{fontWeight:800,fontSize:12,color:c.primaryMid}}>{p.home!==""&&p.away!==""?`${p.home}–${p.away}`:"–"}</div>
                            {played&&<div style={{fontSize:9,color:c.gray400}}>Real: {rr.home}–{rr.away}</div>}
                          </div>
                          <div style={{minWidth:24,textAlign:"center"}}>
                            {played&&pts!==null&&<span style={{fontSize:10,fontWeight:900,color:"white",background:pts===3?c.primaryMid:pts===1?c.primaryLight:"#bbb",borderRadius:4,padding:"1px 5px"}}>{pts>0?`+${pts}`:"-"}</span>}
                          </div>
                          <div style={{textAlign:"left",fontWeight:600,fontSize:11, display:"flex", alignItems:"center", gap:4}}>
                            <span>{getTeamFlag(m[1])}</span>
                            <span>{m[1]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {(isRound32Entry?KNOCKOUT_ROUNDS.filter(r=>r.id==="r32"):KNOCKOUT_ROUNDS).map(r=>{
            const bonus=KO_BONUS[r.id]??1;
            return (
              <div key={r.id} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:6,borderBottom:`1.5px solid ${c.primaryMid}`}}>
                  <span style={{fontWeight:900,fontSize:14,color:c.primaryMid}}>{{"r32":"⚡","r16":"🎯","qf":"🔥","sf":"⭐","tp":"🥉"}[r.id]} {r.label}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                  {Array.from({length:r.count},(_,i)=>{
                    const p=entry.predictions[`${r.id}_${i}`]||{},res=results?.[`${r.id}_${i}`];
                    const pA=parseInt(p.scoreA),pB=parseInt(p.scoreB),rA=parseInt(res?.scoreA),rB=parseInt(res?.scoreB);
                    const played=res&&res.teamA&&!isNaN(rA)&&!isNaN(rB);
                    const pW=!isNaN(pA)&&!isNaN(pB)?(pA>pB?p.teamA:pA<pB?p.teamB:null):null;
                    const rW=played?(rA>rB?res.teamA:rA<rB?res.teamB:null):null;
                    const winOk=pW&&rW&&pW.trim().toLowerCase()===rW.trim().toLowerCase();
                    const exactOk=played&&!isNaN(pA)&&!isNaN(pB)&&pA===rA&&pB===rB;
                    const pts=(winOk?bonus:0)+(exactOk?bonus:0);
                    
                    let bg = "white";
                    if (played) {
                      bg = exactOk ? "rgba(26,122,64,0.08)" : winOk ? "rgba(26,122,64,0.03)" : "rgba(0,0,0,0.02)";
                    }
                    
                    return (
                      <div key={i} style={{background:bg,borderRadius:8,border:`1px solid ${c.gray100}`,padding:"8px 12px"}}>
                        <div style={{fontSize:9,color:c.gray400,fontWeight:800,marginBottom:4}}>PARTIDO {i+1}</div>
                        <div style={{display:"flex",alignItems:"center",gap:4, justifyContent:"space-between"}}>
                          <div style={{fontWeight:700,fontSize:11, display:"flex", alignItems:"center", gap:3}}>
                            <span>{getTeamFlag(p.teamA)}</span>
                            <span style={{maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.teamA||"–"}</span>
                          </div>
                          <div style={{textAlign:"center",minWidth:46}}>
                            <div style={{fontWeight:800,fontSize:12,color:c.primaryMid}}>{p.scoreA!==""&&p.scoreB!==""?`${p.scoreA}–${p.scoreB}`:"–"}</div>
                            {played&&<div style={{fontSize:9,color:c.gray400}}>{res.scoreA}–{res.scoreB}</div>}
                          </div>
                          <div style={{fontWeight:700,fontSize:11, display:"flex", alignItems:"center", gap:3}}>
                            <span style={{maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.teamB||"–"}</span>
                            <span>{getTeamFlag(p.teamB)}</span>
                          </div>
                          <span style={{fontSize:10,fontWeight:900,color:pts>0?"white":"#999",background:exactOk?c.primaryMid:winOk?c.primaryLight:"#e0e0e0",borderRadius:4,padding:"1px 5px",minWidth:14,textAlign:"center"}}>{played?(pts>0?`+${pts}`:"-"):"?"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Golden Champion Summary */}
          {!isRound32Entry&&(
            <div style={{
              background:`linear-gradient(135deg, ${c.primary}, #061a0d)`,
              border:`1.5px solid ${c.accent}`,
              borderRadius:14,
              padding:"20px",
              textAlign:"center",
              color:"white",
              marginTop:16
            }}>
              <div style={{color:c.accent,fontWeight:900,fontSize:16,marginBottom:12, fontFamily:"var(--font-heading)"}}>🏆 Campeón &amp; Goleador Pronosticado</div>
              <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
                <div style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"10px 16px", flexGrow:1, maxWidth:240}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",fontWeight:800,marginBottom:6}}>FINALISTA 1 (CAMPEÓN)</div>
                  <div style={{fontWeight:800,fontSize:13,color:c.accent, display:"flex", alignItems:"center", justifyContent:"center", gap:6}}>
                    <span>{getTeamFlag(entry.predictions.champion)}</span>
                    <span>{entry.predictions.champion||"–"}</span>
                  </div>
                  {entry.predictions.finalScoreA!==""&&entry.predictions.finalScoreB!==""&&(
                    <div style={{fontSize:14, fontWeight:900, color:"white", marginTop:4}}>
                      Marcador: {entry.predictions.finalScoreA} - {entry.predictions.finalScoreB}
                    </div>
                  )}
                </div>
                <div style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"10px 16px", flexGrow:1, maxWidth:240}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",fontWeight:800,marginBottom:6}}>FINALISTA 2</div>
                  <div style={{fontWeight:800,fontSize:13,color:"white", display:"flex", alignItems:"center", justifyContent:"center", gap:6}}>
                    <span>{getTeamFlag(entry.predictions.finalist)}</span>
                    <span>{entry.predictions.finalist||"–"}</span>
                  </div>
                </div>
                <div style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"10px 16px", flexGrow:1, maxWidth:240}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",fontWeight:800,marginBottom:6}}>⚽ MÁXIMO GOLEADOR</div>
                  <div style={{fontWeight:800,fontSize:14,color:c.accent}}>🏃‍♂️ {entry.predictions.topScorer||"–"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsTab({editR,setEditR,saveResults}){
  const setF=(k,f,v)=>setEditR(r=>({...r,[k]:{...(r[k]||{}),[f]:v}}));
  
  return (
    <div>
      <div className="quiniela-card" style={{padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:15, color:c.primaryMid}}>Cargar Resultados Oficiales</div>
          <div style={{fontSize:11,color:c.gray400,marginTop:2}}>Introduce los marcadores reales para calcular las clasificaciones de los participantes.</div>
        </div>
        <button className="btn btn-primary" onClick={()=>saveResults(editR)}>💾 Guardar Resultados</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:24}}>
        {GROUPS.map(g=>(
          <div key={g.name} className="quiniela-card" style={{overflow:"hidden"}}>
            <div style={{background:c.primaryMid,color:"white",padding:"8px 14px",fontWeight:900,fontSize:13, fontFamily:"var(--font-heading)"}}>GRUPO {g.name}</div>
            <div style={{padding:"6px 0"}}>
              {g.matches.map((m,i)=>{
                const k=`G${g.name}_${i}`,r=editR[k]||{};
                return (
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto 1fr",alignItems:"center",padding:"6px 12px",borderBottom:`1px solid ${c.gray100}`,gap:8}}>
                    <div style={{textAlign:"right",fontWeight:700,fontSize:12, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4}}>
                      <span>{m[0]}</span>
                      <span>{getTeamFlag(m[0])}</span>
                    </div>
                    <input className="quiniela-input-num" type="number" min={0} max={20} value={r.home||""} placeholder="–" onChange={e=>setF(k,"home",e.target.value)}/>
                    <span style={{color:c.gray200,fontWeight:800,fontSize:12}}>–</span>
                    <input className="quiniela-input-num" type="number" min={0} max={20} value={r.away||""} placeholder="–" onChange={e=>setF(k,"away",e.target.value)}/>
                    <div style={{textAlign:"left",fontWeight:700,fontSize:12, display:"flex", alignItems:"center", gap:4}}>
                      <span>{getTeamFlag(m[1])}</span>
                      <span>{m[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Knockout stage results */}
      <div style={{fontWeight:900,fontSize:16,color:c.primaryMid,marginBottom:14, borderBottom:`2px solid ${c.primaryMid}`, paddingBottom:6}}>Fase de Eliminación Directa (Resultados)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:24}}>
        {KNOCKOUT_ROUNDS.map(r=>(
          <div key={r.id} className="quiniela-card" style={{padding:"14px", display:"flex", flexDirection:"column", gap:10}}>
            <div style={{fontWeight:800, fontSize:12, color:c.primaryMid, borderBottom:`1.5px solid ${c.gray100}`, paddingBottom:4, textTransform:"uppercase"}}>{r.label}</div>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {Array.from({length:r.count},(_,i)=>{
                const k=`${r.id}_${i}`,res=editR[k]||{};
                return (
                  <div key={i} style={{display:"flex", flexDirection:"column", gap:4, borderBottom:i<r.count-1?`1px dashed ${c.gray100}`:`none`, paddingBottom:6}}>
                    <div style={{fontSize:9, color:c.gray400, fontWeight:800}}>PARTIDO {i+1}</div>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>
                      <span style={{fontSize:14}}>{getTeamFlag(res.teamA)}</span>
                      <input className="quiniela-input-text" style={{flex:1, padding:"3px 8px", fontSize:11}} placeholder="Equipo A" value={res.teamA||""} onChange={e=>setF(k,"teamA",e.target.value)}/>
                      <input className="quiniela-input-num" style={{width:32, height:28}} type="number" min={0} max={20} value={res.scoreA||""} onChange={e=>setF(k,"scoreA",e.target.value)}/>
                    </div>
                    <div style={{display:"flex", alignItems:"center", gap:6, marginTop:2}}>
                      <span style={{fontSize:14}}>{getTeamFlag(res.teamB)}</span>
                      <input className="quiniela-input-text" style={{flex:1, padding:"3px 8px", fontSize:11}} placeholder="Equipo B" value={res.teamB||""} onChange={e=>setF(k,"teamB",e.target.value)}/>
                      <input className="quiniela-input-num" style={{width:32, height:28}} type="number" min={0} max={20} value={res.scoreB||""} onChange={e=>setF(k,"scoreB",e.target.value)}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background:`linear-gradient(135deg, ${c.primary}, #061a0d)`,
        borderRadius:14,
        padding:"22px 20px",
        textAlign:"center",
        color:"white",
        marginBottom:24,
        border:`1.5px solid ${c.accent}`
      }}>
        <div style={{color:c.accent,fontWeight:900,fontSize:18,marginBottom:14, fontFamily:"var(--font-heading)"}}>🏆 Resultados de la Gran Final</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexWrap:"wrap",marginBottom:14}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:22}}>{getTeamFlag(editR.champion)}</span>
            <input 
              className="quiniela-input-text"
              style={{width:160,background:"rgba(255,255,255,0.08)",border:`1.5px solid rgba(245,197,24,0.3)`,color:"white",fontSize:13,fontWeight:700,textAlign:"center"}} 
              placeholder="Campeón Real..." 
              value={editR.champion||""} 
              onChange={e=>setEditR(r=>({...r,champion:e.target.value}))}
            />
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:22}}>{getTeamFlag(editR.finalist)}</span>
            <input 
              className="quiniela-input-text"
              style={{width:160,background:"rgba(255,255,255,0.08)",border:`1.5px solid rgba(245,197,24,0.3)`,color:"white",fontSize:13,fontWeight:700,textAlign:"center"}} 
              placeholder="Subcampeón Real..." 
              value={editR.finalist||""} 
              onChange={e=>setEditR(r=>({...r,finalist:e.target.value}))}
            />
          </div>
        </div>
        <div style={{display:"flex", justifyContent:"center", alignItems:"center", gap:8}}>
          <span style={{fontSize:20}}>⚽</span>
          <input 
            className="quiniela-input-text"
            style={{width:200,background:"rgba(255,255,255,0.08)",border:`1.5px solid rgba(245,197,24,0.3)`,color:"white",fontSize:13,fontWeight:700,textAlign:"center"}} 
            placeholder="Goleador Real..." 
            value={editR.topScorer||""} 
            onChange={e=>setEditR(r=>({...r,topScorer:e.target.value}))}
          />
        </div>
      </div>
      <div style={{textAlign:"center"}}>
        <button className="btn btn-primary" style={{padding:"12px 36px", fontSize:15}} onClick={()=>saveResults(editR)}>💾 Guardar Resultados Oficiales</button>
      </div>
    </div>
  );
}

function LeaderboardPodium({scores, pointsKey}) {
  if (scores.length < 2) return null;

  const podiumEntries = [
    { entry: scores[1], rank: 1, height: 190, textColor: c.primaryMid, cardBackground: "linear-gradient(180deg, #eef2f5 0%, #c9d2da 100%)", pointsColor: "#34495e" },
    { entry: scores[0], rank: 0, height: 270, textColor: c.primaryMid, cardBackground: "linear-gradient(180deg, #ffd86a 0%, #ffca18 100%)", pointsColor: "#113b2a" },
    { entry: scores[2], rank: 2, height: 150, textColor: c.primaryMid, cardBackground: "linear-gradient(180deg, #d8cec9 0%, #aab8c3 100%)", pointsColor: "#34495e" },
  ].filter(({ entry }) => Boolean(entry));

  return (
    <div style={{background:"linear-gradient(180deg, rgba(245,248,247,0.95) 0%, rgba(231,237,234,0.98) 100%)",border:"1px solid rgba(26,122,64,0.08)",borderRadius:28,padding:"18px 16px 0",marginBottom:22,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 30px rgba(14,52,31,0.05)"}}>
      <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:28,minHeight:380}}>
        {podiumEntries.map(({ entry, rank, height, textColor, cardBackground, pointsColor })=>(
          <div key={`${pointsKey}-${entry.id}-${rank}`} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",width:184,maxWidth:"30%"}}>
            <div style={{fontSize:28,lineHeight:1,marginBottom:8,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.12))"}}>{["🥇","🥈","🥉"][rank]}</div>
            <div style={{fontWeight:900,fontSize:16,color:textColor,textAlign:"center",marginBottom:12,wordBreak:"break-word"}}>{entry.name}</div>
            <div style={{width:"100%",height,background:cardBackground,border:"4px solid rgba(255,255,255,0.9)",borderBottom:"none",borderRadius:"20px 20px 0 0",boxShadow:"0 12px 30px rgba(0,0,0,0.10)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontWeight:900,fontSize:34,lineHeight:1,color:pointsColor}}>{entry[pointsKey] ?? 0}</div>
              <div style={{fontWeight:800,fontSize:14,letterSpacing:0.8,color:pointsColor,opacity:0.8,marginTop:4}}>PTS</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardSection({title, scores, pointsKey, emptyLabel, descriptor}) {
  const medals=["🥇","🥈","🥉"];

  return (
    <div style={{marginTop:28}}>
      <div style={{fontWeight:900,fontSize:20,color:c.primaryMid,marginBottom:16,fontFamily:"var(--font-heading)"}}>{title}</div>
      {scores.length===0 ? (
        <div className="quiniela-card" style={{textAlign:"center",padding:"32px 20px",color:c.gray400,fontWeight:700}}>
          {emptyLabel}
        </div>
      ) : (
        <>
          <LeaderboardPodium scores={scores} pointsKey={pointsKey} />
          <div className="quiniela-card" style={{overflow:"hidden"}}>
            {scores.map((s,i)=>(
              <div
                key={`${pointsKey}-${s.id}`}
                className="standing-row"
                style={{
                  display:"flex",
                  alignItems:"center",
                  gap:14,
                  padding:"12px 20px",
                  background:i===0?"rgba(245,197,24,0.06)":i===1?"rgba(200,207,191,0.08)":"white",
                  borderBottom:`1px solid ${c.gray100}`
                }}
              >
                <div style={{
                  width:30,
                  height:30,
                  borderRadius:"50%",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  fontWeight:900,
                  fontSize:13,
                  background:i===0?c.accent:i===1?"#cfd8dc":i===2?"#d7ccc8":c.gray100,
                  color:i<3?c.primary:c.gray600,
                  flexShrink:0,
                  boxShadow: i<3 ? "0 2px 5px rgba(0,0,0,0.1)" : "none",
                  border: i<3 ? "1.5px solid white" : "none"
                }}>
                  {i<3?medals[i]:i+1}
                </div>

                <div style={{flex:1,fontWeight:800,fontSize:14, color:c.ink}}>{s.name}</div>

                <div style={{fontSize:11,color:c.gray400, fontWeight:500}}>
                  {descriptor}
                </div>

                <div style={{
                  background:i===0?c.accent:i===1?c.gray100:c.gray50,
                  color:i===0?c.primary:c.primaryMid,
                  fontWeight:900,
                  fontSize:13,
                  padding:"6px 14px",
                  borderRadius:8,
                  border: i===0 ? `1px solid rgba(245,197,24,0.5)` : `1px solid ${c.gray200}`
                }}>
                  {s[pointsKey]??0} pt
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeaderboardTab({scores,results}){
  if(!results) return (
    <div className="quiniela-card" style={{textAlign:"center",padding:"60px 20px",color:c.gray400}}>
      <div style={{fontSize:44,marginBottom:10}}>🏆</div>
      <div style={{fontWeight:700, color:c.gray600}}>Los resultados reales no están cargados. Rellena los resultados para ver la clasificación.</div>
    </div>
  );
  if(!scores.length) return (
    <div className="quiniela-card" style={{textAlign:"center",padding:"60px 20px",color:c.gray400,fontWeight:700}}>
      No hay participantes registrados.
    </div>
  );
  const medals=["🥇","🥈","🥉"];
  const groupStageScores=[...scores]
    .map(s=>({...s,groupPts:scoreGroupStageOnly(s.predictions,results)}))
    .filter(s=>s.groupPts!==null)
    .sort((a,b)=>(b.groupPts||0)-(a.groupPts||0)||new Date(a.submitted_at)-new Date(b.submitted_at));
  const round32Scores=[...scores]
    .map(s=>({...s,r32Pts:scoreKnockoutRound(s.predictions,results,"r32")}))
    .filter(s=>s.r32Pts!==null)
    .sort((a,b)=>(b.r32Pts||0)-(a.r32Pts||0)||new Date(a.submitted_at)-new Date(b.submitted_at));
  
  return (
    <div>
      <LeaderboardSection
        title="Fase de Grupos"
        scores={groupStageScores}
        pointsKey="groupPts"
        emptyLabel="Aun no hay resultados cargados para puntuar la fase de grupos."
        descriptor="Solo grupos"
      />
      <LeaderboardSection
        title="Ronda de 32"
        scores={round32Scores}
        pointsKey="r32Pts"
        emptyLabel="Aun no hay resultados cargados para puntuar la Ronda de 32."
        descriptor="Solo R32"
      />
      <LeaderboardSection
        title="Clasificación General"
        scores={scores}
        pointsKey="pts"
        emptyLabel="Aun no hay resultados cargados para puntuar la clasificación general."
        descriptor="Total"
      />
    </div>
  );
}
