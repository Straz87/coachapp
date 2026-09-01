"use client";

import { useEffect, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import WorkoutTimer from "@/components/WorkoutTimer";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { IconEdit } from "@/components/icons";
import {
BLOCK_TYPES,
SCORE_TYPES,
AGGREGATION_TYPES,
TIMER_TYPES,
TIMER_LABELS,
ACTIVITY_TYPES,
Block,
ScoreConfig,
TimerConfig,
TimerSet,
emptyBlock,
emptyScoreConfig,
getBlockScores,
htmlToLines,
getTimerSets,
totalTimerSeconds,
formatClock,
} from "@/lib/workoutTypes";

export type WorkoutDraft = {
title: string;
blocks: Block[];
activityType?: string | null;
};

function formatDatePill(iso?: string): string | null {
if (!iso) return null;
const [y, m, d] = iso.split("-").map(Number);
const date = new Date(y, m - 1, d);
const label = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
return `${label} ${d}/${m}`;
}

function timerSummary(block: Block): string | null {
if (!block.timer) return null;
const t = block.timer;
if (t.type === "EMOM" || t.type === "AMRAP" || t.type === "TABATA") {
const sets = getTimerSets(t);
if (sets.length > 1) {
return `${sets.length}x ${TIMER_LABELS[t.type]} · ${formatClock(totalTimerSeconds(sets))}`;
}
const s = sets[0];
return `${TIMER_LABELS[t.type]} ${s.minutes}:${String(s.seconds).padStart(2, "0")}`;
}
const minutes = t.minutes ?? 0;
const seconds = t.seconds ?? 0;
return `${TIMER_LABELS[t.type]} ${minutes}:${String(seconds).padStart(2, "0")}`;
}

function blockPreview(block: Block): string {
const lines = htmlToLines(block.description);
return lines.join(" · ").slice(0, 90) || "Vuoto — tocca per compilare";
}

// Icone semplici per le card di selezione del timer (stile Hustle Up).
function AmrapIcon() {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
<path d="M6 4v16M10 4v16M14 4v16M18 9l1 11" strokeLinecap="round" />
</svg>
);
}
function EmomIcon() {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
<path d="M4 12h3M10 12h3M16 12h4" strokeLinecap="round" />
</svg>
);
}
function TabataIcon() {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
<path d="M6 18V9M12 18V4M18 18v-6" strokeLinecap="round" />
</svg>
);
}
function ForTimeIcon() {
return (
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
<circle cx="12" cy="13" r="8" />
<path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
<path d="M9 2h6M12 2v3" strokeLinecap="round" />
</svg>
);
}

const TIMER_META: Record<string, { color: string; desc: string; icon: React.ReactNode }> = {
AMRAP: { color: "bg-lime-400", desc: "Il maggior numero di giri possibile", icon: <AmrapIcon /> },
EMOM: { color: "bg-cyan-400", desc: "Ogni minuto al minuto", icon: <EmomIcon /> },
TABATA: {
color: "bg-indigo-400",
desc: "20 secondi di sforzo seguiti da 10 secondi di riposo",
icon: <TabataIcon />,
},
FOR_TIME: {
color: "bg-orange-400",
desc: "Il tempo per completare l'intero allenamento",
icon: <ForTimeIcon />,
},
};

// Campo durata con etichette "min"/"s" fisse accanto ai numeri, cosi restano
// sempre visibili anche dopo aver digitato un valore (non solo da vuoti).
function DurationField({
minutes,
seconds,
onMinutes,
onSeconds,
label,
}: {
minutes: number;
seconds: number;
onMinutes: (v: number) => void;
onSeconds: (v: number) => void;
label: string;
}) {
return (
<div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2">
<input
type="number"
min={0}
className="w-10 text-right outline-none bg-transparent"
value={minutes}
onChange={(e) => onMinutes(Number(e.target.value) || 0)}
/>
<span className="text-sm text-gray-400">min</span>
<input
type="number"
min={0}
max={59}
className="w-10 text-right outline-none bg-transparent ml-2"
value={seconds}
onChange={(e) => onSeconds(Number(e.target.value) || 0)}
/>
<span className="text-sm text-gray-400">s</span>
<span className="ml-auto text-xs text-gray-400 shrink-0">{label}</span>
</div>
);
}

