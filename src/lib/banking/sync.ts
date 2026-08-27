import { transactionFingerprint } from "@/lib/finance/deduplication";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPluggyProvider,
  PluggyApiError,
} from "@/lib/banking/pluggy-provider";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BankingAccount,
  BankingTransaction,
} from "@/lib/banking/types";
import { normalizeAccountType } from "@/lib/banking/account-type";

function moneyToCents(value: number | undefined): number {
  return Math.round((value ?? 0) * 100);
}

export class BankingResourceExcludedError extends Error {
  constructor(readonly resourceType: "item" | "account") {
    super("BANKING_RESOURCE_EXCLUDED");
    this.name = "BankingResourceExcludedError";
  }
}

async function persistTransactions(
  supabase: SupabaseClient,
  ownerId: string,
  localAccountId: string,
  account: BankingAccount,
  transactions: BankingTransaction[],
) {
  if (transactions.length === 0) return 0;
  const rows = transactions.map((transaction) => {
    const amountCents = moneyToCents(transaction.amount);
    return {
      owner_id: ownerId,
      account_id: localAccountId,
      source: "pluggy",
      external_id: transaction.id,
      dedupe_key: transactionFingerprint({
        accountId: account.id,
        date: transaction.date,
        amount: amountCents,
        description: transaction.description,
        providerCode: transaction.providerCode,
        balanceAfter:
          transaction.balance == null
            ? null
            : moneyToCents(transaction.balance),
      }),
      description: transaction.description,
      raw_description: transaction.descriptionRaw ?? null,
      merchant_name:
        transaction.merchant?.businessName ??
        transaction.merchant?.name ??
        null,
      merchant_document: transaction.merchant?.cnpj ?? null,
      amount_cents: amountCents,
      balance_after_cents:
        transaction.balance == null
          ? null
          : moneyToCents(transaction.balance),
      currency_code: transaction.currencyCode ?? "BRL",
      transaction_type:
        transaction.type === "CREDIT" ? "credit" : "debit",
      status: transaction.status === "PENDING" ? "pending" : "posted",
      booked_at: transaction.date,
      provider_category: transaction.category ?? null,
      provider_category_id: transaction.categoryId ?? null,
      provider_code: transaction.providerCode ?? null,
      provider_id: transaction.providerId ?? null,
      raw_data: transaction,
    };
  });

  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const { error } = await supabase
      .from("transactions")
      .upsert(chunk, { onConflict: "owner_id,source,external_id" });
    if (error) throw error;
  }
  return rows.length;
}

