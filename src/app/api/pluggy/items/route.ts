import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPluggyProvider } from "@/lib/banking/pluggy-provider";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    await requireUser();
    const items = await getPluggyProvider().getItems();
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
