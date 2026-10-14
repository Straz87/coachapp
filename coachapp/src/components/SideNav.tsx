"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import PushSubscribeButton from "@/components/PushSubscribeButton";

type NavItem = { href: string; label: string; icon: string; short?: string };

export default function SideNav({
  items,
  barItems,
  moreItems,
  fullName,
  trainerId,
  isTrainer,
}: {
  items: NavItem[];
  barItems?: NavItem[];
  moreItems?: NavItem[];
  fullName: string;
  trainerId?: string;
  isTrainer?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const barList = barItems ?? items;
  const moreActive = (moreItems || []).some(
    (m) => pathname === m.href || pathname.startsWith(m.href + "/")
  );

  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    setMounted(true);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const showMobileBell = !mounted || !isDesktop;
  const showDesktopBell = mounted && isDesktop;

  // "Vista cliente (PROVA)": permette al trainer di entrare nell'account
  // cliente di test con un click, per controllare l'app come la vede un
  // cliente reale, senza dover fare logout e login a mano ogni volta.
  // Prima di passare all'account di prova salviamo la sessione owner in
  // sessionStorage (dura solo per questa scheda del browser) cosi da poterla
  // ripristinare subito con "Torna a owner".
  const [impersonating, setImpersonating] = useState(false);
  const [hasImpersonation, setHasImpersonation] = useState(false);
  useEffect(() => {
    setHasImpersonation(!!sessionStorage.getItem("impersonate_owner_session"));
  }, []);

  async function handleImpersonate() {
    setImpersonating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.setItem(
          "impersonate_owner_session",
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
        );
      }
      const res = await fetch("/api/trainer/impersonate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Errore nell'attivare la vista cliente.");
        sessionStorage.removeItem("impersonate_owner_session");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "magiclink",
      });
      if (error) {
        alert("Errore nel passaggio all'account di prova: " + error.message);
        sessionStorage.removeItem("impersonate_owner_session");
        return;
      }
      router.push("/cliente");
      router.refresh();
    } finally {
      setImpersonating(false);
    }
  }

  async function handleRestoreOwner() {
    const raw = sessionStorage.getItem("impersonate_owner_session");
    if (!raw) return;
    const { access_token, refresh_token } = JSON.parse(raw);
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    sessionStorage.removeItem("impersonate_owner_session");
    setHasImpersonation(false);
    if (error) {
      alert("Errore nel tornare all'account owner: " + error.message);
      return;
    }
    router.push("/trainer");
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra in alto visibile solo su mobile: apre il menu */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-gray-100 px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Apri menu"
          className="text-xl leading-none p-1 -ml-1"
        >
          ☰
        </button>
        <span className="text-lg font-bold flex-1 flex items-center gap-2"><img src="/logo-mark.svg" alt="" className="w-5 h-5 shrink-0" />Hybridmethod</span>
        {trainerId && showMobileBell && <NotificationBell trainerId={trainerId} />}
      </div>

      {/* Barra in basso solo su mobile e solo per i clienti: le sezioni
          principali sempre a un tocco, senza aprire il menu. */}
      {!trainerId && !isTrainer && barList.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {barList.map((item) => {
            const active =
              item.href === "/cliente"
                ? pathname === "/cliente" || pathname.startsWith("/cliente/allenamento")
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="flex flex-col items-center gap-0.5 text-[11px] flex-1 min-w-0"
              >
                <span
                  className={`w-12 h-7 rounded-full flex items-center justify-center text-lg leading-none ${
                    active ? "bg-brand" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`truncate max-w-full ${active ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                  {item.short || item.label}
                </span>
              </Link>
            );
          })}
          {moreItems && moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5 text-[11px] flex-1 min-w-0"
            >
              <span
                className={`w-12 h-7 rounded-full flex items-center justify-center text-lg leading-none ${
                  moreActive ? "bg-brand" : ""
                }`}
              >
                ⋯
              </span>
              <span className={moreActive ? "font-semibold text-gray-900" : "text-gray-500"}>Altro</span>
            </button>
          )}
        </div>
      )}

      {/* Foglio "Altro" dal basso: sezioni usate meno spesso */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />
            <ul className="space-y-1">
              {(moreItems || []).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium text-gray-800 hover:bg-gray-100"
                  >
                    <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Sfondo scuro dietro al menu quando è aperto su mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <nav
        className={`fixed md:static top-0 left-0 z-50 w-72 md:w-64 shrink-0 border-r border-gray-100 bg-white min-h-screen flex flex-col transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-6 flex items-center justify-between gap-2">
          <span className="text-xl font-bold flex items-center gap-2"><img src="/logo-mark.svg" alt="" className="w-[22px] h-[22px] shrink-0" />Hybridmethod</span>
          <div className="hidden md:block">{trainerId && showDesktopBell && <NotificationBell trainerId={trainerId} />}</div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Torna indietro"
            className="md:hidden text-xl leading-none p-1"
          >
            ←
          </button>
        </div>

        <ul className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active ? "bg-brand text-brand-dark" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="px-3 py-4 border-t border-gray-100 space-y-2">
          <p className="px-3 text-sm text-gray-500 truncate">{fullName}</p>
          <PushSubscribeButton />
          {isTrainer && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
            >
              🧪 {impersonating ? "Attivazione…" : "Vista cliente (PROVA)"}
            </button>
          )}
          {hasImpersonation && (
            <button
              onClick={handleRestoreOwner}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-brand-dark hover:text-gray-800"
            >
              🔧 Torna a owner
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            Esci
          </button>
        </div>
      </nav>
    </>
  );
}
