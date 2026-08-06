"use client";

import { useRouter } from "next/navigation";

export default function GroupSelector({
  groups,
  selected,
}: {
  groups: { id: string; name: string }[];
  selected: string | null;
}) {
  const router = useRouter();

  return (
    <select
      className="input max-w-xs"
      value={selected || ""}
      onChange={(e) => router.push(`/trainer/calendario?gruppo=${e.target.value}`)}
    >
      <option value="" disabled>
        Seleziona un gruppo…
      </option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
