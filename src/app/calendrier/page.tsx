"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDragTouch, SlotTarget } from "@/hooks/useDragTouch";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  AlignJustify, LayoutGrid, Pencil, Check, X,
} from "lucide-react";

/* ─────────── Types ─────────── */
interface Placement {
  id: string; date: string; time: string; instructor: string; examCenter: string;
  notes?: string; student: { id: string; firstName: string; lastName: string; lastDrivingDate: string | null };
}
interface Student {
  id: string; firstName: string; lastName: string;
  drivingHours: number; lastDrivingDate: string | null;
  licenseType: string;
}
interface ExamMonthData { year: number; month: number; totalSlots: number; usedSlots: number; }
type DragData = { kind: "student"; student: Student } | { kind: "placement"; placement: Placement };

const TIME_SLOTS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const CACHE_MS = 5 * 60_000; // 5 min TTL
interface CachedWeek { placements:Placement[]; queue:{id:string;studentId:string}[]; monthData:ExamMonthData|null; ts:number; }

const LICENSE_TYPES = ["Permis B","Permis BEA","VP Permis B","VP Permis BEA","Permis Accéléré"] as const;

function licenseCardCls(t: string, isPlaced: boolean) {
  if (isPlaced) return "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/50 opacity-50";
  switch(t) {
    case "Permis B":        return "bg-gray-900 border-gray-700";
    case "Permis BEA":      return "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700";
    case "VP Permis B":     return "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700";
    case "VP Permis BEA":   return "bg-white dark:bg-gray-800 border-green-400 border-l-red-400";
    case "Permis Accéléré": return "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700";
    default:                return "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";
  }
}
function licenseAvatarCls(t: string, isPlaced: boolean) {
  if (isPlaced) return "bg-gray-200 dark:bg-gray-700 text-gray-400";
  switch(t) {
    case "Permis B":        return "bg-gray-700 text-white";
    case "Permis BEA":      return "bg-green-100 dark:bg-green-900/40 text-green-700";
    case "VP Permis B":     return "bg-red-100 dark:bg-red-900/40 text-red-600";
    case "VP Permis BEA":   return "bg-gradient-to-br from-red-100 to-green-100 text-gray-700";
    case "Permis Accéléré": return "bg-blue-100 dark:bg-blue-900/40 text-blue-600";
    default:                return "bg-blue-100 dark:bg-blue-900/40 text-blue-600";
  }
}
function licenseNameCls(t: string, isPlaced: boolean) {
  if (isPlaced) return "line-through text-gray-400 dark:text-gray-500";
  return t === "Permis B" ? "text-white" : "text-gray-900 dark:text-gray-100";
}
function licenseSubCls(t: string, isPlaced: boolean) {
  if (isPlaced) return "text-gray-400";
  return t === "Permis B" ? "text-gray-400" : "text-gray-400";
}

function weekStartOf(d: Date): Date {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate()-(day===0?6:day-1)); r.setHours(0,0,0,0); return r;
}
function weekDays(start: Date): Date[] {
  return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(d.getDate()+i); return d; });
}
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function shiftWeek(d: Date, n: number) { const r=new Date(d); r.setDate(r.getDate()+n*7); return r; }
function fmt2(n: number) { return String(n).padStart(2,"0"); }
function drivingDate(s: string|null) { if(!s)return"—"; const d=new Date(s); return `${fmt2(d.getDate())}/${fmt2(d.getMonth()+1)}`; }
function getDaysInMonth(y: number, m: number) { return new Date(y,m,0).getDate(); }
function getFirstOffset(y: number, m: number) { const d=new Date(y,m-1,1).getDay(); return d===0?6:d-1; }
function initials(s: Student) { return ((s.firstName?.[0]??"")+(s.lastName?.[0]??"")).toUpperCase()||"?"; }
function fullName(s: { firstName: string; lastName: string }) { return s.firstName?`${s.firstName} ${s.lastName}`:s.lastName; }
function weekLabel(days: Date[]) {
  const [f,l]=[days[0],days[6]];
  return f.getMonth()===l.getMonth()
    ?`${f.getDate()} – ${l.getDate()} ${MONTH_NAMES[f.getMonth()]} ${f.getFullYear()}`
    :`${f.getDate()} ${MONTH_NAMES[f.getMonth()]} – ${l.getDate()} ${MONTH_NAMES[l.getMonth()]} ${l.getFullYear()}`;
}

/* ═══════════════════════════════════════════════════════
   DRAG — useDragTouch (src/hooks/useDragTouch.ts)
   Clone visuel ajouté au <body> position:fixed.
   touchstart/touchmove/touchend natifs passive:false.
═══════════════════════════════════════════════════════ */

