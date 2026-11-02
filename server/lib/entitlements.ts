import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Entitlement, SubscriptionPlanId } from "../../shared/billing.js";
import { config } from "../env.js";

interface StoredEntitlement extends Entitlement {
  userId: string;
  updatedAt: string;
}

const filePath = join(config.dataDir, "entitlements.json");
let writeQueue: Promise<void> = Promise.resolve();

export async function readEntitlement(userId: string): Promise<Entitlement> {
  const records = await readRecords();
  const record = records.find((candidate) => candidate.userId === userId);
  if (!record || !record.active || (record.renewsAt && Date.parse(record.renewsAt) <= Date.now())) {
    return { planId: "free", active: true, renewsAt: null, source: "none" };
  }
  return { planId: record.planId, active: true, renewsAt: record.renewsAt, source: record.source };
}

export async function writeEntitlement(input: {
  userId: string;
  planId: Exclude<SubscriptionPlanId, "free">;
  renewsAt: string;
  source: "apple" | "google" | "server";
}): Promise<Entitlement> {
  const records = await readRecords();
  const next: StoredEntitlement = {
    userId: input.userId,
    planId: input.planId,
    active: true,
    renewsAt: input.renewsAt,
    source: input.source,
    updatedAt: new Date().toISOString(),
  };
  const remaining = records.filter((record) => record.userId !== input.userId);
  remaining.push(next);
  await persist(remaining);
  return { planId: next.planId, active: true, renewsAt: next.renewsAt, source: next.source };
}

async function readRecords(): Promise<StoredEntitlement[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredEntitlement) : [];
  } catch {
    return [];
  }
}

async function persist(records: StoredEntitlement[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await mkdir(config.dataDir, { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), "utf8");
    await rename(temporary, filePath);
  });
  return writeQueue;
}

function isStoredEntitlement(value: unknown): value is StoredEntitlement {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredEntitlement>;
  return typeof candidate.userId === "string" &&
    (candidate.planId === "free" || candidate.planId === "pro" || candidate.planId === "vip") &&
    typeof candidate.active === "boolean" &&
    (candidate.renewsAt === null || typeof candidate.renewsAt === "string") &&
    (candidate.source === "none" || candidate.source === "apple" || candidate.source === "google" || candidate.source === "server");
}