export default function WorkoutEditorPanel({
initial,
date,
onCancel,
onSave,
onDelete,
saving,
}: {
initial: WorkoutDraft;
date?: string;
onCancel: () => void;
onSave: (draft: WorkoutDraft) => void;
onDelete?: () => void;
saving?: boolean;
}) {
const [title, setTitle] = useState(initial.title);
const [activityType, setActivityType] = useState<string | null>(initial.activityType ?? null);
const [blocks, setBlocks] = useState<Block[]>(
initial.blocks.length > 0 ? initial.blocks : [emptyBlock()]
);
const [openBlocks, setOpenBlocks] = useState<Set<number>>(
new Set(initial.blocks.length > 0 ? [] : [0])
);

const [templates, setTemplates] = useState<
{ id: string; name: string; activity_type: string | null; blocks: Block[] }[]
>([]);
const [savingTemplate, setSavingTemplate] = useState(false);
const [templateMsg, setTemplateMsg] = useState<string | null>(null);
const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
const [templateNameDraft, setTemplateNameDraft] = useState("");

useEffect(() => {
fetch("/api/templates")
.then((res) => res.json())
.then((data) => {
if (Array.isArray(data.templates)) setTemplates(data.templates);
})
.catch(() => {});
}, []);

function handleLoadTemplate(id: string) {
const tpl = templates.find((t) => t.id === id);
if (!tpl) return;
const hasContent = blocks.some((b) => b.description.trim() !== "");
if (hasContent && !confirm(`Questo sostituirà i blocchi già compilati con il template "${tpl.name}". Continuare?`)) {
return;
}
setBlocks(tpl.blocks.length > 0 ? tpl.blocks : [emptyBlock()]);
setOpenBlocks(new Set());
if (tpl.activity_type) setActivityType(tpl.activity_type);
setTemplateMsg(`Caricato "${tpl.name}"`);
setTimeout(() => setTemplateMsg(null), 2500);
}

function openSaveAsTemplate() {
const cleaned = blocks.filter((b) => b.description.trim() !== "");
if (cleaned.length === 0) {
alert("Compila almeno un blocco prima di salvarlo come template.");
return;
}
setTemplateNameDraft(title || "");
setShowTemplatePrompt(true);
}

async function handleSaveAsTemplate(name: string) {
if (!name || !name.trim()) return;
const cleaned = blocks.filter((b) => b.description.trim() !== "");
if (cleaned.length === 0) {
alert("Compila almeno un blocco prima di salvarlo come template.");
return;
}
setSavingTemplate(true);
try {
const res = await fetch("/api/templates", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ name: name.trim(), blocks: cleaned, activityType }),
});
const data = await res.json();
if (!res.ok) {
alert(data.error || "Errore nel salvataggio del template");
return;
}
setTemplates((t) => [
{ id: data.template.id, name: data.template.name, activity_type: activityType, blocks: cleaned },
...t,
]);
setTemplateMsg(`Salvato come "${data.template.name}"`);
setTimeout(() => setTemplateMsg(null), 2500);
} catch {
alert("Errore di rete, riprova");
} finally {
setSavingTemplate(false);
}
}

function updateBlock(index: number, patch: Partial<Block>) {
setBlocks((b) => b.map((blk, i) => (i === index ? { ...blk, ...patch } : blk)));
}

function addBlock(type?: string) {
setBlocks((b) => {
const next = [...b, type ? { ...emptyBlock(), type } : emptyBlock()];
setOpenBlocks((s) => new Set(s).add(next.length - 1));
return next;
});
}

function removeBlock(index: number) {
setBlocks((b) => b.filter((_, i) => i !== index));
setOpenBlocks((s) => {
const next = new Set<number>();
s.forEach((i) => {
if (i < index) next.add(i);
else if (i > index) next.add(i - 1);
});
return next;
});
}

function toggleBlock(index: number) {
setOpenBlocks((s) => {
const next = new Set(s);
if (next.has(index)) next.delete(index);
else next.add(index);
return next;
});
}

function handleSave() {
const cleaned = blocks.filter((b) => b.description.trim() !== "");
onSave({ title: title.trim() || "Allenamento", blocks: cleaned, activityType });
}

const datePill = formatDatePill(date);

