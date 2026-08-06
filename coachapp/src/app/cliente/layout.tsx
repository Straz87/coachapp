import { requireClientRole } from "@/lib/auth";
import SideNav from "@/components/SideNav";

const NAV_ITEMS = [
  { href: "/cliente", label: "I miei allenamenti", icon: "🏋️" },
  { href: "/cliente/progressi", label: "Progressi", icon: "📈" },
  { href: "/cliente/dieta", label: "Piano alimentare", icon: "🥗" },
  { href: "/cliente/chat", label: "Messaggi", icon: "💬" },
];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireClientRole();

  return (
    <div className="flex flex-col md:flex-row">
      <SideNav items={NAV_ITEMS} fullName={profile.full_name} />
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
