"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import { generateId, slugify, uniqueSlug } from "@/lib/utils";

interface EventInput {
  name: string;
  startDate: string;
  endDate: string;
  venueName?: string;
  venueCity?: string;
  totalCars?: number;
  totalPeople?: number;
  isDynamic?: boolean;
  hasPublicElement?: boolean;
  isRepeat?: boolean;
  isLocal?: boolean;
}

export async function createEvent(input: EventInput) {
  const session = await requirePermission("events.create");
  const userId = session.user!.id as string;
  const id = generateId();
  const base = slugify(input.name);
  const slug = await uniqueSlug(base, async (s) => {
    const [hit] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, s))
      .limit(1);
    return !!hit;
  });

  await db.insert(events).values({
    id,
    slug,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    venueName: input.venueName ?? null,
    venueCity: input.venueCity ?? null,
    totalCars: input.totalCars ?? 0,
    totalPeople: input.totalPeople ?? 0,
    isDynamic: input.isDynamic ?? false,
    hasPublicElement: input.hasPublicElement ?? false,
    isRepeat: input.isRepeat ?? false,
    isLocal: input.isLocal ?? false,
    status: "planning",
    createdBy: userId,
  });

  revalidatePath("/events");
  return { id, slug };
}

export async function updateEvent(
  eventId: string,
  updates: Partial<EventInput> & { status?: string },
) {
  await requirePermission("events.edit");

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.startDate !== undefined) data.startDate = updates.startDate;
  if (updates.endDate !== undefined) data.endDate = updates.endDate;
  if (updates.venueName !== undefined) data.venueName = updates.venueName;
  if (updates.venueCity !== undefined) data.venueCity = updates.venueCity;
  if (updates.totalCars !== undefined) data.totalCars = updates.totalCars;
  if (updates.totalPeople !== undefined) data.totalPeople = updates.totalPeople;
  if (updates.isDynamic !== undefined) data.isDynamic = updates.isDynamic;
  if (updates.hasPublicElement !== undefined)
    data.hasPublicElement = updates.hasPublicElement;
  if (updates.isRepeat !== undefined) data.isRepeat = updates.isRepeat;
  if (updates.isLocal !== undefined) data.isLocal = updates.isLocal;
  if (updates.status !== undefined) data.status = updates.status;

  await db.update(events).set(data).where(eq(events.id, eventId));
  revalidatePath("/events");
}