return (
<>
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 space-y-5">
<div className="flex items-center gap-2 text-gray-400">
<IconEdit className="w-4 h-4" />
<p className="text-xs font-medium uppercase tracking-wide">Modifica la sessione</p>
</div>

<input
className="w-full text-xl font-semibold border-none outline-none px-0 placeholder:text-gray-300"
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="es. WOD, Giorno 1…"
/>

<div className="flex flex-wrap gap-2">
{datePill && (
<span className="bg-gray-100 text-gray-600 rounded-full px-4 py-1.5 text-sm">
{datePill}
</span>
)}
{ACTIVITY_TYPES.map((t) => (
<button
key={t}
type="button"
onClick={() => setActivityType(activityType === t ? null : t)}
className={
activityType === t
? "bg-brand text-brand-dark font-semibold rounded-full px-4 py-1.5 text-sm"
: "bg-gray-100 text-gray-700 rounded-full px-4 py-1.5 text-sm hover:bg-gray-200"
}
>
{t}
</button>
))}
</div>

<div className="space-y-2">
{blocks.map((block, i) => (
<BlockEditor
key={i}
block={block}
open={openBlocks.has(i)}
onToggle={() => toggleBlock(i)}
onChange={(patch) => updateBlock(i, patch)}
onRemove={() => removeBlock(i)}
/>
))}
</div>

<div className="flex flex-wrap items-center gap-2">
<button onClick={() => addBlock()} className="btn-secondary text-sm">
+ Aggiungi blocco
</button>
<button onClick={() => addBlock("Nota per l'atleta")} className="btn-secondary text-sm">
+ Nota per l&apos;atleta
</button>
{templates.length > 0 && (
<select
className="input text-sm w-auto"
value=""
onChange={(e) => {
if (e.target.value) handleLoadTemplate(e.target.value);
}}
>
<option value="">Carica da template…</option>
{templates.map((t) => (
<option key={t.id} value={t.id}>
{t.name}
</option>
))}
</select>
)}
<button
type="button"
onClick={openSaveAsTemplate}
disabled={savingTemplate}
className="btn-secondary text-sm"
>
{savingTemplate ? "Salvataggio…" : "Salva come template"}
</button>
{templateMsg && <span className="text-xs text-green-600">{templateMsg}</span>}
</div>

<div className="flex items-center justify-between pt-3 border-t border-gray-100">
<div className="flex gap-2">
<button onClick={onCancel} className="btn-secondary">
Annulla
</button>
{onDelete && (
<button onClick={onDelete} className="text-red-600 text-sm px-3">
Elimina scheda
</button>
)}
</div>
<button onClick={handleSave} disabled={saving} className="btn-primary">
{saving ? "Salvataggio…" : "Salva"}
</button>
</div>
</div>
</div>
{showTemplatePrompt && (
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
<div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
<p className="text-sm font-semibold text-gray-900">Nome del template</p>
<input
autoFocus
className="input w-full"
placeholder='es. "Push A"'
value={templateNameDraft}
onChange={(e) => setTemplateNameDraft(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") {
const name = templateNameDraft;
setShowTemplatePrompt(false);
handleSaveAsTemplate(name);
}
}}
/>
<div className="flex justify-end gap-2">
<button type="button" onClick={() => setShowTemplatePrompt(false)} className="btn-secondary text-sm">
Annulla
</button>
<button
type="button"
onClick={() => {
const name = templateNameDraft;
setShowTemplatePrompt(false);
handleSaveAsTemplate(name);
}}
className="btn-primary text-sm"
>
Salva
</button>
</div>
</div>
</div>
)}
</>
);
}

