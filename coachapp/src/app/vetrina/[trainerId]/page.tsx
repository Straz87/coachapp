import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

// Pagina pubblica "vetrina": il trainer la mette nella bio Instagram al
// posto del link fisso di iscrizione, cosi chi la trova puo scegliere il
// percorso giusto per lui (coaching individuale, un gruppo o un programma
// a durata fissa) prima di iscriversi, invece di essere forzato su una
// sola opzione. Letta con il client admin perche va vista da chiunque,
// anche senza sessione Supabase.
export default async function VetrinaPage({
  params,
}: {
  params: { trainerId: string };
}) {
  const admin = createAdminClient();

  const { data: trainer } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", params.trainerId)
    .eq("role", "trainer")
    .maybeSingle();

  if (!trainer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-gray-500 text-sm">Pagina non disponibile.</p>
        </div>
      </div>
    );
  }

  const [{ data: link }, { data: groups }, { data: programs }] = await Promise.all([
    admin
      .from("public_signup_links")
      .select("price, trial_days, title, description")
      .eq("trainer_id", params.trainerId)
      .eq("active", true)
      .maybeSingle(),
    admin
      .from("workout_groups")
      .select("id, name, description, price, trial_days")
      .eq("trainer_id", params.trainerId)
      .eq("public", true)
      .order("created_at", { ascending: false }),
    admin
      .from("programs")
      .select("id, name, description, length_days, price, trial_days")
      .eq("trainer_id", params.trainerId)
      .eq("public", true)
      .order("created_at", { ascending: false }),
  ]);

  type Card = {
    key: string;
    title: string;
    description: string | null;
    priceLabel: string;
    extra?: string;
    href: string;
  };

  function priceLabel(price: number, trialDays: number) {
    const isFree = Number(price) <= 0;
    if (isFree) return "Gratuito";
    const trial = trialDays > 0 ? trialDays + " giorni di prova, poi " : "";
    return trial + price + "€/mese";
  }

  const cards: Card[] = [];

  if (link && link.price !== null && link.price !== undefined) {
    cards.push({
      key: "individuale",
      title: link.title || "Coaching individuale",
      description: link.description,
      priceLabel: priceLabel(link.price, link.trial_days || 0),
      href: "/iscriviti/" + params.trainerId,
    });
  }

  for (const group of groups || []) {
    if (group.price === null || group.price === undefined) continue;
    cards.push({
      key: "gruppo-" + group.id,
      title: group.name,
      description: group.description,
      priceLabel: priceLabel(group.price, group.trial_days || 0),
      href: "/iscriviti/" + params.trainerId + "/" + group.id,
    });
  }

  for (const program of programs || []) {
    if (program.price === null || program.price === undefined) continue;
    cards.push({
      key: "programma-" + program.id,
      title: program.name,
      description: program.description,
      priceLabel: priceLabel(program.price, program.trial_days || 0),
      extra: "Programma di " + program.length_days + " giorni",
      href: "/iscriviti-programma/" + params.trainerId + "/" + program.id,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8 mt-4">
          <p className="text-3xl mb-1">💪</p>
          <h1 className="text-xl font-bold">{trainer.full_name}</h1>
          <p className="text-gray-500 text-sm mt-1">Scegli il percorso più adatto a te</p>
        </div>

        {cards.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500 text-sm">Nessun percorso disponibile al momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((c) => (
              <Link key={c.key} href={c.href} className="card block hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{c.title}</h2>
                    {c.description && <p className="text-gray-500 text-sm mt-1">{c.description}</p>}
                    {c.extra && <p className="text-gray-400 text-xs mt-1">{c.extra}</p>}
                  </div>
                  <span className="text-brand-600 text-sm font-medium whitespace-nowrap">
                    {c.priceLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
