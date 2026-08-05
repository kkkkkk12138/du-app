export type FarawayUser = {
  currentCityId?: string;
  hometownId?: string;
  currentCityArrival?: Date;
};

export type FarawayPlace = {
  id: string;
  name: string;
  chChar: string;
  pinyin: string;
  colorHex: string;
  type: string;
  firstVisit?: Date;
  lastVisit?: Date;
  visitCount: number;
  sortOrder: number;
};

export type FarawayMemory = {
  id: string;
  content: string;
  placeId?: string;
  customTags: string;
  writtenAt: Date;
};

export type PlaceSummary = FarawayPlace & {
  memories: FarawayMemory[];
  latestMemory?: FarawayMemory;
  tags: string[];
  dateRange: string;
};

export type FarawayViewData = {
  current?: PlaceSummary & { stayedDays?: number };
  hometown?: PlaceSummary & { awayDays?: number };
  visited: PlaceSummary[];
  cityCount: number;
  locatedMemoryCount: number;
  yearsLabel?: string;
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calendarDaysBetween(from: Date, to: Date) {
  const milliseconds =
    startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}`;
}

export function formatPlaceDateRange(place: FarawayPlace) {
  if (!place.firstVisit && !place.lastVisit) {
    return '';
  }
  if (!place.firstVisit) {
    return formatMonth(place.lastVisit!);
  }
  if (!place.lastVisit) {
    return `${formatMonth(place.firstVisit)} — 至今`;
  }

  const first = formatMonth(place.firstVisit);
  const last = formatMonth(place.lastVisit);
  return first === last ? first : `${first} — ${last}`;
}

function parseTags(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function summarizePlace(
  place: FarawayPlace,
  memories: FarawayMemory[],
): PlaceSummary {
  const placeMemories = memories
    .filter(memory => memory.placeId === place.id)
    .sort(
      (left, right) => right.writtenAt.getTime() - left.writtenAt.getTime(),
    );
  const tags = Array.from(
    new Set(placeMemories.flatMap(memory => parseTags(memory.customTags))),
  ).slice(0, 3);
  const oldestMemory = placeMemories[placeMemories.length - 1];
  const latestMemory = placeMemories[0];
  const firstVisit = oldestMemory?.writtenAt;
  const lastVisit =
    place.type === 'current' ? undefined : latestMemory?.writtenAt;
  const visitCount = new Set(
    placeMemories.map(memory => {
      const date = memory.writtenAt;
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }),
  ).size;
  const activePlace = {
    ...place,
    firstVisit,
    lastVisit,
    visitCount,
  };

  return {
    ...activePlace,
    memories: placeMemories,
    latestMemory,
    tags,
    dateRange: formatPlaceDateRange(activePlace),
  };
}

export function buildFarawayViewData({
  user,
  places,
  memories,
  now = new Date(),
}: {
  user?: FarawayUser;
  places: FarawayPlace[];
  memories: FarawayMemory[];
  now?: Date;
}): FarawayViewData {
  const summaries = places
    .map(place => summarizePlace(place, memories))
    .filter(place => place.memories.length > 0);
  const byId = new Map(summaries.map(place => [place.id, place]));
  const currentBase = user?.currentCityId
    ? byId.get(user.currentCityId)
    : summaries.find(place => place.type === 'current');
  const hometownBase = user?.hometownId
    ? byId.get(user.hometownId)
    : summaries.find(place => place.type === 'hometown');
  const excludedIds = new Set(
    [currentBase?.id, hometownBase?.id].filter(
      (id): id is string => id !== undefined,
    ),
  );
  const visited = summaries
    .filter(place => !excludedIds.has(place.id))
    .sort((left, right) => {
      const dateDifference =
        (right.lastVisit?.getTime() ?? right.firstVisit?.getTime() ?? 0) -
        (left.lastVisit?.getTime() ?? left.firstVisit?.getTime() ?? 0);
      return dateDifference || right.sortOrder - left.sortOrder;
    });
  const datedPlaces = summaries
    .filter(place => place.id !== hometownBase?.id)
    .map(place => place.firstVisit ?? place.lastVisit)
    .filter((date): date is Date => date !== undefined);
  const earliestDate = datedPlaces.sort(
    (left, right) => left.getTime() - right.getTime(),
  )[0];
  const elapsedYears = earliestDate
    ? Math.max(0, now.getFullYear() - earliestDate.getFullYear())
    : undefined;

  return {
    current: currentBase
      ? {
          ...currentBase,
          stayedDays: user?.currentCityArrival
            ? calendarDaysBetween(user.currentCityArrival, now)
            : undefined,
        }
      : undefined,
    hometown: hometownBase
      ? {
          ...hometownBase,
          awayDays: hometownBase.lastVisit
            ? calendarDaysBetween(hometownBase.lastVisit, now)
            : undefined,
        }
      : undefined,
    visited,
    cityCount: summaries.length,
    locatedMemoryCount: memories.filter(
      memory => memory.placeId && byId.has(memory.placeId),
    ).length,
    yearsLabel:
      elapsedYears === undefined
        ? undefined
        : elapsedYears < 1
        ? '不到1年'
        : `${elapsedYears}年`,
  };
}
