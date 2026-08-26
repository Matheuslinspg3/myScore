import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("archived", false)
      .order("name");
    if (error) throw error;
    return NextResponse.json({ people: data });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "Não foi possível listar." }, { status });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("people")
      .insert({
        owner_id: user.id,
        name: body.name,
        nickname: body.nickname ?? null,
        phone: body.phone ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ person: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "Não foi possível salvar." }, { status });
  }
}