function BlockEditor({
block,
open,
onToggle,
onChange,
onRemove,
}: {
block: Block;
open: boolean;
onToggle: () => void;
onChange: (patch: Partial<Block>) => void;
onRemove: () => void;
}) {
const [showTimerPreview, setShowTimerPreview] = useState(false);
const isNote = block.type === "Nota per l'atleta";
const isCustomType = !BLOCK_TYPES.includes(block.type);
const summary = timerSummary(block);
const scores = getBlockScores(block);

function updateScore(scoreIndex: number, patch: Partial<ScoreConfig>) {
const next = scores.map((s, i) => (i === scoreIndex ? { ...s, ...patch } : s));
onChange({ scores: next, score: null });
}

function addScore() {
onChange({ scores: [...scores, emptyScoreConfig()], score: null });
}

function removeScore(scoreIndex: number) {
const next = scores.filter((_, i) => i !== scoreIndex);
onChange({ scores: next, score: null });
}

if (!open) {
return (
<button
type="button"
onClick={onToggle}
className={`w-full text-left border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
isNote ? "bg-amber-50" : "bg-white hover:bg-gray-50"
}`}
>
<div className="min-w-0">
<div className="flex items-center gap-2 mb-0.5">
<span
className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
isNote ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"
}`}
>
{block.type}
</span>
{summary && (
<span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
<circle cx="12" cy="12" r="8" />
<path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
</svg>
{summary}
</span>
)}
</div>
<p className="text-xs text-gray-400 truncate">{blockPreview(block)}</p>
</div>
<span className="text-gray-300 shrink-0">▾</span>
</button>
);
}

return (
<div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
<div className="flex gap-2 items-center">
<select
className="input"
value={isCustomType ? "Altro" : block.type}
onChange={(e) => onChange({ type: e.target.value === "Altro" ? "" : e.target.value })}
>
{BLOCK_TYPES.map((t) => (
<option key={t} value={t}>
{t}
</option>
))}
</select>
<button
onClick={onToggle}
className="text-gray-400 hover:text-gray-700 text-sm px-2 shrink-0"
title="Comprimi"
>
▴
</button>
<button
onClick={onRemove}
className="text-gray-400 hover:text-red-600 text-sm px-2 shrink-0"
title="Rimuovi sezione"
>
✕
</button>
</div>

{isCustomType && (
<input
className="input"
placeholder="Scrivi il nome del blocco…"
value={block.type}
onChange={(e) => onChange({ type: e.target.value })}
/>
)}

<RichTextEditor
value={block.description}
onChange={(html) => onChange({ description: html })}
placeholder="Descrivi l'esercizio, le serie/ripetizioni, e incolla eventuali link a video…"
/>

{/* RPE */}
<ToggleSection
label="Aggiungere un RPE"
enabled={block.rpe !== null}
onToggle={(on) => onChange({ rpe: on ? 5 : null })}
>
{block.rpe !== null && (
<div className="flex items-center gap-3">
<input
type="range"
min={1}
max={10}
value={block.rpe}
onChange={(e) => onChange({ rpe: Number(e.target.value) })}
className="flex-1"
/>
<span className="text-sm font-semibold w-6 text-center">{block.rpe}</span>
</div>
)}
</ToggleSection>

{/* Punteggio / Obiettivo */}
<ToggleSection
label="Chiedere un punteggio / obiettivo"
enabled={scores.length > 0}
onToggle={(on) =>
onChange(on ? { scores: [emptyScoreConfig()], score: null } : { scores: [], score: null })
}
>
{scores.map((score, si) => (
<div key={si} className="border border-gray-200 rounded-lg p-2.5 mb-2 bg-white">
{scores.length > 1 && (
<div className="flex items-center justify-between mb-1.5">
<p className="text-xs font-medium text-gray-500">Punteggio {si + 1}</p>
<button
type="button"
onClick={() => removeScore(si)}
className="text-gray-400 hover:text-red-600 text-xs"
title="Rimuovi questo punteggio"
>
✕
</button>
</div>
)}
<div className="grid grid-cols-2 gap-2">
<select
className="input"
value={score.type}
onChange={(e) => updateScore(si, { type: e.target.value })}
>
{SCORE_TYPES.map((s) => (
<option key={s.value} value={s.value}>
{s.label}
</option>
))}
</select>
<input
className="input"
placeholder="Obiettivo (es. 100 kg, sub 5:00…)"
value={score.target}
onChange={(e) => updateScore(si, { target: e.target.value })}
/>
</div>
<div className="grid grid-cols-2 gap-2 mt-2">
<div>
<label className="text-xs text-gray-500">Numero di serie</label>
<input
type="number"
min={1}
max={10}
className="input"
value={score.sets ?? 1}
onChange={(e) =>
updateScore(si, { sets: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })
}
/>
</div>
<div>
<label className="text-xs text-gray-500">Come combinare le serie</label>
<select
className="input"
value={score.aggregation ?? "elenco"}
onChange={(e) => updateScore(si, { aggregation: e.target.value })}
>
{AGGREGATION_TYPES.map((a) => (
<option key={a.value} value={a.value}>
{a.label}
</option>
))}
</select>
</div>
</div>
</div>
))}
{scores.length > 0 && (
<button type="button" onClick={addScore} className="text-xs text-brand-dark hover:underline">
+ Aggiungere un altro campo (es. peso e ripetizioni separati)
</button>
)}
{scores.length > 0 && (
<div className="mt-2">
<input
className="input"
placeholder="Nome esercizio per la progressione (es. Back Squat) — opzionale"
value={block.exerciseName || ""}
onChange={(e) => onChange({ exerciseName: e.target.value.trim() || null })}
/>
<p className="text-xs text-gray-400 mt-1">
Se lo compili, i punteggi inseriti dal cliente in blocchi con lo stesso nome
finiscono automaticamente nel grafico di progressione (pagina Progressi). Se il blocco
ha più campi punteggio, in grafico entra solo il primo.
</p>
</div>
)}
</ToggleSection>

{/* Timer */}
<ToggleSection
label="Aggiungere un timer"
enabled={block.timer !== null}
onToggle={(on) =>
onChange({
timer: on ? { type: TIMER_TYPES[0], minutes: 20, seconds: 0 } : null,
})
}
>
{block.timer && (
<div className="space-y-2">
{TIMER_TYPES.map((t) => {
const selected = block.timer!.type === t;
const meta = TIMER_META[t];
return (
<div
key={t}
className={`rounded-xl border overflow-hidden ${
selected ? "border-gray-800" : "border-gray-200"
}`}
>
<button
type="button"
onClick={() => {
if (t === "AMRAP") {
onChange({ timer: { type: "AMRAP", minutes: 20, seconds: 0 } });
} else if (t === "EMOM") {
onChange({ timer: { type: "EMOM", minutes: 1, seconds: 0, rounds: 10 } });
} else if (t === "TABATA") {
onChange({
timer: {
type: "TABATA",
minutes: 0,
seconds: 20,
restMinutes: 0,
restSeconds: 10,
rounds: 8,
},
});
} else {
onChange({ timer: { type: t, minutes: 10, seconds: 0 } });
}
}}
className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
>
<span
className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${meta.color}`}
>
{meta.icon}
</span>
<span className="min-w-0 flex-1">
<span className="block font-semibold text-sm text-gray-900">{TIMER_LABELS[t]}</span>
<span className="block text-xs text-gray-500 truncate">{meta.desc}</span>
</span>
<span className="text-gray-300 shrink-0">{selected ? "▴" : "▾"}</span>
</button>

{selected && (
<div className="px-3 pb-3">
{t === "AMRAP" ? (
<AmrapEditor timer={block.timer!} onChange={(nt) => onChange({ timer: nt })} />
) : t === "EMOM" ? (
<EmomEditor timer={block.timer!} onChange={(nt) => onChange({ timer: nt })} />
) : t === "TABATA" ? (
<TabataEditor timer={block.timer!} onChange={(nt) => onChange({ timer: nt })} />
) : (
<div className="space-y-2">
<DurationField
minutes={block.timer!.minutes ?? 0}
seconds={block.timer!.seconds ?? 0}
onMinutes={(m) => onChange({ timer: { ...block.timer!, minutes: m } })}
onSeconds={(s) => onChange({ timer: { ...block.timer!, seconds: s } })}
label="Durata"
/>
<p className="text-xs text-gray-400">
Tempo massimo per completare l&apos;allenamento. Il cliente registra il tempo
impiegato quando finisce.
</p>
</div>
)}
</div>
)}
</div>
);
})}
</div>
)}
{block.timer && (
<button
type="button"
onClick={() => setShowTimerPreview((s) => !s)}
className="text-xs text-brand-dark hover:underline mt-1"
>
{showTimerPreview ? "Nascondi anteprima timer" : "Prova il timer"}
</button>
)}
{block.timer && showTimerPreview && <WorkoutTimer timer={block.timer} />}
</ToggleSection>
</div>
);
}

