"use client";

import { useState } from "react";

export default function VetrinaQuickLink({ trainerId }: { trainerId: string }) {
    const [copied, setCopied] = useState(false);
    const path = `/vetrina/${trainerId}`;

  async function handleCopy(e: React.MouseEvent) {
        e.preventDefault();
        const url = `${window.location.origin}${path}`;
        try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
        } catch {}
  }

  return (
    <a href={path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-4 border-b border-gray-100 mb-6 hover:opacity-80 transition">
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-lg">🏪</div>
      
      <p className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">La tua vetrina pubblica</p>
      <button onClick={handleCopy} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 shrink-0">{copied ? "Copiato ✓" : "Copia"}</button>
      <span className="text-gray-400 shrink-0">↗</span>
    </a>
    );
}
