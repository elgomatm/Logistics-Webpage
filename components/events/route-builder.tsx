"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, MapPin } from "lucide-react";
import type { EventRoute, RouteStop } from "@/lib/event-parameters";
import { emptyRouteStop } from "@/lib/event-parameters";

interface RouteBuilderProps {
  route: EventRoute;
  onChange: (route: EventRoute) => void;
}

/* ── Single location row ────────────────────────────────────── */
function LocationFields({
  stop,
  onChange,
  label,
  onDelete,
  dragHandle,
}: {
  stop: RouteStop;
  onChange: (s: RouteStop) => void;
  label: string;
  onDelete?: () => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-3 items-start p-4 rounded-xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      {dragHandle}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span
            className="text-[9px] tracking-[0.22em] uppercase font-medium"
            style={{ color: "var(--champagne)" }}
          >
            {label}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded transition-colors duration-150"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="Location name"
            value={stop.name}
            onChange={(e) => onChange({ ...stop, name: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Address (optional)"
            value={stop.address}
            onChange={(e) => onChange({ ...stop, address: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={12} strokeWidth={1.5} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            className="input-field"
            placeholder="Google Maps share link"
            value={stop.googleMapsUrl}
            onChange={(e) => onChange({ ...stop, googleMapsUrl: e.target.value })}
            style={{ fontSize: "12px" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sortable stop wrapper ──────────────────────────────────── */
function SortableStop({
  stop,
  index,
  onChange,
  onDelete,
}: {
  stop: RouteStop;
  index: number;
  onChange: (s: RouteStop) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <LocationFields
        stop={stop}
        onChange={onChange}
        onDelete={onDelete}
        label={`Stop ${index + 1}`}
        dragHandle={
          <button
            type="button"
            className="mt-6 cursor-grab active:cursor-grabbing p-1"
            style={{ color: "var(--text-3)" }}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} strokeWidth={1.5} />
          </button>
        }
      />
    </div>
  );
}

/* ── Main builder ───────────────────────────────────────────── */
export default function RouteBuilder({ route, onChange }: RouteBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = route.stops.findIndex((s) => s.id === active.id);
      const newIdx = route.stops.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      onChange({ ...route, stops: arrayMove(route.stops, oldIdx, newIdx) });
    },
    [route, onChange],
  );

  const addStop = () => {
    onChange({ ...route, stops: [...route.stops, emptyRouteStop()] });
  };

  const updateStop = (idx: number, updated: RouteStop) => {
    const stops = [...route.stops];
    stops[idx] = updated;
    onChange({ ...route, stops });
  };

  const deleteStop = (idx: number) => {
    onChange({ ...route, stops: route.stops.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Start */}
      <LocationFields
        stop={route.start}
        onChange={(s) => onChange({ ...route, start: s })}
        label="Starting Location"
      />

      {/* Stops (draggable) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={route.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {route.stops.map((stop, i) => (
            <SortableStop
              key={stop.id}
              stop={stop}
              index={i}
              onChange={(s) => updateStop(i, s)}
              onDelete={() => deleteStop(i)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add stop button */}
      <button
        type="button"
        onClick={addStop}
        className="flex items-center justify-center gap-2 py-3 rounded-xl transition-colors duration-150"
        style={{
          border: "1px dashed var(--border-mid)",
          color: "var(--text-3)",
          fontSize: "11px",
          letterSpacing: "0.08em",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(var(--champ-rgb), 0.4)";
          e.currentTarget.style.color = "var(--champagne)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-mid)";
          e.currentTarget.style.color = "var(--text-3)";
        }}
      >
        <Plus size={13} strokeWidth={1.5} />
        Add Stop
      </button>

      {/* End */}
      <LocationFields
        stop={route.end}
        onChange={(s) => onChange({ ...route, end: s })}
        label="Final Destination"
      />
    </div>
  );
}
