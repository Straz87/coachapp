"use client";

import { useRouter } from "next/navigation";

export default function ClientSelector({
  clients,
  selected,
}: {
  clients: { id: string; name: string }[];
  selected: string | null;
}) {
  const router = useRouter();

  return (
    <select
      className="input max-w-xs"
      value={selected || ""}
      onChange={(e) => router.push(`/trainer/calendario?cliente=${e.target.value}`)}
    >
      <option value="" disabled>
        Seleziona un cliente…
      </option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
