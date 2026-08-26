import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPluggyItem } from "@/lib/banking/sync";
import { verifyWebhookSecret } from "@/lib/security/webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

const payloadSchema = z
  .object({
    event: z.string().min(1),
    eventId: z.string().min(1),
    itemId: z.string().uuid().optional(),
    clientUserId: z.string().uuid().optional(),
    data: z
      .object({
        itemId: z.string().uuid().optional(),
        clientUserId: z.string().uuid().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (
    !secret ||
    !verifyWebhookSecret(
      request.headers.get("x-myscore-webhook-secret"),
      secret,
    )
  ) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  try {
    const payload = payloadSchema.parse(await request.json());
    const supabase = createAdminClient();
    const itemId = payload.itemId ?? payload.data?.itemId;
    let ownerId = payload.clientUserId ?? payload.data?.clientUserId;

    if (!ownerId && itemId) {
      const { data } = await supabase
        .from("bank_connections")
        .select("owner_id")
        .eq("provider", "pluggy")
        .eq("external_item_id", itemId)
        .maybeSingle();
      ownerId = data?.owner_id;
    }

    const { error: insertError } = await supabase
      .from("webhook_events")
      .insert({
        owner_id: ownerId ?? null,
        provider: "pluggy",
        provider_event_id: payload.eventId,
        event_type: payload.event,
        payload,
        status: "received",
      });

    if (insertError?.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (insertError) throw insertError;

    if (
      ownerId &&
      itemId &&
      (payload.event === "item/created" ||
        payload.event === "item/updated" ||
        payload.event.startsWith("transactions/"))
    ) {
      await syncPluggyItem(ownerId, itemId);
    }

    await supabase
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "pluggy")
      .eq("provider_event_id", payload.eventId);

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Falha temporária no webhook." },
      { status: 500 },
    );
  }
}
