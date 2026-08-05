"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toISODate } from "@/lib/dates";

export default function ProgressForm({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let photo_url: string | null = null;

    if (photo) {
      const path = `${clientId}/${Date.now()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(path, photo);

      if (uploadError) {
        setError("Errore nel caricamento della foto: " + uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("progress-photos").getPublicUrl(path);
      photo_url = publicUrl.publicUrl;
    }

    const { error: insertError } = await supabase.from("progress_logs").insert({
      client_id: clientId,
      date: toISODate(new Date()),
      weight_kg: weight ? Number(weight) : null,
      note: note || null,
      photo_url,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setWeight("");
    setNote("");
    setPhoto(null);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">Registra oggi</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Peso (kg)</label>
          <input
            type="number"
            step="0.1"
            className="input mt-1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Foto (facoltativa)</label>
          <input
            type="file"
            accept="image/*"
            className="input mt-1"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Note</label>
        <textarea className="input mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvataggio…" : "Salva"}
      </button>
    </form>
  );
}
