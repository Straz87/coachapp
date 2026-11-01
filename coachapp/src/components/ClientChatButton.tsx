"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Pulsante "Messaggi" del calendario: apre la chat con questo cliente.
export default function ClientChatButton({
  clientId,
  className,
  children,
}: {
  clientId: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function open() {
    const { data } = await supabase.from("clients").select("profile_id").eq("id", clientId).maybeSingle();
    if (data?.profile_id) router.push(`/trainer/chat/${data.profile_id}`);
  }

  return (
    <button type="button" className={className} onClick={open} aria-label="Apri i messaggi">
      {children}
    </button>
  );
}
