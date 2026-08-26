"use client";

import { useEffect, useRef, useState } from "react";

// Editor di testo semplice (grassetto, corsivo, sottolineato, titoli, liste, link)
// pensato per descrivere gli esercizi e poter incollare link a video, come in Word.
export default function RichTextEditor({
value,
onChange,
placeholder,
}: {
value: string;
onChange: (html: string) => void;
placeholder?: string;
}) {
const ref = useRef<HTMLDivElement>(null);
const initialized = useRef(false);
// Selezione salvata al momento in cui si apre il modale per il link: aprire
// il modale sposta il focus fuori dall'area di testo e il browser perde la
// selezione, quindi va ripristinata a mano prima di creare il link.
const savedRange = useRef<Range | null>(null);
const [showLinkPrompt, setShowLinkPrompt] = useState(false);
const [linkDraft, setLinkDraft] = useState("");

useEffect(() => {
if (!initialized.current && ref.current) {
ref.current.innerHTML = value || "";
initialized.current = true;
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

function exec(command: string, arg?: string) {
ref.current?.focus();
document.execCommand(command, false, arg);
handleInput();
}

function handleInput() {
if (ref.current) onChange(ref.current.innerHTML);
}

function openLinkPrompt() {
const sel = window.getSelection();
if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
savedRange.current = sel.getRangeAt(0).cloneRange();
} else {
savedRange.current = null;
}
setLinkDraft("");
setShowLinkPrompt(true);
}

function applyLink(url: string) {
if (!url || !url.trim()) return;
ref.current?.focus();
const sel = window.getSelection();
if (sel && savedRange.current) {
sel.removeAllRanges();
sel.addRange(savedRange.current);
}
document.execCommand("createLink", false, url.trim());
handleInput();
}

return (
<>
<div className="border border-gray-200 rounded-xl overflow-hidden">
<div className="flex flex-wrap gap-1 bg-gray-50 border-b border-gray-200 p-1.5">
<ToolbarButton label="H1" onClick={() => exec("formatBlock", "H1")} />
<ToolbarButton label="H2" onClick={() => exec("formatBlock", "H2")} />
<ToolbarButton label="B" strong onClick={() => exec("bold")} />
<ToolbarButton label="I" em onClick={() => exec("italic")} />
<ToolbarButton label="U" underline onClick={() => exec("underline")} />
<ToolbarButton label="• Lista" onClick={() => exec("insertUnorderedList")} />
<ToolbarButton label="1. Lista" onClick={() => exec("insertOrderedList")} />
<ToolbarButton label="🔗 Link" onClick={openLinkPrompt} />
</div>
<div
ref={ref}
contentEditable
suppressContentEditableWarning
onInput={handleInput}
onBlur={handleInput}
data-placeholder={placeholder}
className="min-h-[110px] p-3 text-sm focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
/>
</div>
{showLinkPrompt && (
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
<div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
<p className="text-sm font-semibold text-gray-900">Incolla il link</p>
<input
autoFocus
className="input w-full"
placeholder="es. https://youtube.com/..."
value={linkDraft}
onChange={(e) => setLinkDraft(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") {
const url = linkDraft;
setShowLinkPrompt(false);
applyLink(url);
}
}}
/>
<div className="flex justify-end gap-2">
<button type="button" onClick={() => setShowLinkPrompt(false)} className="btn-secondary text-sm">
Annulla
</button>
<button
type="button"
onClick={() => {
const url = linkDraft;
setShowLinkPrompt(false);
applyLink(url);
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

function ToolbarButton({
label,
onClick,
strong,
em,
underline,
}: {
label: string;
onClick: () => void;
strong?: boolean;
em?: boolean;
underline?: boolean;
}) {
return (
<button
type="button"
onMouseDown={(e) => e.preventDefault()}
onClick={onClick}
className={`px-2 py-1 text-xs rounded hover:bg-gray-200 ${strong ? "font-bold" : ""} ${
em ? "italic" : ""
} ${underline ? "underline" : ""}`}
>
{label}
</button>
);
}
