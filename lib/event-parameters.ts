export const EVENT_STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  tentative: "Tentative",
  wrapped: "Wrapped",
  closed: "Closed",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export const STATUS_GROUPS = [
  { label: "Common", statuses: ["planning", "wrapped", "closed"] },
  { label: "Exceptional", statuses: ["tentative", "postponed", "cancelled"] },
];

export interface RouteStop {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
}

export interface EventRoute {
  start: RouteStop;
  stops: RouteStop[];
  end: RouteStop;
}

export function emptyRouteStop(): RouteStop {
  return {
    id: crypto.randomUUID(),
    name: "",
    address: "",
    googleMapsUrl: "",
  };
}

export function emptyRoute(): EventRoute {
  return {
    start: emptyRouteStop(),
    stops: [],
    end: emptyRouteStop(),
  };
}

export interface EventFormState {
  name: string;
  isMultiDay: boolean;
  date: string;
  startDate: string;
  endDate: string;
  venueName: string;
  venueCity: string;
  venueGoogleMapsUrl: string;
  totalCars: string;
  totalPeople: string;
  isDynamic: boolean;
  hasPublicElement: boolean;
  isRepeat: boolean;
  isLocal: boolean;
  status: string;
  route: EventRoute;
}

export const EMPTY_EVENT_FORM: EventFormState = {
  name: "",
  isMultiDay: false,
  date: "",
  startDate: "",
  endDate: "",
  venueName: "",
  venueCity: "",
  venueGoogleMapsUrl: "",
  totalCars: "",
  totalPeople: "",
  isDynamic: false,
  hasPublicElement: false,
  isRepeat: false,
  isLocal: true,
  status: "planning",
  route: emptyRoute(),
};

export function dayCount(start: string, end: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}
