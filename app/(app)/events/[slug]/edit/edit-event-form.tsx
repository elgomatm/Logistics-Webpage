"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EventFormFields from "@/components/events/event-form-fields";
import { updateEvent } from "../../actions";
import {
  emptyRoute,
  type EventFormState,
  type EventRoute,
} from "@/lib/event-parameters";

interface EditEventFormProps {
  event: {
    id: string;
    slug: string;
    name: string;
    startDate: string;
    endDate: string;
    venueName: string | null;
    venueCity: string | null;
    venueGoogleMapsUrl: string | null;
    route: unknown;
    totalCars: number | null;
    totalPeople: number | null;
    isDynamic: boolean;
    hasPublicElement: boolean;
    isRepeat: boolean;
    isLocal: boolean;
    status: string;
  };
}

function toFormState(ev: EditEventFormProps["event"]): EventFormState {
  const isMultiDay = ev.startDate !== ev.endDate;
  return {
    name: ev.name,
    isMultiDay,
    date: isMultiDay ? "" : ev.startDate,
    startDate: isMultiDay ? ev.startDate : "",
    endDate: isMultiDay ? ev.endDate : "",
    venueName: ev.venueName ?? "",
    venueCity: ev.venueCity ?? "",
    venueGoogleMapsUrl: ev.venueGoogleMapsUrl ?? "",
    totalCars: ev.totalCars != null ? String(ev.totalCars) : "",
    totalPeople: ev.totalPeople != null ? String(ev.totalPeople) : "",
    isDynamic: ev.isDynamic,
    hasPublicElement: ev.hasPublicElement,
    isRepeat: ev.isRepeat,
    isLocal: ev.isLocal,
    status: ev.status,
    route: (ev.route as EventRoute) ?? emptyRoute(),
  };
}

function serialize(s: EventFormState, slug: string) {
  const startDate = s.isMultiDay ? s.startDate : s.date;
  const endDate = s.isMultiDay ? s.endDate : s.date;
  return {
    name: s.name,
    slug,
    startDate,
    endDate,
    venueName: s.venueName.trim() || null,
    venueCity: s.venueCity.trim() || null,
    venueGoogleMapsUrl: s.venueGoogleMapsUrl.trim() || null,
    route: s.isDynamic ? s.route : null,
    totalCars: s.totalCars ? parseInt(s.totalCars, 10) : null,
    totalPeople: s.totalPeople ? parseInt(s.totalPeople, 10) : null,
    isDynamic: s.isDynamic,
    hasPublicElement: s.hasPublicElement,
    isRepeat: s.isRepeat,
    isLocal: s.isLocal,
    status: s.status,
  };
}

export default function EditEventForm({ event }: EditEventFormProps) {
  const router = useRouter();
  const [state, setState] = useState<EventFormState>(() => toFormState(event));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (updates: Partial<EventFormState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await updateEvent(event.id, serialize(state, event.slug));
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.push(`/events/${result.slug}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1
        className="font-bebas tracking-wide leading-none mb-6"
        style={{ fontSize: "clamp(28px, 2.5vw, 38px)", color: "var(--text-1)" }}
      >
        Edit Event
      </h1>

      <form
        onSubmit={handleSubmit}
        className="module-card p-6 max-w-[640px] flex flex-col gap-6"
      >
        <EventFormFields state={state} onChange={patch} isEdit />

        {error && (
          <p style={{ fontSize: "12px", color: "#ef4444" }}>{error}</p>
        )}

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
