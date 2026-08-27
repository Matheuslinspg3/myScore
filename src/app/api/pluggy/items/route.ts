import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await requireUser();
    const supabase = await createClient();
    const { data: connections, error } = await supabase
      .from("bank_connections")
      .select("external_item_id, status, institutions(name, logo_url, primary_color)")
      .eq("owner_id", user.id)
      .eq("provider", "pluggy");
    if (error) throw error;
    return NextResponse.json({
      items: (connections ?? []).map((connection) => {
        const institution = connection.institutions?.[0];
        return {
          id: connection.external_item_id,
          status: connection.status,
          connector: {
            name: institution?.name ?? "Instituição vinculada",
            imageUrl: institution?.logo_url ?? undefined,
            primaryColor: institution?.primary_color ?? undefined,
          },
        };
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Não foi possível carregar as conexões Pluggy." },
      { status: 500 },
    );
  }
}