type DragCbs = {
  onStart:  (d: DragData) => void;
  onOver:   (t: SlotTarget | null) => void;
  onDrop:   (t: SlotTarget | null, d: DragData) => void;
  onCancel: () => void;
};

function Draggable({
  data,
  onTap,
  cbs,
  className,
  children,
}: {
  data: DragData;
  onTap: () => void;
  cbs: React.RefObject<DragCbs>;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useDragTouch(ref, {
    onDragStart: ()       => cbs.current.onStart(data),
    onDragOver:  (target) => cbs.current.onOver(target),
    onDrop:      (target) => cbs.current.onDrop(target, data),
    onTap:       onTap,
    onCancel:    ()       => cbs.current.onCancel(),
  });

  return (
    <div
      ref={ref}
      style={{
        touchAction:        "none",
        userSelect:         "none",
        WebkitUserSelect:   "none",
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
      className={cn("cursor-grab active:cursor-grabbing select-none", className)}
    >
      {children}
    </div>
  );
}

/* ─────────── TimeSlot (drop target via data attrs) ─────────── */
function TimeSlot({ slotId, dateStr, time, children, onTap, isOver }: {
  slotId: string; dateStr: string; time: string; children: React.ReactNode;
  onTap: () => void; isOver: boolean;
}) {
  return (
    <div
      data-slot="1" data-date={dateStr} data-time={time}
      onClick={onTap}
      className={cn(
        "h-8 border-t border-gray-100 dark:border-gray-800/60 relative cursor-pointer transition-colors duration-75",
        isOver ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-500" : "hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
      )}
    >
      {children}
    </div>
  );
}

/* ─────────── MiniCounter (compact, inline dans toolbar) ─────────── */
function MiniCounter({ label, value, color, onSave }: {
  label: string; value: number|null; color: "blue"|"green"; onSave?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cls = color==="blue"
    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400"
    : "bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800 text-green-600 dark:text-green-400";
  function start() { if(!onSave)return; setInput(value!==null?String(value):""); setEditing(true); setTimeout(()=>inputRef.current?.focus(),40); }
  function save() { const n=parseInt(input); if(!isNaN(n)&&n>=0&&onSave) onSave(n); setEditing(false); }
  if (editing) return (
    <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold",cls)}>
      <input ref={inputRef} type="number" min={0} value={input} onChange={e=>setInput(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEditing(false);}}
        className="w-10 bg-transparent border-b border-current focus:outline-none text-center"/>
      <button onClick={save}><Check className="h-3 w-3"/></button>
      <button onClick={()=>setEditing(false)}><X className="h-3 w-3 opacity-50"/></button>
    </div>
  );
  return (
    <button onClick={start} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-opacity hover:opacity-80",cls,onSave&&"cursor-pointer")}>
      <span className="font-bold">{value!==null?value:"—"}</span>
      <span className="opacity-60 font-normal">{label}</span>
      {onSave&&<Pencil className="h-2.5 w-2.5 opacity-40"/>}
    </button>
  );
}

/* ─────────── Debug panel (iPad sans DevTools) ─────────── */
function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__dragLog = (msg: string) => {
      setLogs(prev => [`${new Date().toISOString().slice(11,23)} ${msg}`, ...prev].slice(0, 20));
    };
  }, []);

  if (!visible) return (
    <button
      onClick={() => setVisible(true)}
      className="fixed bottom-4 right-4 z-[99999] bg-black text-white text-xs px-3 py-2 rounded-full opacity-70"
    >
      DEBUG
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[99999] bg-black/90 text-green-400 text-[10px] font-mono p-2 max-h-48 overflow-y-auto">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-bold">DRAG DEBUG</span>
        <button onClick={() => setLogs([])} className="text-yellow-400 mr-2">CLEAR</button>
        <button onClick={() => setVisible(false)} className="text-red-400">FERMER</button>
      </div>
      {logs.length === 0 && <p className="text-gray-500">En attente d'events touch...</p>}
      {logs.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

function dragLog(msg: string) {
  const fn = (window as unknown as Record<string, unknown>).__dragLog;
  if (typeof fn === "function") (fn as (m: string) => void)(msg);
}

/* ═══════════════════════════════════════ MAIN PAGE ═══════════════════════════════════════ */
export default function CalendrierPage() {
  const { data: session } = useSession();
  const now = new Date();
  const todayKey = dateKey(now);

  const [view, setView]         = useState<"week"|"month">("week");
  const [wStart, setWStart]     = useState(()=>weekStartOf(now));
  const [curYear, setCurYear]   = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth()+1);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [students,   setStudents]   = useState<Student[]>([]);
  const [weekQueue,  setWeekQueue]  = useState<{id:string;studentId:string}[]>([]);
  const [monthData,  setMonthData]  = useState<ExamMonthData|null>(null);
  const [loading,    setLoading]    = useState(true);

  const [weeklyLimit, setWeeklyLimit] = useState(10);
  useEffect(()=>{ const s=localStorage.getItem("planpermis_weekly_limit"); if(s) setWeeklyLimit(parseInt(s)); },[]);
  function saveWeeklyLimit(v: number) { setWeeklyLimit(v); localStorage.setItem("planpermis_weekly_limit",String(v)); }

  /* ── Drag state ── */
  const [dropTarget, setDropTarget] = useState<string|null>(null);

  /* Stable callbacks ref — updated each render to keep closures fresh */
  const dragCbs = useRef<DragCbs>({
    onStart:  () => {},
    onOver:   () => {},
    onDrop:   () => {},
    onCancel: () => {},
  });

  /* Modals */
  type ModalKind = "add"|"detail"|"queue"|"newStudent"|null;
  const [modal,        setModal]        = useState<ModalKind>(null);
  const [selPlacement, setSelPlacement] = useState<Placement|null>(null);
  const [queueStu,     setQueueStu]     = useState<Student|null>(null);
  const [pForm,        setPForm]        = useState({studentId:"",date:"",time:"09:00",instructor:"",examCenter:"",notes:""});
  const [sForm,        setSForm]        = useState({firstName:"",lastName:"",email:"",phone:"",licenseType:"Permis B",lastDrivingDate:""});
  const [formError,    setFormError]    = useState("");
  const [formLoading,  setFormLoading]  = useState(false);

  /* ── Cache ── */
  const cacheRef = useRef<{students:Student[]|null;studentsTs:number;weeks:Map<string,CachedWeek>}>({students:null,studentsTs:0,weeks:new Map()});
  const wStartRef = useRef(wStart);  const viewRef  = useRef(view);
  useEffect(()=>{ wStartRef.current=wStart; },[wStart]);
  useEffect(()=>{ viewRef.current=view;     },[view]);

  const fetchWeek = useCallback(async (ws:Date, silent=false) => {
    const wk = dateKey(ws);
    const isCurrent = ()=> wk===dateKey(wStartRef.current) && viewRef.current==="week";
    const now = Date.now();
    const cached = cacheRef.current.weeks.get(wk);
    const stuFresh = !!cacheRef.current.students && (now - cacheRef.current.studentsTs < CACHE_MS);
    const cacheHit = !!(cached && (now - cached.ts) < CACHE_MS);

    if (isCurrent()) {
      if (cacheHit) { setPlacements(cached!.placements); setWeekQueue(cached!.queue); setMonthData(cached!.monthData); }
      if (stuFresh)  setStudents(cacheRef.current.students!);
      if (cacheHit && stuFresh) { setLoading(false); return; }
      if (!silent && !cacheHit) setLoading(true);
    }

    try {
      const days = weekDays(ws);
      const uniqMonths = [...new Map(days.map(d=>[`${d.getFullYear()}-${d.getMonth()+1}`,{year:d.getFullYear(),month:d.getMonth()+1}])).values()];
      const [stuData, allMonths, queueData, ...pArrays] = await Promise.all([
        stuFresh ? Promise.resolve(null) : fetch("/api/eleves").then(r=>r.json()),
        fetch(`/api/places-examen?year=${ws.getFullYear()}`).then(r=>r.json()),
        fetch(`/api/queue?weekStart=${wk}`).then(r=>r.json()),
        ...uniqMonths.map(({year,month})=>fetch(`/api/placements?year=${year}&month=${month}`).then(r=>r.json())),
      ]);
      const all=(pArrays.flat() as unknown[]).filter((p):p is Placement=>!!p&&typeof p==="object"&&"id"in(p as object));
      const students=stuFresh?cacheRef.current.students!:(Array.isArray(stuData)?stuData:[]);
      const monthD=Array.isArray(allMonths)?(allMonths as ExamMonthData[]).find(m=>m.month===ws.getMonth()+1&&m.year===ws.getFullYear())??null:null;
      const queue=Array.isArray(queueData)?queueData:[];
      if(!stuFresh&&Array.isArray(stuData)){cacheRef.current.students=stuData;cacheRef.current.studentsTs=Date.now();}
      cacheRef.current.weeks.set(wk,{placements:all,queue,monthData:monthD,ts:Date.now()});
      if(isCurrent()){setPlacements(all);setStudents(students);setWeekQueue(queue);setMonthData(monthD);}
    }catch{/*silent*/}finally{if(isCurrent())setLoading(false);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    try {
      const stuFresh=!!cacheRef.current.students&&(Date.now()-cacheRef.current.studentsTs<CACHE_MS);
      const [stuData,allMonths,pData]=await Promise.all([
        stuFresh?Promise.resolve(null):fetch("/api/eleves").then(r=>r.json()),
        fetch(`/api/places-examen?year=${curYear}`).then(r=>r.json()),
        fetch(`/api/placements?year=${curYear}&month=${curMonth}`).then(r=>r.json()),
      ]);
      if(!stuFresh&&Array.isArray(stuData)){cacheRef.current.students=stuData;cacheRef.current.studentsTs=Date.now();}
      const all=(Array.isArray(pData)?pData:[]).filter((p:unknown):p is Placement=>!!p&&typeof p==="object"&&"id"in(p as object));
      const monthD=Array.isArray(allMonths)?(allMonths as ExamMonthData[]).find(m=>m.month===curMonth&&m.year===curYear)??null:null;
      setPlacements(all);setStudents(cacheRef.current.students??[]);setWeekQueue([]);setMonthData(monthD);
    }catch{/*silent*/}finally{setLoading(false);}
  },[curYear,curMonth]);

  const fetchData = useCallback(()=>{ if(view==="week") fetchWeek(wStart); else fetchMonth(); },[view,wStart,fetchWeek,fetchMonth]);
  useEffect(()=>{fetchData();},[fetchData]);

  /* Précharge les semaines adjacentes en arrière-plan */
  useEffect(()=>{
    if(view!=="week")return;
    const t=setTimeout(()=>{ fetchWeek(shiftWeek(wStart,1),true); fetchWeek(shiftWeek(wStart,-1),true); },700);
    return()=>clearTimeout(t);
  },[wStart,view,fetchWeek]);

  async function saveMonthlyTotal(v: number) {
    const ay=view==="week"?wStart.getFullYear():curYear, am=view==="week"?wStart.getMonth()+1:curMonth;
    const res=await fetch("/api/places-examen",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({year:ay,month:am,totalSlots:v})});
    if(res.ok){
      const updated=await res.json();
      setMonthData(updated);
      if(view==="week"){const c=cacheRef.current.weeks.get(dateKey(wStart));if(c)cacheRef.current.weeks.set(dateKey(wStart),{...c,monthData:updated});}
    }
  }

  /* ── Drag callbacks (updated each render) ── */
  dragCbs.current.onStart  = () => {};
  dragCbs.current.onOver   = (t) => { setDropTarget(t ? (t.isQueue ? "queue" : `${t.date}:${t.time}`) : null); };
  dragCbs.current.onDrop   = (t, d) => {
    setDropTarget(null);
    if (!t) return;
    if (t.isQueue && d.kind === "placement") {
      const p = d.placement;
      setPlacements(prev => prev.filter(x => x.id !== p.id));
      fetch(`/api/placements/${p.id}`, { method: "DELETE" }).catch(() => { fetchData(); });
      return;
    }
    if (d.kind === "student") {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const newP: Placement = { id: tempId, date: t.date, time: t.time, instructor: "", examCenter: "", notes: "", student: d.student };
      setPlacements(prev => [...prev, newP]);
      fetch("/api/placements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: d.student.id, date: t.date, time: t.time, instructor: "", examCenter: "", notes: "" }) })
        .then(r => r.json()).then(saved => { if (saved?.id) setPlacements(prev => prev.map(x => x.id === tempId ? saved : x)); else fetchData(); })
        .catch(() => { setPlacements(prev => prev.filter(x => x.id !== tempId)); });
    } else {
      const p = d.placement;
      if (p.date.slice(0,10) !== t.date || p.time !== t.time) {
        // Optimistic update — no loading flicker
        setPlacements(prev => prev.map(x => x.id === p.id ? { ...x, date: t.date, time: t.time } : x));
        fetch(`/api/placements/${p.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:t.date,time:t.time})})
          .catch(()=>{ fetchData(); }); // revert on error only
      }
    }
  };
  dragCbs.current.onCancel = () => { setDropTarget(null); };

  const [slideClass, setSlideClass] = useState("");

  function prev(){if(view==="week"){setWStart(s=>shiftWeek(s,-1));return;}if(curMonth===1){setCurMonth(12);setCurYear(y=>y-1);}else setCurMonth(m=>m-1);}
  function next(){if(view==="week"){setWStart(s=>shiftWeek(s,1));return;}if(curMonth===12){setCurMonth(1);setCurYear(y=>y+1);}else setCurMonth(m=>m+1);}
  function goToday(){setWStart(weekStartOf(now));setCurYear(now.getFullYear());setCurMonth(now.getMonth()+1);}

  function navigateWithAnim(dir: "prev"|"next") {
    if (view !== "week") { dir==="prev"?prev():next(); return; }
    const outCls = dir==="next" ? "animate-slide-out-left" : "animate-slide-out-right";
    const inCls  = dir==="next" ? "animate-slide-in-right" : "animate-slide-in-left";
    setSlideClass(outCls);
    setTimeout(() => { dir==="prev"?prev():next(); setSlideClass(inCls);
      setTimeout(() => setSlideClass(""), 200);
    }, 155);
  }

  function openFromSlot(d:string,t:string){setQueueStu(null);setPForm({studentId:"",date:d,time:t,instructor:"",examCenter:"",notes:""});setFormError("");setModal("add");}
  function openFromQueue(s:Student){setQueueStu(s);setPForm({studentId:s.id,date:"",time:"09:00",instructor:"",examCenter:"",notes:""});setFormError("");setModal("add");}
  function openDetail(p:Placement){setSelPlacement(p);setModal("detail");}
  function closeModal(){setModal(null);setSelPlacement(null);setQueueStu(null);setFormError("");}

  async function addToWeekQueue(s:Student){
    const ws=dateKey(wStart);
    const tempId=`temp-${Date.now()}`;
    setWeekQueue(prev=>[...prev,{id:tempId,studentId:s.id}]);
    closeModal();
    const res=await fetch("/api/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:s.id,weekStart:ws})});
    const data=await res.json();
    if(data?.id) setWeekQueue(prev=>prev.map(e=>e.id===tempId?data:e));
    else setWeekQueue(prev=>prev.filter(e=>e.id!==tempId));
  }

  async function submitPlacement(e:React.FormEvent){
    e.preventDefault();
    if(!pForm.studentId||!pForm.date||!pForm.time){setFormError("Élève, date et heure requis");return;}
    setFormLoading(true);setFormError("");
    try{
      const res=await fetch("/api/placements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pForm)});
      const data=await res.json(); if(!res.ok){setFormError(data.error||"Erreur");return;}
      if(data?.id){
        setPlacements(prev=>[...prev.filter(x=>x.student.id!==data.student.id),data]);
        const wk=dateKey(wStart);const c=cacheRef.current.weeks.get(wk);
        if(c)cacheRef.current.weeks.set(wk,{...c,placements:[...c.placements.filter(x=>x.student.id!==data.student.id),data]});
      }
      closeModal();
    }catch{setFormError("Erreur serveur");}finally{setFormLoading(false);}
  }
  async function submitStudent(e:React.FormEvent){
    e.preventDefault();
    if(!sForm.lastName.trim()){setFormError("Le nom est requis");return;}
    setFormLoading(true);setFormError("");
    try{
      const res=await fetch("/api/eleves",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...sForm,drivingHours:0,lastDrivingDate:sForm.lastDrivingDate||null,email:sForm.email||undefined})});
      const data=await res.json(); if(!res.ok){setFormError(data.error||"Erreur");return;}
      const qRes=await fetch("/api/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:data.id,weekStart:dateKey(wStart)})});
      const qEntry=await qRes.json();
      setStudents(prev=>[...prev,data]);
      if(qEntry?.id) setWeekQueue(prev=>[...prev,qEntry]);
      if(cacheRef.current.students) cacheRef.current.students=[...cacheRef.current.students,data];
      closeModal();setSForm({firstName:"",lastName:"",email:"",phone:"",licenseType:"Permis B",lastDrivingDate:""});
    }catch{setFormError("Erreur serveur");}finally{setFormLoading(false);}
  }
  async function deletePlacement(id:string){
    setFormLoading(true);
    try{
      await fetch(`/api/placements/${id}`,{method:"DELETE"});
      setPlacements(prev=>prev.filter(x=>x.id!==id));
      const wk=dateKey(wStart);const c=cacheRef.current.weeks.get(wk);
      if(c)cacheRef.current.weeks.set(wk,{...c,placements:c.placements.filter(x=>x.id!==id)});
      closeModal();
    }catch{setFormError("Erreur serveur");}finally{setFormLoading(false);}
  }

  const days = weekDays(wStart);
  const wKeys = new Set(days.map(dateKey));
  const weekCount = placements.filter(p=>wKeys.has(p.date.slice(0,10))).length;
  const monthAvailable = monthData?Math.max(0,monthData.totalSlots-monthData.usedSlots):null;
  const bySlot = new Map<string,Placement[]>();
  placements.forEach(p=>{const k=`${p.date.slice(0,10)}:${p.time}`;bySlot.set(k,[...(bySlot.get(k)??[]),p]);});
  const placedIds = new Set(placements.map(p=>p.student.id));
  const queueIds = new Set(weekQueue.map(e=>e.studentId));
  const queueStudents = students.filter(s=>queueIds.has(s.id));
  const studentOptions = students.map(s=>({value:s.id,label:fullName(s)}));

  return (
    <AppLayout title="Calendrier" role={session?.user?.role||""} schoolName={session?.user?.schoolName}>

      <div className="flex flex-col gap-4" style={{height:"calc(100vh - 57px)"}}>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-1">
            <button onClick={()=>navigateWithAnim("prev")} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"><ChevronLeft className="h-4 w-4"/></button>
            <span className="px-3 text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[210px] text-center">{view==="week"?weekLabel(days):`${MONTH_NAMES[curMonth-1]} ${curYear}`}</span>
            <button onClick={()=>navigateWithAnim("next")} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"><ChevronRight className="h-4 w-4"/></button>
          </div>
          <button onClick={goToday} className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors shadow-sm">Aujourd'hui</button>
          <div className="flex items-center gap-2 ml-auto">
            {view==="week"&&(
              <>
                <MiniCounter label="/ mois" value={monthAvailable} color="blue" onSave={saveMonthlyTotal}/>
                <MiniCounter label="/ sem." value={Math.max(0,weeklyLimit-weekCount)} color="green" onSave={saveWeeklyLimit}/>
              </>
            )}
            <div className="flex rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-1">
              <button onClick={()=>setView("week")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",view==="week"?"bg-blue-500 text-white shadow-sm":"text-gray-500 hover:text-gray-700")}><AlignJustify className="h-3.5 w-3.5"/> Semaine</button>
              <button onClick={()=>setView("month")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",view==="month"?"bg-blue-500 text-white shadow-sm":"text-gray-500 hover:text-gray-700")}><LayoutGrid className="h-3.5 w-3.5"/> Mois</button>
            </div>
          </div>
        </div>

        {loading?(
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"/>
          </div>
        ):view==="week"?(

          <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0 relative">

            {/* Flèches de navigation intégrées */}
            <button onClick={()=>navigateWithAnim("prev")}
              className="absolute left-[10px] top-1/2 -translate-y-1/2 z-30 h-9 w-9 rounded-full bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:bg-white/90 dark:hover:bg-gray-800/90 hover:text-blue-500 hover:border-blue-300 hover:shadow-lg active:scale-90 transition-all">
              <ChevronLeft className="h-4 w-4"/>
            </button>
            <button onClick={()=>navigateWithAnim("next")}
              className="absolute right-[8.75rem] top-1/2 -translate-y-1/2 z-30 h-9 w-9 rounded-full bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:bg-white/90 dark:hover:bg-gray-800/90 hover:text-blue-500 hover:border-blue-300 hover:shadow-lg active:scale-90 transition-all">
              <ChevronRight className="h-4 w-4"/>
            </button>

            {/* Single scrollable container — évite le décalage scrollbar header/body */}
            <div className={cn("h-full overflow-y-auto", slideClass)}>

              {/* Day headers — sticky */}
              <div className="flex border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-20">
                <div className="w-14 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"/>
                {days.map((day,di)=>{
                  const dk=dateKey(day),isToday=dk===todayKey;
                  return(
                    <div key={dk} className={cn("flex-1 min-w-0 flex flex-col items-center py-2.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0",isToday&&"bg-blue-50/60 dark:bg-blue-900/20")}>
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest",isToday?"text-blue-500":"text-gray-400")}>{DAYS_SHORT[di]}</span>
                      <span className={cn("mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",isToday?"bg-blue-500 text-white shadow-sm":"text-gray-800 dark:text-gray-200")}>{day.getDate()}</span>
                    </div>
                  );
                })}
                <div className="w-44 flex-shrink-0 border-l-2 border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">File d'attente</span>
                  <button onClick={()=>{setFormError("");setModal("queue");}} className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm"><Plus className="h-3 w-3"/></button>
                </div>
              </div>

              {/* Body: time + jours + queue dans le même flex → pas de décalage */}
              <div className="flex">
                <div className="w-14 flex-shrink-0 border-r border-gray-100 dark:border-gray-800">
                  {TIME_SLOTS.map(t=>(
                    <div key={t} className="h-8 flex items-center justify-end pr-2 border-t border-gray-100 dark:border-gray-800">
                      <span className={cn("text-[10px] font-medium", t.endsWith(":00") ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600")}>{t.endsWith(":00") ? t : ""}</span>
                    </div>
                  ))}
                </div>

                {days.map(day=>{
                  const dk=dateKey(day),isToday=dk===todayKey;
                  return(
                    <div key={dk} className={cn("flex-1 min-w-0 border-r border-gray-100 dark:border-gray-800 last:border-r-0",isToday&&"bg-blue-50/10 dark:bg-blue-900/10")}>
                      {TIME_SLOTS.map(time=>{
                        const slotId=`${dk}:${time}`, slotPlacements=bySlot.get(slotId)??[];
                        return(
                          <TimeSlot key={time} slotId={slotId} dateStr={dk} time={time}
                            onTap={()=>openFromSlot(dk,time)} isOver={dropTarget===slotId}>
                            {slotPlacements.map(p=>(
                              <Draggable key={p.id}
                                data={{kind:"placement",placement:p}}
                                onTap={()=>openDetail(p)}
                                cbs={dragCbs}
                                className="absolute inset-x-0.5 top-0.5 bottom-0.5 flex items-center justify-between gap-1 px-1.5 rounded-lg z-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-semibold shadow-sm"
                              >
                                <span className="truncate">{fullName(p.student)}</span>
                                {p.student.lastDrivingDate && <span className="opacity-70 font-normal flex-shrink-0">{drivingDate(p.student.lastDrivingDate)}</span>}
                              </Draggable>
                            ))}
                          </TimeSlot>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Queue */}
                <div data-queue="1" className={cn("w-44 flex-shrink-0 border-l-2 p-2 space-y-1.5 transition-colors", dropTarget==="queue" ? "border-blue-400 bg-blue-100 dark:bg-blue-900/40" : "border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-900/10")}>
                  {queueStudents.length===0?(
                    <div className="h-24 flex flex-col items-center justify-center text-center gap-1">
                      <p className="text-xs text-gray-400">Aucun élève</p>
                      <button onClick={()=>setModal("queue")} className="text-xs text-blue-500 underline">Ajouter</button>
                    </div>
                  ):queueStudents.map(s=>{
                    const isPlaced = placedIds.has(s.id);
                    return (
                    <Draggable key={s.id}
                      data={{kind:"student",student:s}}
                      onTap={()=>openFromQueue(s)}
                      cbs={dragCbs}
                      className={cn("rounded-xl border flex items-center gap-2 px-2 py-1.5 select-none transition-opacity",
                        licenseCardCls(s.licenseType??"Permis B", isPlaced)
                      )}
                    >
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0",
                        licenseAvatarCls(s.licenseType??"Permis B", isPlaced)
                      )}>{initials(s)}</div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className={cn("text-[11px] font-semibold truncate", licenseNameCls(s.licenseType??"Permis B", isPlaced))}>{fullName(s)}</p>
                        <p className={cn("text-[9px] truncate", licenseSubCls(s.licenseType??"Permis B", isPlaced))}>{s.licenseType??"Permis B"} · {drivingDate(s.lastDrivingDate)}</p>
                      </div>
                    </Draggable>
                  );})}
                </div>
              </div>

            </div>
          </div>

        ):(
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="grid grid-cols-7 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50/50">
              {DAYS_SHORT.map(d=><div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({length:getFirstOffset(curYear,curMonth)}).map((_,i)=><div key={`e-${i}`} className="h-24 border-b border-r border-gray-50 dark:border-gray-800 bg-gray-50/30"/>)}
              {Array.from({length:getDaysInMonth(curYear,curMonth)}).map((_,i)=>{
                const day=i+1,dk=`${curYear}-${fmt2(curMonth)}-${fmt2(day)}`;
                const dayPlacements=placements.filter(p=>p.date.slice(0,10)===dk),isToday=dk===todayKey;
                return(
                  <div key={day} onClick={()=>{setView("week");setWStart(weekStartOf(new Date(curYear,curMonth-1,day)));}}
                    className={cn("h-24 border-b border-r border-gray-100 dark:border-gray-800 p-1.5 cursor-pointer hover:bg-blue-50/30 transition-colors",isToday&&"bg-blue-50/40")}>
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",isToday?"bg-blue-500 text-white":"text-gray-700 dark:text-gray-300")}>{day}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayPlacements.slice(0,2).map(p=>(
                        <div key={p.id} onClick={e=>{e.stopPropagation();openDetail(p);}} className="text-[9px] font-semibold text-white bg-blue-500 rounded px-1 py-0.5 truncate">{p.time} {p.student.lastName}</div>
                      ))}
                      {dayPlacements.length>2&&<div className="text-[9px] text-gray-400">+{dayPlacements.length-2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ Modals ══ */}
      <Modal open={modal==="add"} onClose={closeModal} title={queueStu?`Placer ${fullName(queueStu)}`:"Placer un élève"}>
        <form onSubmit={submitPlacement} className="space-y-4 mt-2">
          {!queueStu&&(
            <Select label="Élève *" value={pForm.studentId} onChange={e=>setPForm(f=>({...f,studentId:e.target.value}))} required>
              <option value="">Sélectionner un élève</option>
              {studentOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date *" type="date" value={pForm.date} onChange={e=>setPForm(f=>({...f,date:e.target.value}))} required/>
            <Select label="Heure *" value={pForm.time} onChange={e=>setPForm(f=>({...f,time:e.target.value}))} required>
              {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Moniteur" value={pForm.instructor} onChange={e=>setPForm(f=>({...f,instructor:e.target.value}))} placeholder="Optionnel"/>
            <Input label="Centre d'examen" value={pForm.examCenter} onChange={e=>setPForm(f=>({...f,examCenter:e.target.value}))} placeholder="Optionnel"/>
          </div>
          <Textarea label="Notes" value={pForm.notes} onChange={e=>setPForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Optionnel"/>
          {formError&&<p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{formLoading?"Enregistrement...":"Confirmer"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal==="detail"} onClose={closeModal} title="Détail du placement">
        {selPlacement&&(
          <div className="space-y-3 mt-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2.5">
              {([["Élève",fullName(selPlacement.student)],["Date",new Date(selPlacement.date).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})],["Heure",selPlacement.time],...(selPlacement.instructor?[["Moniteur",selPlacement.instructor]]:[]),...(selPlacement.examCenter?[["Centre",selPlacement.examCenter]]:[]),] as [string,string][]).map(([label,val])=>(
                <div key={label} className="flex justify-between text-sm"><span className="text-gray-500">{label}</span><span className="font-semibold text-gray-900 dark:text-gray-100 text-right">{val}</span></div>
              ))}
              {selPlacement.notes&&<div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">{selPlacement.notes}</div>}
            </div>
            <button onClick={()=>deletePlacement(selPlacement.id)} disabled={formLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              <Trash2 className="h-4 w-4"/>{formLoading?"Suppression...":"Supprimer ce placement"}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={modal==="queue"} onClose={closeModal} title="Ajouter à la file d'attente">
        <div className="mt-3 space-y-3">
          <button onClick={()=>setModal("newStudent")} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-500"><Plus className="h-5 w-5"/></div>
            <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nouvel élève</p><p className="text-xs text-gray-500">Créer et ajouter un nouvel élève</p></div>
          </button>
          {students.length>0&&(
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Élèves existants</p>
              {students.map(s=>{
                const already=queueIds.has(s.id);
                return (
                <button key={s.id} onClick={()=>!already&&addToWeekQueue(s)} disabled={already} className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",already?"opacity-40 cursor-default":"hover:bg-gray-50 dark:hover:bg-gray-800")}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 text-xs font-bold flex-shrink-0">{initials(s)}</div>
                  <div className="min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fullName(s)}</p><p className="text-xs text-gray-400">{already?"Déjà dans la file":(s.licenseType??"Permis B")+" · "+drivingDate(s.lastDrivingDate)}</p></div>
                </button>
              );})}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={modal==="newStudent"} onClose={closeModal} title="Nouvel élève">
        <form onSubmit={submitStudent} className="space-y-3 mt-2">
          <Input label="Nom et prénom *" placeholder="Jean Dupont" value={sForm.lastName} onChange={e=>setSForm(f=>({...f,lastName:e.target.value,firstName:""}))} required/>
          <Input label="Dernière date de conduite" type="date" value={sForm.lastDrivingDate} onChange={e=>setSForm(f=>({...f,lastDrivingDate:e.target.value}))}/>
          <Select label="Type de permis" value={sForm.licenseType} onChange={e=>setSForm(f=>({...f,licenseType:e.target.value}))}>
            {LICENSE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </Select>
          {formError&&<p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal("queue")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Retour</button>
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{formLoading?"Création...":"Créer l'élève"}</button>
          </div>
        </form>
      </Modal>

      <DebugPanel />
    </AppLayout>
  );
}
