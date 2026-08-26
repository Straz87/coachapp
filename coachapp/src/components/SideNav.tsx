"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import PushSubscribeButton from "@/components/PushSubscribeButton";

type NavItem = { href: string; label: string; icon: string };

export default function SideNav({
items,
fullName,
trainerId,
isTrainer,
}: {
items: NavItem[];
fullName: string;
trainerId?: string;
isTrainer?: boolean;
}) {
const pathname = usePathname();
const router = useRouter();
const supabase = createClient();
const [open, setOpen] = useState(false);

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
<span className="text-lg font-bold flex-1">💪 Hybridmethod</span>
{trainerId && showMobileBell && <NotificationBell trainerId={trainerId} />}
</div>

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
<span className="text-xl font-bold">💪 Hybridmethod</span>
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
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import PushSubscribeButton from "@/components/PushSubscribeButton";

type NavItem = { href: string; label: string; icon: string };

export default function SideNav({
  items,
  fullName,
  trainerId,
}: {
  items: NavItem[];
  fullName: string;
  trainerId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

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
        <span className="text-lg font-bold flex-1">💪 Hybridmethod</span>
        {trainerId && showMobileBell && <NotificationBell trainerId={trainerId} />}
      </div>

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
          <span className="text-xl font-bold">💪 Hybridmethod</span>
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
