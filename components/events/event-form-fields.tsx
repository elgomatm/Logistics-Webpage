"use client";

import { MapPin } from "lucide-react";
import ToggleGroup from "./toggle-group";
import RouteBuilder from "./route-builder";
import type { EventFormState } from "@/lib/event-parameters";
import { dayCount, STATUS_GROUPS, EVENT_STATUS_LABELS } from "@/lib/event-parameters";

interface EventFormFieldsProps {
  state: EventFormState;
  onChange: (patch: Partial<EventFormState>) => void;
  isEdit?: boolean;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3
        className="font-bebas tracking-[0.1em] leading-none"
        style={{ fontSize: "20px", color: "var(--champagne)" }}
      >
        {label}
      </h3>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "10px", color: "var(--text-3)", marginTop: "-2px", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

export default function EventFormFields({ state, onChange, isEdit }: EventFormFieldsProps) {
  const days = state.isMultiDay ? dayCount(state.startDate, state.endDate) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Basics ──────────────────────────────────────────── */}
      <Section label="Basics">
        <div>
          <label className="field-label">Event Name</label>
          <input
            className="input-field"
            placeholder="e.g. Miami Rally 2026"
            maxLength={200}
            required
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
      </Section>

      {/* ── When ────────────────────────────────────────────── */}
      <Section label="When">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.isMultiDay}
            onChange={(e) => {
              const multi = e.target.checked;
              if (multi && state.date) {
                onChange({ isMultiDay: true, startDate: state.date, endDate: state.date });
              } else if (!multi && state.startDate) {
                onChange({ isMultiDay: false, date: state.startDate });
              } else {
                onChange({ isMultiDay: multi });
              }
            }}
            style={{ accentColor: "var(--champagne)" }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-2)" }}>Multi-day event</span>
        </label>

        {state.isMultiDay ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Start Date</label>
              <input
                type="date"
                className="input-field"
                required
                value={state.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">
                End Date{days !== null && days > 1 && (
                  <span style={{ color: "var(--text-3)", fontWeight: 400, letterSpacing: "0.05em" }}>
                    {" "}({days} days)
                  </span>
                )}
              </label>
              <input
                type="date"
                className="input-field"
                required
                min={state.startDate || undefined}
                value={state.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "260px" }}>
            <label className="field-label">Date</label>
            <input
              type="date"
              className="input-field"
              required
              value={state.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </div>
        )}
      </Section>

      {/* ── Where ───────────────────────────────────────────── */}
      <Section label="Where">
        {state.isDynamic ? (
          <>
            <Hint>
              This is a dynamic event with a driving portion. Add your route below.
            </Hint>
            <RouteBuilder
              route={state.route}
              onChange={(route) => onChange({ route })}
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Venue Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Fontainebleau"
                  value={state.venueName}
                  onChange={(e) => onChange({ venueName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">City</label>
                <input
                  className="input-field"
                  placeholder="e.g. Miami, FL"
                  value={state.venueCity}
                  onChange={(e) => onChange({ venueCity: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Google Maps Link</label>
              <div className="flex items-center gap-2">
                <MapPin size={14} strokeWidth={1.5} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                <input
                  className="input-field"
                  placeholder="https://maps.app.goo.gl/..."
                  value={state.venueGoogleMapsUrl}
                  onChange={(e) => onChange({ venueGoogleMapsUrl: e.target.value })}
                  style={{ fontSize: "12px" }}
                />
              </div>
              <Hint>Share link from Google Maps — used in guides.</Hint>
            </div>
          </>
        )}
      </Section>

      {/* ── Parameters ──────────────────────────────────────── */}
      <Section label="Parameters">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="field-label">Total Cars</label>
            <input
              type="number"
              min={0}
              className="input-field"
              placeholder="e.g. 25"
              style={{ maxWidth: "180px" }}
              value={state.totalCars}
              onChange={(e) => onChange({ totalCars: e.target.value })}
            />
            <Hint>Maximum number of cars expected.</Hint>
          </div>
          <div>
            <label className="field-label">Total People</label>
            <input
              type="number"
              min={0}
              className="input-field"
              placeholder="e.g. 80"
              style={{ maxWidth: "180px" }}
              value={state.totalPeople}
              onChange={(e) => onChange({ totalPeople: e.target.value })}
            />
            <Hint>Maximum number of attendees expected.</Hint>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label">Dynamic or Static</label>
            <ToggleGroup
              value={state.isDynamic}
              onChange={(v) => onChange({ isDynamic: v })}
              falseLabel="Static (no driving)"
              trueLabel="Dynamic (driving)"
            />
            <Hint>Is there any driving portion, or is the event purely stationary?</Hint>
          </div>

          <div>
            <label className="field-label">Public or Private</label>
            <ToggleGroup
              value={state.hasPublicElement}
              onChange={(v) => onChange({ hasPublicElement: v })}
              falseLabel="Fully private"
              trueLabel="Has public element"
            />
            <Hint>Is any part of the event open to the public?</Hint>
          </div>

          <div>
            <label className="field-label">Repeat or New</label>
            <ToggleGroup
              value={state.isRepeat}
              onChange={(v) => onChange({ isRepeat: v })}
              falseLabel="New event"
              trueLabel="Repeat event"
            />
            <Hint>Have we run this event before? Repeat events are easier because playbooks exist.</Hint>
          </div>

          <div>
            <label className="field-label">Local or Travel</label>
            <ToggleGroup
              value={state.isLocal}
              onChange={(v) => onChange({ isLocal: v })}
              falseLabel="Travel required"
              trueLabel="Local"
            />
            <Hint>Is this local (Austin / COTA area) or does it require travel?</Hint>
          </div>
        </div>
      </Section>

      {/* ── Status ──────────────────────────────────────────── */}
      <Section label="Status">
        <div style={{ maxWidth: "260px" }}>
          <select
            className="input-field"
            value={state.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            {STATUS_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.statuses.map((s) => (
                  <option key={s} value={s}>
                    {EVENT_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </Section>
    </div>
  );
}