export async function syncPluggyItem(
  ownerId: string,
  itemId: string,
  supabase: SupabaseClient = createAdminClient(),
): Promise<{
  accounts: number;
  transactions: number;
  warnings: number;
  excludedAccounts: number;
}> {
  const { data: excludedItem, error: excludedItemError } = await supabase
    .from("banking_exclusions")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("provider", "pluggy")
    .eq("resource_type", "item")
    .eq("external_id", itemId)
    .maybeSingle();
  if (excludedItemError) throw excludedItemError;
  if (excludedItem) throw new BankingResourceExcludedError("item");

  const pluggy = getPluggyProvider();
  const startedAt = new Date().toISOString();
  const item = await pluggy.getItem(itemId);

  const { data: linkedConnection } = await supabase
    .from("bank_connections")
    .select("owner_id")
    .eq("provider", "pluggy")
    .eq("external_item_id", itemId)
    .maybeSingle();

  if (
    (linkedConnection && linkedConnection.owner_id !== ownerId) ||
    (!linkedConnection && item.clientUserId && item.clientUserId !== ownerId)
  ) {
    throw new Error("FORBIDDEN_ITEM");
  }

  const { data: institution, error: institutionError } = await supabase
    .from("institutions")
    .upsert(
      {
        owner_id: ownerId,
        provider: "pluggy",
        external_id: String(item.connector.id),
        name: item.connector.name,
        logo_url: item.connector.imageUrl ?? null,
        primary_color: item.connector.primaryColor ?? null,
      },
      { onConflict: "owner_id,provider,external_id" },
    )
    .select("id")
    .single();
  if (institutionError) throw institutionError;

  const { data: connection, error: connectionError } = await supabase
    .from("bank_connections")
    .upsert(
      {
        owner_id: ownerId,
        institution_id: institution.id,
        provider: "pluggy",
        external_item_id: item.id,
        status: item.status.toLowerCase(),
        last_synced_at: new Date().toISOString(),
        metadata: {
          connectorId: item.connector.id,
        },
      },
      { onConflict: "owner_id,provider,external_item_id" },
    )
    .select("id")
    .single();
  if (connectionError) throw connectionError;

  try {
    const accounts = await pluggy.getAccounts(itemId);
    const providerAccountIds = accounts.map((account) => account.id);
    const excludedAccountIds = new Set<string>();
    if (providerAccountIds.length > 0) {
      const { data: exclusions, error: exclusionsError } = await supabase
        .from("banking_exclusions")
        .select("external_id")
        .eq("owner_id", ownerId)
        .eq("provider", "pluggy")
        .eq("resource_type", "account")
        .in("external_id", providerAccountIds);
      if (exclusionsError) throw exclusionsError;
      for (const exclusion of exclusions ?? []) {
        excludedAccountIds.add(exclusion.external_id);
      }
    }

    let transactionCount = 0;
    let skippedTransactionAccounts = 0;
    let processedAccounts = 0;
    const skippedProviderCodes = new Set<string>();

    for (const account of accounts) {
      if (excludedAccountIds.has(account.id)) continue;
      processedAccounts += 1;
      const normalizedAccountType = normalizeAccountType(account.type);
      const { data: localAccount, error: accountError } = await supabase
        .from("accounts")
        .upsert(
          {
            owner_id: ownerId,
            connection_id: connection.id,
            institution_id: institution.id,
            provider_account_id: account.id,
            name: account.name,
            account_type: normalizedAccountType,
            subtype: account.subtype ?? null,
            masked_number: account.number
              ? account.number.slice(-4).padStart(account.number.length, "•")
              : null,
            balance_cents: moneyToCents(account.balance),
            available_balance_cents: moneyToCents(account.balance),
            currency_code: account.currencyCode ?? "BRL",
            is_active: true,
            last_synced_at: new Date().toISOString(),
            raw_data: account,
          },
          { onConflict: "owner_id,provider_account_id" },
        )
        .select("id")
        .single();
      if (accountError) throw accountError;

      if (normalizedAccountType === "credit") {
        const invoiceCents = Math.abs(moneyToCents(account.balance));
        const availableLimitCents = moneyToCents(
          account.creditData?.availableCreditLimit,
        );
        const reportedLimitCents = moneyToCents(
          account.creditData?.creditLimit,
        );
        const { error: cardError } = await supabase
          .from("credit_cards")
          .upsert(
            {
              owner_id: ownerId,
              account_id: localAccount.id,
              provider_card_id: account.id,
              name: account.name,
              brand: account.creditData?.brand ?? null,
              last_four: account.number?.slice(-4) ?? null,
              invoice_cents: invoiceCents,
              available_limit_cents: availableLimitCents,
              total_limit_cents:
                reportedLimitCents || availableLimitCents + invoiceCents,
              closing_date: account.creditData?.balanceCloseDate ?? null,
              due_date: account.creditData?.balanceDueDate ?? null,
              raw_data: account.creditData ?? {},
            },
            { onConflict: "owner_id,provider_card_id" },
          );
        if (cardError) throw cardError;
      }

      let transactions: BankingTransaction[];
      try {
        transactions = await pluggy.getTransactions(account.id);
      } catch (error) {
        if (
          error instanceof PluggyApiError &&
          error.operation === "transactions" &&
          [400, 404, 422].includes(error.status)
        ) {
          skippedTransactionAccounts += 1;
          skippedProviderCodes.add(
            error.providerCode ?? "HTTP_" + error.status,
          );
          continue;
        }
        throw error;
      }
      transactionCount += await persistTransactions(
        supabase,
        ownerId,
        localAccount.id,
        account,
        transactions,
      );
    }

    await supabase.from("sync_logs").insert({
      owner_id: ownerId,
      connection_id: connection.id,
      provider: "pluggy",
      status: skippedTransactionAccounts > 0 ? "partial" : "success",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      accounts_processed: processedAccounts,
      transactions_processed: transactionCount,
      error_code:
        skippedTransactionAccounts > 0
          ? "TRANSACTIONS_PARTIALLY_UNAVAILABLE"
          : null,
      metadata: {
        transaction_accounts_skipped: skippedTransactionAccounts,
        accounts_excluded_by_user: excludedAccountIds.size,
        provider_codes: [...skippedProviderCodes],
      },
    });

    return {
      accounts: processedAccounts,
      transactions: transactionCount,
      warnings: skippedTransactionAccounts,
      excludedAccounts: excludedAccountIds.size,
    };
  } catch (error) {
    await supabase.from("sync_logs").insert({
      owner_id: ownerId,
      connection_id: connection.id,
      provider: "pluggy",
      status: "failed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error_code: error instanceof Error ? error.name : "UNKNOWN",
    });
    throw error;
  }
}
