import { NextResponse } from "next/server";
import { requireTrainer } from "@/lib/auth";

// DELETE /api/templates/[id]
// Elimina un template di allenamento del trainer.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, profile } = await requireTrainer();

  const { error } = await supabase
    .from("workout_templates")
    .delete()
    .eq("id", params.id)
    .eq("trainer_id", profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
