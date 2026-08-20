"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconBell } from "@/components/icons";

type Notification = {
  id: string;
  client_id: string;
  client_name: string;
  workout_title: string;
  kind: "individual" | "group";
  date: string | null;
  group_id: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} g fa`;
}

// NotificationBell viene montato due volte per ogni apertura della dashboard
// (barra mobile + sidebar desktop, una delle due nascosta via CSS a seconda
// dello schermo). Senza questa cache condivisa, entrambe le istanze
// interrogano il database nello stesso istante duplicando la richiesta.
const pendingNotificationLoads = new Map<string, Promise<Notification[]>>();

function loadNotificationsOnce(
  supabase: ReturnType<typeof createClient>,
  trainerId: string
): Promise<Notification[]> {
  const existing = pendingNotificationLoads.get(trainerId);
  if (existing) return existing;

  const promise = supabase
    .from("notifications")
    .select("id, client_id, client_name, workout_title, kind, date, group_id, read_at, created_at")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false })
    .limit(20)
    .then(({ data }) => (data as Notification[]) || [])
    .finally(() => {
      pendingNotificationLoads.delete(trainerId);
    });

  pendingNotificationLoads.set(trainerId, promise);
  return promise;
}

export default function NotificationBell({ trainerId }: { trainerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const data = await loadNotificationsOnce(supabase, trainerId);
    setItems(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Nome canale univoco per istanza: NotificationBell viene montato due
    // volte (barra mobile + sidebar desktop), e Supabase Realtime non
    // permette due sottoscrizioni con lo stesso nome di canale.
    const instanceId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`notifications-${trainerId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `trainer_id=eq.${trainerId}` },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }
  }

  function goToSession(n: Notification) {
    setOpen(false);
    if (!n.date) return;
    const params =
      n.kind === "group" && n.group_id
        ? `gruppo=${n.group_id}`
        : `cliente=${n.client_id}`;
    router.push(`/trainer/calendario?${params}&data=${n.date}`);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        aria-label="Notifiche"
        className="relative w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
      >
        <IconBell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 text-left">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">Notifiche</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">Nessuna notifica per ora</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => goToSession(n)}
                className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
              >
                <p className="text-xs text-gray-800">
                  <span className="font-semibold">{n.client_name}</span> ha completato{" "}
                  <span className="font-medium">&ldquo;{n.workout_title}&rdquo;</span>
                  {n.kind === "group" ? " (gruppo)" : ""}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconBell } from "@/components/icons";

type Notification = {
  id: string;
  client_id: string;
  client_name: string;
  workout_title: string;
  kind: "individual" | "group" | "inattivita" | "scadenza" | "pagamento" | "prezzo_gruppo";
  date: string | null;
  group_id: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} g fa`;
}

export default function NotificationBell({ trainerId }: { trainerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, client_id, client_name, workout_title, kind, date, group_id, read_at, created_at")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notification[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Nome canale univoco per istanza: NotificationBell viene montato due
    // volte (barra mobile + sidebar desktop), e Supabase Realtime non
    // permette due sottoscrizioni con lo stesso nome di canale.
    const instanceId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`notifications-${trainerId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `trainer_id=eq.${trainerId}` },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }
  }

  function goToSession(n: Notification) {
    setOpen(false);
    // I promemoria (cliente inattivo / abbonamento in scadenza) non sono
    // legati a una giornata specifica: portano alla scheda del cliente.
    if (n.kind === "inattivita" || n.kind === "scadenza" || n.kind === "pagamento" || n.kind === "prezzo_gruppo") {
      router.push(`/trainer/clienti/${n.client_id}`);
      return;
    }
    if (!n.date) return;
    // Porta sempre alla vista di sola lettura della giornata (non
    // all'editor della scheda): il trainer deve vedere cosa ha fatto il
    // cliente, non ritrovarsi a modificare il programma per sbaglio.
    const params =
      n.kind === "group" && n.group_id
        ? `cliente=${n.client_id}&gruppo=${n.group_id}`
        : `cliente=${n.client_id}`;
    router.push(`/trainer/giornata?${params}&data=${n.date}`);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        aria-label="Notifiche"
        className="relative w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
      >
        <IconBell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 text-left">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">Notifiche</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">Nessuna notifica per ora</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => goToSession(n)}
                className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
              >
                <p className="text-xs text-gray-800">
                  {n.kind === "inattivita" ||
                  n.kind === "scadenza" ||
                  n.kind === "pagamento" ||
                  n.kind === "prezzo_gruppo" ? (
                    <>
                      <span>
                        {n.kind === "inattivita"
                          ? "⏰"
                          : n.kind === "scadenza"
                          ? "💳"
                          : n.kind === "prezzo_gruppo"
                          ? "⚠️"
                          : "💰"}{" "}
                      </span>
                      <span className="font-semibold">{n.client_name}</span>{" "}
                      <span className="font-medium">{n.workout_title}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{n.client_name}</span> ha completato{" "}
                      <span className="font-medium">&ldquo;{n.workout_title}&rdquo;</span>
                      {n.kind === "group" ? " (gruppo)" : ""}
                    </>
                  )}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
