import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  confirmation: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.literal("APAGAR")),
});

export async function DELETE(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    await requireUser();
    bodySchema.parse(await request.json());
    const { connectionId } = await context.params;
    if (!z.string().uuid().safeParse(connectionId).success) {
      return NextResponse.json(
        { error: "Instituição inválida." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("delete_banking_connection", {
      p_connection_id: connectionId,
    });
    if (error) throw error;

    return NextResponse.json({ deleted: true, impact: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Digite APAGAR para confirmar." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const databaseCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : undefined;
    const databaseMessage =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
    if (
      databaseCode === "P0002" ||
      databaseMessage.includes("CONNECTION_NOT_FOUND")
    ) {
      return NextResponse.json(
        { error: "Instituição não encontrada." },
        { status: 404 },
      );
    }
    if (["42883", "PGRST202"].includes(databaseCode ?? "")) {
      return NextResponse.json(
        {
          error: "A exclusão ainda precisa da migration do Supabase.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível apagar a instituição." },
      { status: 500 },
    );
  }
}
