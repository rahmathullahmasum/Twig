import db from "../../db.server";
import { logger } from "../logger.server";
import { fetchActiveSubscription } from "../partnerApi/queries.server";

/**
 * Pulls the current pricing plan for every ACTIVE shop of one tracked app
 * (uninstalled shops don't have an active subscription to check, so they're
 * skipped -- saves API calls). One request per shop (the Partner API's
 * activeSubscription query takes a single appId+shopId, no bulk/paginated
 * form exists) -- the client's built-in 300ms pacing keeps this under the
 * 4 req/s rate limit automatically, but it does mean this is O(shops), not
 * O(1), per sync. Run less often than the main event/transaction sync if
 * the shop count grows large (see CLAUDE.md).
 */
export async function syncTrackedAppSubscriptions(trackedAppId: string): Promise<{ checked: number }> {
  const trackedApp = await db.trackedApp.findUniqueOrThrow({ where: { id: trackedAppId } });
  const activeShops = await db.shopInstallation.findMany({
    where: { trackedAppId, isActive: true },
    select: { id: true, shopGid: true },
  });

  let checked = 0;
  for (const shop of activeShops) {
    try {
      const subscription = await fetchActiveSubscription(trackedApp.partnerGid, shop.shopGid);
      const item = subscription?.items[0];

      await db.shopInstallation.update({
        where: { id: shop.id },
        data: {
          planHandle: item?.handle ?? null,
          planAmount: item?.price.amount ? parseFloat(item.price.amount) : null,
          planCurrencyCode: item?.price.currency ?? null,
          billingPeriod: subscription?.billingPeriod ?? null,
          trialEndsAt: subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
          subscriptionSyncedAt: new Date(),
        },
      });
      checked += 1;
    } catch (error) {
      logger.error({ error, trackedAppId, shopGid: shop.shopGid }, "Failed to sync subscription for shop");
    }
  }

  logger.info({ trackedAppId, name: trackedApp.name, checked }, "Synced tracked app subscriptions");
  return { checked };
}
