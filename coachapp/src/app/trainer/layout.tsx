import { requireTrainer } from "@/lib/auth";
import SideNav from "@/components/SideNav";

const NAV_ITEMS = [
  { href: "/trainer", label: "Clienti", icon: "👥" },
  { href: "/trainer/calendario", label: "Calendario", icon: "📅" },
  { href: "/trainer/chat", label: "Messaggi", icon: "💬" },
];

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireTrainer();

  return (
    <div className="flex">
      <SideNav items={NAV_ITEMS} fullName={profile.full_name} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