// AMRAP semplice: un solo campo "Durata" (i giri li conta l'atleta durante
// l'allenamento, non si impostano qui). "Aggiungere un set" è un'opzione
// avanzata per chi vuole più finestre AMRAP con riposo tra una e l'altra —
// da quel momento in poi si passa a TimerSetsEditor.
function AmrapEditor({ timer, onChange }: { timer: TimerConfig; onChange: (t: TimerConfig) => void }) {
if (timer.sets && timer.sets.length > 0) {
return <TimerSetsEditor timer={timer} onChange={onChange} />;
}
const minutes = timer.minutes ?? 20;
const seconds = timer.seconds ?? 0;
return (
<div className="space-y-2">
<DurationField
minutes={minutes}
seconds={seconds}
onMinutes={(m) => onChange({ type: "AMRAP", minutes: m, seconds })}
onSeconds={(s) => onChange({ type: "AMRAP", minutes, seconds: s })}
label="Durata"
/>
<p className="text-xs text-gray-400">
Un solo campo: quanto dura l&apos;amrap. I giri li conta l&apos;atleta durante l&apos;allenamento.
</p>
<button
type="button"
onClick={() =>
onChange({
type: "AMRAP",
sets: [
{ minutes, seconds, restMinutes: 0, restSeconds: 0 },
{ minutes, seconds, restMinutes: 1, restSeconds: 0 },
],
})
}
className="text-xs text-gray-400 hover:text-gray-600"
>
+ Aggiungere un set (opzionale)
</button>
<p className="text-xs text-gray-400">
Come oggi, resta possibile aggiungere set extra con riposo tra uno e l&apos;altro, ma non è più il punto di partenza obbligato.
</p>
</div>
);
}

