"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: string };

export default function SideNav({
  items,
  fullName,
}: {
  items: NavItem[];
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="w-64 shrink-0 border-r border-gray-100 bg-white min-h-screen flex flex-col">
      <div className="px-6 py-6">
        <span className="text-xl font-bold">💪 Coach App</span>
      </div>

      <ul className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
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

      <div className="px-3 py-4 border-t border-gray-100">
        <p className="px-3 text-sm text-gray-500 truncate mb-2">{fullName}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
        >
          Esci
        </button>
      </div>
    </nav>
  );
}
