import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { generateId } from "../utils";
import { taskBuckets, taskPauseReasons } from "./schema";
import { BUCKET_POSITION_STEP } from "../task-defaults";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL!);
const db = drizzle(sql);

const DEFAULT_BUCKETS = [
  { name: "Comms", color: "#3b82f6" },
  { name: "Orders", color: "#f59e0b" },
  { name: "Layouts", color: "#8b5cf6" },
  { name: "Logistics", color: "#10b981" },
  { name: "Staff", color: "#ec4899" },
  { name: "Media", color: "#06b6d4" },
  { name: "Other", color: "#64748b" },
];

const DEFAULT_PAUSE_REASONS = [
  "Switched to other task",
  "Personal",
  "Waiting on info",
  "End of day",
  "Other",
];

async function main() {
  console.log("Seeding task buckets...");
  for (let i = 0; i < DEFAULT_BUCKETS.length; i++) {
    await db.insert(taskBuckets).values({
      id: generateId(),
      name: DEFAULT_BUCKETS[i].name,
      color: DEFAULT_BUCKETS[i].color,
      position: (i + 1) * BUCKET_POSITION_STEP,
    });
  }
  console.log(`  ${DEFAULT_BUCKETS.length} buckets created.`);

  console.log("Seeding pause reasons...");
  for (let i = 0; i < DEFAULT_PAUSE_REASONS.length; i++) {
    await db.insert(taskPauseReasons).values({
      id: generateId(),
      name: DEFAULT_PAUSE_REASONS[i],
      position: (i + 1) * BUCKET_POSITION_STEP,
    });
  }
  console.log(`  ${DEFAULT_PAUSE_REASONS.length} pause reasons created.`);

  console.log("Seed complete.");
}

main().catch(console.error);
