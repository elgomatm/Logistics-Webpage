import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import EditEventForm from "./edit-event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePermission("events.edit");
  const { slug } = await params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) notFound();

  return <EditEventForm event={event} />;
}