// EMOM semplice: "Durata" per giro + "Giri" che moltiplica da solo, senza
// dover aggiungere ogni giro a mano. "Aggiungere un set" resta disponibile
// come opzione avanzata (più blocchi EMOM diversi in sequenza).
function EmomEditor({ timer, onChange }: { timer: TimerConfig; onChange: (t: TimerConfig) => void }) {
if (timer.sets && timer.sets.length > 0) {
return <TimerSetsEditor timer={timer} onChange={onChange} />;
}
const minutes = timer.minutes ?? 1;
const seconds = timer.seconds ?? 0;
const rounds = timer.rounds ?? 10;
const total = (minutes * 60 + seconds) * rounds;
return (
<div className="space-y-2">
<DurationField
minutes={minutes}
seconds={seconds}
onMinutes={(m) => onChange({ type: "EMOM", minutes: m, seconds, rounds })}
onSeconds={(s) => onChange({ type: "EMOM", minutes, seconds: s, rounds })}
label="Durata/giro"
/>
<div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2">
<input
type="number"
min={1}
className="w-14 outline-none bg-transparent"
value={rounds}
onChange={(e) =>
onChange({ type: "EMOM", minutes, seconds, rounds: Math.max(1, Number(e.target.value) || 1) })
}
/>
<span className="ml-auto text-xs text-gray-400 shrink-0">Giri</span>
</div>
<p className="text-xs text-gray-400">
Due campi: quanto dura ogni giro e quanti giri fare. Il totale si calcola da solo.
</p>
<button
type="button"
onClick={() =>
onChange({
type: "EMOM",
sets: [
{ minutes, seconds, restMinutes: 0, restSeconds: 0 },
{ minutes, seconds, restMinutes: 0, restSeconds: 0 },
],
})
}
className="text-xs text-gray-400 hover:text-gray-600"
>
+ Aggiungere un set (opzionale)
</button>
<p className="text-xs text-gray-400">
Come oggi, resta possibile aggiungere set extra con riposo tra uno e l&apos;altro, ma non è più il punto di partenza obbligato.
</p>
<div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200">
<span className="text-gray-500">Durata totale</span>
<span className="font-semibold text-gray-700">{formatClock(total)}</span>
</div>
</div>
);
}

