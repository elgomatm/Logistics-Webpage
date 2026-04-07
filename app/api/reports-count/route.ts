import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const BASE_PATH =
  "/Users/malikelgomati/Library/CloudStorage/OneDrive-TheExchangeNetworkLLC/TEN/Events/2026";

const REPORT_EXTENSIONS = [".pptx", ".ppt", ".pdf"];

function isReportFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return REPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function GET() {
  try {
    // If the OneDrive path doesn't exist (e.g. running on Vercel), return gracefully
    if (!existsSync(BASE_PATH)) {
      return NextResponse.json(
        { total: 0, events: [], synced: false, error: "OneDrive path not accessible" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const eventFolders = readdirSync(BASE_PATH, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);

    const events: { name: string; count: number; files: string[] }[] = [];
    let total = 0;

    for (const eventName of eventFolders) {
      const reportsPath = join(BASE_PATH, eventName, "Documents", "Reports");

      if (existsSync(reportsPath) && statSync(reportsPath).isDirectory()) {
        const files = readdirSync(reportsPath).filter(isReportFile);
        total += files.length;
        events.push({ name: eventName, count: files.length, files });
      } else {
        events.push({ name: eventName, count: 0, files: [] });
      }
    }

    return NextResponse.json(
      { total, events, synced: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { total: 0, events: [], synced: false, error: String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
