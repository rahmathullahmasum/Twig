import db from "../../db.server";
import { logger } from "../logger.server";
import { fetchAllAppEvents, type PartnerAppEvent } from "../partnerApi/queries.server";
import { classifyUninstallReason } from "./classifyUninstallReason";
import type { AppEventType } from "@prisma/client";

const EVENT_TYPE_MAP: Record<PartnerAppEvent["type"], AppEventType> = {
  RELATIONSHIP_INSTALLED: "INSTALLED",
  RELATIONSHIP_UNINSTALLED: "UNINSTALLED",
  RELATIONSHIP_REACTIVATED: "REACTIVATED",
  RELATIONSHIP_DEACTIVATED: "DEACTIVATED",
};

async function applyEvent(trackedAppId: string, event: PartnerAppEvent): Promise<void> {
  const type = EVENT_TYPE_MAP[event.type];
  const occurredAt = new Date(event.occurredAt);
  const shopGid = event.shop.id;

  await db.appEventLog.upsert({
    where: {
      trackedAppId_shopGid_type_occurredAt: { trackedAppId, shopGid, type, occurredAt },
    },
    create: {
      trackedAppId,
      shopGid,
      shopDomain: event.shop.myshopifyDomain,
      shopName: event.shop.name,
      type,
      occurredAt,
      reason: event.reason ?? null,
      description: event.description ?? null,
    },
    update: {},
  });

  if (type === "INSTALLED") {
    await db.shopInstallation.upsert({
      where: { trackedAppId_shopGid: { trackedAppId, shopGid } },
      create: {
        trackedAppId,
        shopGid,
        shopDomain: event.shop.myshopifyDomain,
        shopName: event.shop.name,
        shopAvatarUrl: event.shop.avatarUrl,
        isActive: true,
        installedAt: occurredAt,
      },
      update: {
        isActive: true,
        installedAt: occurredAt,
        uninstalledAt: null,
        reason: null,
        reasonCategory: null,
        shopDomain: event.shop.myshopifyDomain,
        shopName: event.shop.name,
        shopAvatarUrl: event.shop.avatarUrl,
      },
    });
  } else if (type === "UNINSTALLED") {
    const reasonCategory = classifyUninstallReason(event.reason, event.description);
    await db.shopInstallation.upsert({
      where: { trackedAppId_shopGid: { trackedAppId, shopGid } },
      create: {
        trackedAppId,
        shopGid,
        shopDomain: event.shop.myshopifyDomain,
        shopName: event.shop.name,
        shopAvatarUrl: event.shop.avatarUrl,
        isActive: false,
        // Actual install date unknown if we never saw the INSTALLED event
        // (e.g. it happened before this app was added to tracking).
        installedAt: occurredAt,
        uninstalledAt: occurredAt,
        reason: event.reason ?? null,
        description: event.description ?? null,
        reasonCategory,
      },
      update: {
        isActive: false,
        uninstalledAt: occurredAt,
        reason: event.reason ?? null,
        description: event.description ?? null,
        reasonCategory,
      },
    });
  }
  // REACTIVATED/DEACTIVATED: recorded in AppEventLog only for now -- these
  // reflect a billing-level pause/resume, not a full install/uninstall, and
  // don't change ShopInstallation.isActive. See CLAUDE.md.
}

/**
 * Pulls every new event for one tracked app since the last sync (with a
 * 1-hour overlap for safety -- re-processing is idempotent via the upserts
 * above) and applies them in chronological order to derive current state.
 */
export async function syncTrackedApp(trackedAppId: string): Promise<{ processed: number }> {
  const trackedApp = await db.trackedApp.findUniqueOrThrow({ where: { id: trackedAppId } });
  const cursor = await db.syncCursor.findUnique({ where: { trackedAppId } });

  const occurredAtMin = cursor?.lastOccurredAt
    ? new Date(cursor.lastOccurredAt.getTime() - 60 * 60 * 1000).toISOString()
    : undefined;

  const { events } = await fetchAllAppEvents(trackedApp.partnerGid, occurredAtMin);
  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  let maxOccurredAt = cursor?.lastOccurredAt ?? null;

  for (const event of events) {
    await applyEvent(trackedAppId, event);
    const occurredAt = new Date(event.occurredAt);
    if (!maxOccurredAt || occurredAt > maxOccurredAt) maxOccurredAt = occurredAt;
  }

  if (maxOccurredAt) {
    await db.syncCursor.upsert({
      where: { trackedAppId },
      create: { trackedAppId, lastOccurredAt: maxOccurredAt },
      update: { lastOccurredAt: maxOccurredAt },
    });
  }

  logger.info({ trackedAppId, name: trackedApp.name, count: events.length }, "Synced tracked app events");
  return { processed: events.length };
}
