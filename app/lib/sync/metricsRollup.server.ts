import db from "../../db.server";
import { logger } from "../logger.server";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Computes and upserts today's AppMetricsDaily row for one tracked app.
 * Safe to call repeatedly (idempotent upsert) -- run after every sync.
 * Only ever computes "today"; there's no historical backfill for days
 * before this app started being tracked.
 */
export async function computeAppMetricsForToday(trackedAppId: string): Promise<void> {
  const dayStart = startOfDay(new Date());
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const [activeInstalls, newInstallEvents, uninstallEvents] = await Promise.all([
    db.shopInstallation.count({ where: { trackedAppId, isActive: true } }),
    db.appEventLog.findMany({
      where: { trackedAppId, type: "INSTALLED", occurredAt: { gte: dayStart, lt: dayEnd } },
      select: { shopGid: true },
    }),
    db.appEventLog.count({
      where: { trackedAppId, type: "UNINSTALLED", occurredAt: { gte: dayStart, lt: dayEnd } },
    }),
  ]);

  let newInstalls = 0;
  let reinstalls = 0;
  for (const install of newInstallEvents) {
    const priorUninstall = await db.appEventLog.findFirst({
      where: {
        trackedAppId,
        shopGid: install.shopGid,
        type: "UNINSTALLED",
        occurredAt: { lt: dayStart },
      },
      select: { id: true },
    });
    if (priorUninstall) reinstalls += 1;
    else newInstalls += 1;
  }

  await db.appMetricsDaily.upsert({
    where: { trackedAppId_date: { trackedAppId, date: dayStart } },
    create: { trackedAppId, date: dayStart, activeInstalls, newInstalls, uninstalls: uninstallEvents, reinstalls },
    update: { activeInstalls, newInstalls, uninstalls: uninstallEvents, reinstalls },
  });

  logger.info({ trackedAppId, activeInstalls, newInstalls, reinstalls, uninstalls: uninstallEvents }, "Computed daily app metrics");
}
