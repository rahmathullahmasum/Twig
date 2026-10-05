import db from "../../db.server";
import { logger } from "../logger.server";
import { fetchAllAppTransactions } from "../partnerApi/queries.server";

/**
 * Pulls every new revenue transaction for one tracked app since the last
 * sync. Separate cursor field from event sync (`SyncCursor.lastTransactionAt`)
 * since these come from a different Partner API query entirely.
 */
export async function syncTrackedAppTransactions(trackedAppId: string): Promise<{ processed: number }> {
  const trackedApp = await db.trackedApp.findUniqueOrThrow({ where: { id: trackedAppId } });
  const cursor = await db.syncCursor.findUnique({ where: { trackedAppId } });

  const createdAtMin = cursor?.lastTransactionAt
    ? new Date(cursor.lastTransactionAt.getTime() - 60 * 60 * 1000).toISOString()
    : undefined;

  const transactions = await fetchAllAppTransactions(trackedApp.partnerGid, createdAtMin);

  let maxCreatedAt = cursor?.lastTransactionAt ?? null;

  for (const txn of transactions) {
    const createdAt = new Date(txn.createdAt);
    await db.appTransaction.upsert({
      where: { partnerTransactionId: txn.id },
      create: {
        trackedAppId,
        partnerTransactionId: txn.id,
        type: txn.__typename,
        shopGid: txn.shop?.id ?? null,
        shopDomain: txn.shop?.myshopifyDomain ?? null,
        grossAmount: txn.grossAmount ? parseFloat(txn.grossAmount.amount) : null,
        netAmount: txn.netAmount ? parseFloat(txn.netAmount.amount) : null,
        currencyCode: txn.grossAmount?.currencyCode ?? txn.netAmount?.currencyCode ?? null,
        occurredAt: createdAt,
      },
      update: {},
    });
    if (!maxCreatedAt || createdAt > maxCreatedAt) maxCreatedAt = createdAt;
  }

  if (maxCreatedAt) {
    await db.syncCursor.upsert({
      where: { trackedAppId },
      create: { trackedAppId, lastTransactionAt: maxCreatedAt },
      update: { lastTransactionAt: maxCreatedAt },
    });
  }

  logger.info({ trackedAppId, name: trackedApp.name, count: transactions.length }, "Synced tracked app transactions");
  return { processed: transactions.length };
}
