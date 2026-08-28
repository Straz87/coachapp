"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Foto e testo di presentazione mostrati in cima alla vetrina pubblica.
// La foto viene caricata direttamente dal browser del trainer (stesso
// bucket "progress-photos" gia' usato per le foto progressi, sotto una
// cartella "vetrina/"), cosi arriva al server alla qualita' originale,
// senza passare per ricompressioni intermedie.
export default function VetrinaProfileManager({
  trainerId,
  initialBio,
  initialPhotoUrl,
}: {
  trainerId: string;
  initialBio: string | null;
  initialPhotoUrl: string | null;
}) {
  const supabase = createClient();
  const [bio, setBio] = useState(initialBio || "");
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let nextPhotoUrl = photoUrl;

      if (file) {
        const path = "vetrina/" + trainerId + "/hero-" + Date.now() + "-" + file.name;
        const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, file);
        if (uploadError) {
          setError("Errore nel caricamento della foto: " + uploadError.message);
          setSaving(false);
          return;
        }
        const { data: publicUrlData } = supabase.storage.from("progress-photos").getPublicUrl(path);
        nextPhotoUrl = publicUrlData.publicUrl;
      }

      const res = await fetch("/api/trainer/vetrina-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, photoUrl: nextPhotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel salvataggio");
      } else {
        setPhotoUrl(nextPhotoUrl);
        setFile(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-3 mb-6">
      <h3 className="font-semibold text-sm">Foto e presentazione in vetrina</h3>
      <p className="text-xs text-gray-400">
        Compaiono in cima alla tua pagina vetrina pubblica, quella che condividi nella bio.
      </p>

      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          {(preview || photoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview || photoUrl || ""} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <label className="btn-secondary text-sm cursor-pointer inline-block">
            Scegli foto
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          <p className="text-xs text-gray-400 mt-1">Meglio orizzontale, es. mentre ti alleni.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500">Testo di presentazione</label>
        <textarea
          className="input mt-1 text-sm"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Ciao, sono... Ti alleno con..."
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? "Salvataggio…" : "Salva"}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>
    </div>
  );
}
