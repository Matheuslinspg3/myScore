import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPluggyProvider } from "@/lib/banking/pluggy-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await requireUser();
    const supabase = createAdminClient();
    const { data: connections } = await supabase
      .from("bank_connections")
      .select("external_item_id")
      .eq("owner_id", user.id)
      .eq("provider", "pluggy");
    const savedItemIds = [
      ...new Set(
        (connections ?? [])
          .map((connection) => connection.external_item_id)
          .filter(Boolean),
      ),
    ];
    const provider = getPluggyProvider();
    const items = savedItemIds.length
      ? (
          await Promise.all(
            savedItemIds.map(async (itemId) => {
              try {
                return await provider.getItem(itemId);
              } catch {
                return null;
              }
            }),
          )
        ).filter((item): item is NonNullable<typeof item> => item !== null)
      : await provider.getItems();
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        connector: item.connector,
      })),
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
