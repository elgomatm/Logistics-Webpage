"use server";

import { eq, ne, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { events, activityLog } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import { generateId, slugify, uniqueSlug } from "@/lib/utils";
import type { EventRoute } from "@/lib/event-parameters";

export interface EventFormInput {
  name: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueCity: string | null;
  venueGoogleMapsUrl: string | null;
  route: EventRoute | null;
  totalCars: number | null;
  totalPeople: number | null;
  isDynamic: boolean;
  hasPublicElement: boolean;
  isRepeat: boolean;
  isLocal: boolean;
  status: string;
}

export interface EventUpdateInput extends EventFormInput {
  slug: string;
}

function validate(input: EventFormInput): string | null {
  if (!input.name?.trim()) return "Event name is required";
  if (input.name.length > 200) return "Event name too long (max 200)";
  if (!input.startDate) return "Start date is required";
  if (!input.endDate) return "End date is required";
  if (input.endDate < input.startDate) return "End date must be on or after start date";
  if (input.totalCars != null && input.totalCars < 0) return "Total cars cannot be negative";
  if (input.totalPeople != null && input.totalPeople < 0) return "Total people cannot be negative";
  return null;
}

export async function createEvent(input: EventFormInput) {
  const session = await requirePermission("events.create");
  const userId = session.user!.id as string;

  const error = validate(input);
  if (error) return { ok: false, error };

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
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    venueName: input.venueName || null,
    venueCity: input.venueCity || null,
    venueGoogleMapsUrl: input.venueGoogleMapsUrl || null,
    route: input.isDynamic ? input.route : null,
    totalCars: input.totalCars ?? null,
    totalPeople: input.totalPeople ?? null,
    isDynamic: input.isDynamic,
    hasPublicElement: input.hasPublicElement,
    isRepeat: input.isRepeat,
    isLocal: input.isLocal,
    status: input.status as "planning",
    createdBy: userId,
  });

  await db.insert(activityLog).values({
    id: generateId(),
    userId,
    entityType: "event",
    entityId: id,
    action: "event_created",
    metadata: { name: input.name.trim(), slug },
  });

  revalidatePath("/events");
  return { ok: true, slug };
}

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  const session = await requirePermission("events.edit");
  const userId = session.user!.id as string;

  const error = validate(input);
  if (error) return { ok: false, error };

  // Resolve slug
  let slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  if (!slug) slug = "event";

  // Ensure slug uniqueness (excluding this event)
  const finalSlug = await uniqueSlug(slug, async (s) => {
    const [hit] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.slug, s), ne(events.id, eventId)))
      .limit(1);
    return !!hit;
  });

  await db
    .update(events)
    .set({
      name: input.name.trim(),
      slug: finalSlug,
      startDate: input.startDate,
      endDate: input.endDate,
      venueName: input.venueName || null,
      venueCity: input.venueCity || null,
      venueGoogleMapsUrl: input.venueGoogleMapsUrl || null,
      route: input.isDynamic ? input.route : null,
      totalCars: input.totalCars ?? null,
      totalPeople: input.totalPeople ?? null,
      isDynamic: input.isDynamic,
      hasPublicElement: input.hasPublicElement,
      isRepeat: input.isRepeat,
      isLocal: input.isLocal,
      status: input.status as "planning",
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  await db.insert(activityLog).values({
    id: generateId(),
    userId,
    entityType: "event",
    entityId: eventId,
    action: "event_updated",
    metadata: { name: input.name.trim(), slug: finalSlug },
  });

  revalidatePath("/events");
  revalidatePath(`/events/${finalSlug}`);
  return { ok: true, slug: finalSlug };
}

export async function deleteEvent(eventId: string) {
  const session = await requirePermission("events.edit");
  const userId = session.user!.id as string;

  await db.insert(activityLog).values({
    id: generateId(),
    userId,
    entityType: "event",
    entityId: eventId,
    action: "event_deleted",
  });

  await db.delete(events).where(eq(events.id, eventId));
  revalidatePath("/events");
  return { ok: true };
}
