"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DietEditor({
  clientId,
  trainerId,
  planId,
  initialTitle,
  initialContent,
}: {
  clientId: string;
  trainerId: string;
  planId: string | null;
  initialTitle: string;
  initialContent: string;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    if (planId) {
      await supabase
        .from("diet_plans")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", planId);
    } else {
      await supabase.from("diet_plans").insert({
        client_id: clientId,
        trainer_id: trainerId,
        title,
        content,
      });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="text-sm font-medium">Titolo piano</label>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Contenuto</label>
        <textarea
          className="input mt-1"
          rows={16}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"es.\nColazione: ...\nPranzo: ...\nCena: ...\nSpuntini: ..."}
        />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Salvataggio…" : "Salva piano"}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>
    </div>
  );
}
