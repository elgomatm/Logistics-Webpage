"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateEvent } from "../../actions";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/events/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEvent)
      .catch(() => null);
  }, [slug]);

  if (!event)
    return (
      <p style={{ color: "var(--text-3)", fontSize: "13px", padding: "40px" }}>
        Loading...
      </p>
    );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateEvent(event.id as string, {
        name: fd.get("name") as string,
        startDate: fd.get("startDate") as string,
        endDate: fd.get("endDate") as string,
        venueName: (fd.get("venueName") as string) || undefined,
        venueCity: (fd.get("venueCity") as string) || undefined,
      });
      router.push(`/events/${slug}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1
        className="font-bebas tracking-wide leading-none mb-6"
        style={{
          fontSize: "clamp(28px, 2.5vw, 38px)",
          color: "var(--text-1)",
        }}
      >
        Edit Event
      </h1>

      <form
        onSubmit={handleSubmit}
        className="module-card p-6 max-w-[600px] flex flex-col gap-5"
      >
        <div>
          <label className="field-label">Event Name</label>
          <input
            name="name"
            className="input-field"
            defaultValue={(event.name as string) ?? ""}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Start Date</label>
            <input
              name="startDate"
              type="date"
              className="input-field"
              defaultValue={(event.startDate as string) ?? ""}
              required
            />
          </div>
          <div>
            <label className="field-label">End Date</label>
            <input
              name="endDate"
              type="date"
              className="input-field"
              defaultValue={(event.endDate as string) ?? ""}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Venue Name</label>
            <input
              name="venueName"
              className="input-field"
              defaultValue={(event.venueName as string) ?? ""}
            />
          </div>
          <div>
            <label className="field-label">Venue City</label>
            <input
              name="venueCity"
              className="input-field"
              defaultValue={(event.venueCity as string) ?? ""}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
          style={{ padding: "12px 24px", fontSize: "13px" }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
