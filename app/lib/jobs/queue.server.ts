import PgBoss from "pg-boss";
import { logger } from "../logger.server";

export const JOBS = {
  SYNC_APP: "sync.app",
  SWEEP_ALL_APPS: "sweep.all-apps",
  SWEEP_SUBSCRIPTIONS: "sweep.subscriptions",
} as const;

let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("DATABASE_URL is required to start the job queue");
      const boss = new PgBoss({ connectionString });
      boss.on("error", (error) => logger.error({ error }, "pg-boss error"));
      await boss.start();
      for (const queue of Object.values(JOBS)) {
        await boss.createQueue(queue);
      }
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueueSyncApp(trackedAppId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send(JOBS.SYNC_APP, { trackedAppId });
}