// TABATA: lavoro, recupero e round come campi separati e liberi (di default
// 20"/10"/8 round, il tabata classico, ma modificabili).
function TabataEditor({ timer, onChange }: { timer: TimerConfig; onChange: (t: TimerConfig) => void }) {
const minutes = timer.minutes ?? 0;
const seconds = timer.seconds ?? 20;
const restMinutes = timer.restMinutes ?? 0;
const restSeconds = timer.restSeconds ?? 10;
const rounds = timer.rounds ?? 8;
const total = (minutes * 60 + seconds + restMinutes * 60 + restSeconds) * rounds;

function patch(p: Partial<TimerConfig>) {
onChange({ type: "TABATA", minutes, seconds, restMinutes, restSeconds, rounds, ...p });
}

return (
<div className="space-y-2">
<DurationField
minutes={minutes}
seconds={seconds}
onMinutes={(m) => patch({ minutes: m })}
onSeconds={(s) => patch({ seconds: s })}
label="Lavoro"
/>
<DurationField
minutes={restMinutes}
seconds={restSeconds}
onMinutes={(m) => patch({ restMinutes: m })}
onSeconds={(s) => patch({ restSeconds: s })}
label="Recupero"
/>
<div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2">
<input
type="number"
min={1}
className="w-14 outline-none bg-transparent"
value={rounds}
onChange={(e) => patch({ rounds: Math.max(1, Number(e.target.value) || 1) })}
/>
<span className="ml-auto text-xs text-gray-400 shrink-0">Round</span>
</div>
<p className="text-xs text-gray-400">
Tre campi: lavoro, recupero e round. Il timer alterna da solo lavoro e recupero per ogni round.
</p>
<div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200">
<span className="text-gray-500">Durata totale</span>
<span className="font-semibold text-gray-700">{formatClock(total)}</span>
</div>
</div>
);
}

// Elenco dei set di un timer AMRAP/EMOM: il primo set ha solo la durata, ogni
// set successivo ha anche un riposo (in min/sec) prima che inizi. In fondo
// mostra la durata totale calcolata automaticamente (somma di tutto).
function TimerSetsEditor({
timer,
onChange,
}: {
timer: TimerConfig;
onChange: (t: TimerConfig) => void;
}) {
const sets = getTimerSets(timer);
const showRest = timer.type === "AMRAP"; // l'EMOM passa da un giro all'altro senza riposo

function updateSet(i: number, patch: Partial<TimerSet>) {
const next = sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
onChange({ type: timer.type, sets: next });
}

function addSet() {
const last = sets[sets.length - 1];
onChange({
type: timer.type,
sets: [...sets, { minutes: last.minutes, seconds: last.seconds, restMinutes: 0, restSeconds: 0 }],
});
}

function removeSet(i: number) {
if (sets.length <= 1) return;
onChange({ type: timer.type, sets: sets.filter((_, idx) => idx !== i) });
}

const total = totalTimerSeconds(sets);

return (
<div className="space-y-3">
{sets.map((s, i) => (
<div key={i} className="space-y-1.5">
{i > 0 && (
<div className="flex items-center justify-between gap-2 pt-1">
<p className="text-xs font-medium text-gray-500">
{TIMER_LABELS[timer.type]} {i + 1}
</p>
<button
type="button"
onClick={() => removeSet(i)}
className="text-gray-400 hover:text-red-600 text-xs"
title="Rimuovi set"
>
✕
</button>
</div>
)}
{i > 0 && showRest && (
<DurationField
minutes={s.restMinutes}
seconds={s.restSeconds}
onMinutes={(m) => updateSet(i, { restMinutes: m })}
onSeconds={(sec) => updateSet(i, { restSeconds: sec })}
label="Riposo"
/>
)}
<DurationField
minutes={s.minutes}
seconds={s.seconds}
onMinutes={(m) => updateSet(i, { minutes: m })}
onSeconds={(sec) => updateSet(i, { seconds: sec })}
label="Durata"
/>
</div>
))}
<button type="button" onClick={addSet} className="btn-secondary text-xs w-full">
+ Aggiungere un set
</button>
<div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200">
<span className="text-gray-500">Durata totale</span>
<span className="font-semibold text-gray-700">{formatClock(total)}</span>
</div>
</div>
);
}

function ToggleSection({
label,
enabled,
onToggle,
children,
}: {
label: string;
enabled: boolean;
onToggle: (on: boolean) => void;
children: React.ReactNode;
}) {
return (
<div>
<label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
<input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
{label}
</label>
{enabled && <div className="mt-2">{children}</div>}
</div>
);
}
