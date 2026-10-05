import "dotenv/config";
import db from "../../db.server";
import { logger } from "../logger.server";
import { getBoss, JOBS } from "./queue.server";
import { syncTrackedApp } from "../sync/syncApp.server";
import { syncTrackedAppTransactions } from "../sync/syncTransactions.server";
import { syncTrackedAppSubscriptions } from "../sync/syncSubscriptions.server";
import { computeAppMetricsForToday } from "../sync/metricsRollup.server";

// Every 15 minutes: fresh enough to notice a new uninstall quickly, well
// within the Partner API's 4 req/s limit (a handful of apps, one paginated
// query each).
const SWEEP_CRON = "*/15 * * * *";

// Subscription/plan sync is O(active shops), one API call each (no bulk
// query exists) -- daily is plenty for "which plan is this shop on" and
// keeps it well clear of the rate limit as more apps/shops are tracked.
const SUBSCRIPTION_SWEEP_CRON = "0 3 * * *";

async function main() {
  const boss = await getBoss();

  boss.work(JOBS.SYNC_APP, async ([job]) => {
    const { trackedAppId } = job.data as { trackedAppId: string };
    await syncTrackedApp(trackedAppId);
    await syncTrackedAppTransactions(trackedAppId);
    await computeAppMetricsForToday(trackedAppId);
  });

  boss.work(JOBS.SWEEP_ALL_APPS, async () => {
    const apps = await db.trackedApp.findMany({ select: { id: true, name: true } });
    logger.info({ count: apps.length }, "Sweeping tracked apps for Partner API sync");
    for (const app of apps) {
      await syncTrackedApp(app.id).catch((error) =>
        logger.error({ error, trackedAppId: app.id, name: app.name }, "Failed to sync app"),
      );
      await syncTrackedAppTransactions(app.id).catch((error) =>
        logger.error({ error, trackedAppId: app.id, name: app.name }, "Failed to sync app transactions"),
      );
      await computeAppMetricsForToday(app.id).catch((error) =>
        logger.error({ error, trackedAppId: app.id, name: app.name }, "Failed to compute metrics"),
      );
    }
  });

  boss.work(JOBS.SWEEP_SUBSCRIPTIONS, async () => {
    const apps = await db.trackedApp.findMany({ select: { id: true, name: true } });
    logger.info({ count: apps.length }, "Sweeping tracked apps for subscription/plan sync");
    for (const app of apps) {
      await syncTrackedAppSubscriptions(app.id).catch((error) =>
        logger.error({ error, trackedAppId: app.id, name: app.name }, "Failed to sync app subscriptions"),
      );
    }
  });

  await boss.schedule(JOBS.SWEEP_ALL_APPS, SWEEP_CRON, {});
  await boss.schedule(JOBS.SWEEP_SUBSCRIPTIONS, SUBSCRIPTION_SWEEP_CRON, {});

  logger.info("Job worker started");
}

main().catch((error) => {
  logger.error({ error }, "Worker failed to start");
  process.exit(1);
});
