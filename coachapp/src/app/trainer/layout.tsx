import { requireTrainer } from "@/lib/auth";
import SideNav from "@/components/SideNav";

const NAV_ITEMS = [
  { href: "/trainer", label: "Clienti", icon: "👥" },
  { href: "/trainer/gruppi", label: "Gruppi", icon: "🏷️" },
  { href: "/trainer/programmi", label: "Programmi", icon: "📋" },
  { href: "/trainer/calendario", label: "Calendario", icon: "📅" },
  { href: "/trainer/sconti", label: "Sconti", icon: "🎟️" },
  { href: "/trainer/chat", label: "Messaggi", icon: "💬" },
];

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireTrainer();

  return (
    <div className="flex flex-col md:flex-row">
      <SideNav items={NAV_ITEMS} fullName={profile.full_name} trainerId={profile.id} />
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
