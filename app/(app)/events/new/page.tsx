"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "../actions";

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    try {
      const result = await createEvent({
        name: fd.get("name") as string,
        startDate: fd.get("startDate") as string,
        endDate: fd.get("endDate") as string,
        venueName: (fd.get("venueName") as string) || undefined,
        venueCity: (fd.get("venueCity") as string) || undefined,
      });
      router.push(`/events/${result.slug}`);
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
        New Event
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
            placeholder="e.g. Miami Rally 2026"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Start Date</label>
            <input name="startDate" type="date" className="input-field" required />
          </div>
          <div>
            <label className="field-label">End Date</label>
            <input name="endDate" type="date" className="input-field" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Venue Name</label>
            <input
              name="venueName"
              className="input-field"
              placeholder="e.g. Fontainebleau"
            />
          </div>
          <div>
            <label className="field-label">Venue City</label>
            <input
              name="venueCity"
              className="input-field"
              placeholder="e.g. Miami, FL"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full justify-center"
          style={{ padding: "12px 24px", fontSize: "13px" }}
        >
          {saving ? "Creating..." : "Create Event"}
        </button>
      </form>
    </div>
  );
}
