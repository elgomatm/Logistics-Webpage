export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MEDIUM_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MEDIUM_DATE_NO_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatDateLong(isoDate: string): string {
  return LONG_DATE.format(parseLocalDate(isoDate));
}

export function formatDateMedium(isoDate: string): string {
  return MEDIUM_DATE.format(parseLocalDate(isoDate));
}

export function formatEventDateRange(
  startIso: string,
  endIso: string,
): string {
  if (startIso === endIso) {
    return formatDateMedium(startIso);
  }

  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);

  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDateMedium(startIso)} – ${formatDateMedium(endIso)}`;
  }

  if (start.getMonth() === end.getMonth()) {
    const monthShort = MEDIUM_DATE_NO_YEAR.format(start).split(" ")[0];
    return `${monthShort} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${MEDIUM_DATE_NO_YEAR.format(start)} – ${MEDIUM_DATE_NO_YEAR.format(end)}, ${start.getFullYear()}`;
}

export function dayCount(startIso: string, endIso: string): number {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  const ms = end.getTime() - start.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days + 1);
}
