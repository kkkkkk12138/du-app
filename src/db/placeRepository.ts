import { Q } from '@nozbe/watermelondb';

import { database } from './database';
import { Memory, Place } from './models';
import {
  cityMark,
  cityPinyin,
  normalizeCityName,
  placeColor,
  recognizeCity,
  recognizeKnownCity,
  RecognizedCity,
} from '../services/placeRecognition';
import {
  resolveManualPlace,
  shouldGeocodeAmbiguousPlace,
} from '../services/placeGeocoding';

function normalizeRecognizedCity(city: RecognizedCity): RecognizedCity {
  const sourceName = city.name?.trim() ?? '';
  const known =
    recognizeKnownCity(sourceName) ||
    (city.pinyin ? recognizeKnownCity(city.pinyin) : undefined);
  const name = known?.name ?? sourceName;
  return {
    name,
    pinyin: known?.pinyin || cityPinyin(name),
    region: city.region ?? known?.region,
    countryCode: city.countryCode ?? known?.countryCode,
  };
}

function cityFromPlace(place: Place): RecognizedCity {
  return normalizeRecognizedCity({
    name: place.name,
    pinyin: place.pinyin,
    region: place.region,
    countryCode: place.countryCode,
  });
}

function cityKey(city: RecognizedCity) {
  return [
    normalizeCityName(city.name),
    normalizeCityName(city.region ?? ''),
    city.countryCode?.toLocaleUpperCase() ?? '',
  ].join('|');
}

async function createVisitedPlace(city: RecognizedCity, visitedAt: Date) {
  const normalizedCity = normalizeRecognizedCity(city);
  return database.get<Place>('places').create(place => {
    place.name = normalizedCity.name;
    place.chChar = cityMark(normalizedCity.name);
    place.pinyin = normalizedCity.pinyin;
    place.colorHex = placeColor(normalizedCity.name);
    place.type = 'visited';
    place.firstVisit = visitedAt;
    place.lastVisit = visitedAt;
    place.visitCount = 1;
    place.sortOrder = visitedAt.getTime();
    place.region = normalizedCity.region;
    place.countryCode = normalizedCity.countryCode;
  });
}

export async function resolvePlaceId(
  placeDetail?: string,
  visitedAt = new Date(),
  recognizedCity?: RecognizedCity,
) {
  if (!placeDetail?.trim()) {
    return undefined;
  }

  return database.write(async () => {
    const places = await database.get<Place>('places').query().fetch();
    const resolvedCity =
      recognizedCity ?? recognizeCity(placeDetail, places.map(cityFromPlace));

    if (!resolvedCity) {
      return undefined;
    }
    const city = normalizeRecognizedCity(resolvedCity);

    const normalized = cityKey(city);
    const existing =
      places.find(place => cityKey(cityFromPlace(place)) === normalized) ??
      places.find(
        place =>
          normalizeCityName(place.name) === normalizeCityName(city.name) &&
          (!place.countryCode || !city.countryCode),
      );

    if (existing) {
      if (
        (!existing.region && city.region) ||
        (!existing.countryCode && city.countryCode)
      ) {
        await existing.update(place => {
          place.region ||= city.region;
          place.countryCode ||= city.countryCode;
        });
      }
      return existing.id;
    }

    const created = await createVisitedPlace(city, visitedAt);
    return created.id;
  });
}

export async function getPlaceCity(placeId?: string) {
  if (!placeId) {
    return undefined;
  }
  const places = await database.get<Place>('places').query().fetch();
  const place = places.find(candidate => candidate.id === placeId);
  return place ? cityFromPlace(place) : undefined;
}

export async function getLatestRecognizedCity() {
  const [places, memories] = await Promise.all([
    database.get<Place>('places').query().fetch(),
    database
      .get<Memory>('memories')
      .query(
        Q.where('deleted', false),
        Q.where('is_future_letter', false),
        Q.where('status', 'published'),
      )
      .fetch(),
  ]);
  const placesById = new Map(places.map(place => [place.id, place]));
  const newestFirst = [...memories].sort(
    (left, right) => right.writtenAt.getTime() - left.writtenAt.getTime(),
  );

  for (const memory of newestFirst) {
    const place = memory.placeId ? placesById.get(memory.placeId) : undefined;
    if (place) {
      return cityFromPlace(place);
    }
    if (memory.placeCity) {
      return {
        name: memory.placeCity,
        pinyin: '',
        region: memory.placeRegion,
        countryCode: memory.placeCountryCode,
      };
    }
  }
  return undefined;
}

export async function reconcileMemoryPlaces() {
  const [places, memories] = await Promise.all([
    database.get<Place>('places').query().fetch(),
    database
      .get<Memory>('memories')
      .query(
        Q.where('deleted', false),
        Q.where('is_future_letter', false),
        Q.where('status', Q.notEq('draft')),
      )
      .fetch(),
  ]);
  const placesById = new Map(places.map(place => [place.id, place]));
  let reconciledCount = 0;

  await database.write(async () => {
    for (const place of places) {
      if (!place.name?.trim()) {
        continue;
      }
      const normalizedCity = cityFromPlace(place);
      const mark = cityMark(normalizedCity.name);
      if (
        place.name !== normalizedCity.name ||
        place.chChar !== mark ||
        place.pinyin !== normalizedCity.pinyin
      ) {
        await place.update(record => {
          record.name = normalizedCity.name;
          record.chChar = mark;
          record.pinyin = normalizedCity.pinyin;
        });
        reconciledCount += 1;
      }
    }

    for (const memory of memories) {
      const place = memory.placeId ? placesById.get(memory.placeId) : undefined;
      if (!place?.name?.trim()) {
        continue;
      }
      const needsPlaceUpdate =
        (!place.region && memory.placeRegion) ||
        (!place.countryCode && memory.placeCountryCode);
      if (needsPlaceUpdate) {
        await place.update(record => {
          record.region ||= memory.placeRegion;
          record.countryCode ||= memory.placeCountryCode;
        });
      }
    }

    for (const memory of memories) {
      const place = memory.placeId ? placesById.get(memory.placeId) : undefined;
      if (!place?.name?.trim()) {
        continue;
      }
      const storedCity = cityFromPlace(place);
      const needsMemoryUpdate =
        memory.placeCity !== storedCity.name ||
        memory.placeRegion !== storedCity.region ||
        memory.placeCountryCode !== storedCity.countryCode;
      if (needsMemoryUpdate) {
        await memory.update(record => {
          record.placeCity = storedCity.name;
          record.placeRegion = storedCity.region;
          record.placeCountryCode = storedCity.countryCode;
        });
        reconciledCount += 1;
      }
    }
  });

  const unresolved = memories.filter(
    memory => !memory.placeId && memory.placeDetail?.trim(),
  );
  if (unresolved.length === 0) {
    return reconciledCount;
  }
  const resolvedByMemory = new Map<
    string,
    { city: RecognizedCity; detail: string }
  >();
  for (const memory of unresolved) {
    const localCity = memory.placeCity
      ? {
          name: memory.placeCity,
          pinyin: '',
          region: memory.placeRegion,
          countryCode: memory.placeCountryCode,
        }
      : recognizeCity(memory.placeDetail, places.map(cityFromPlace));
    if (localCity) {
      resolvedByMemory.set(memory.id, {
        city: localCity,
        detail: memory.placeDetail ?? localCity.name,
      });
      continue;
    }
    if (memory.placeDetail && shouldGeocodeAmbiguousPlace(memory.placeDetail)) {
      const resolved = await resolveManualPlace(memory.placeDetail);
      if (resolved) {
        resolvedByMemory.set(memory.id, resolved);
      }
    }
  }

  return database.write(async () => {
    const byName = new Map(
      places.map(place => [cityKey(cityFromPlace(place)), place]),
    );
    for (const memory of unresolved) {
      const resolved = resolvedByMemory.get(memory.id);
      if (!resolved) {
        continue;
      }
      const { city } = resolved;

      const normalized = cityKey(city);
      let place =
        byName.get(normalized) ??
        Array.from(byName.values()).find(
          candidate =>
            normalizeCityName(candidate.name) ===
              normalizeCityName(city.name) &&
            (!candidate.countryCode || !city.countryCode),
        );
      if (!place) {
        place = await createVisitedPlace(city, memory.writtenAt);
        byName.set(normalized, place);
      } else {
        await place.update(record => {
          record.pinyin ||= city.pinyin;
          record.region ||= city.region;
          record.countryCode ||= city.countryCode;
          const firstVisit = record.firstVisit;
          const lastVisit = record.lastVisit;
          record.firstVisit =
            firstVisit && firstVisit.getTime() <= memory.writtenAt.getTime()
              ? firstVisit
              : memory.writtenAt;
          record.lastVisit =
            lastVisit && lastVisit.getTime() >= memory.writtenAt.getTime()
              ? lastVisit
              : memory.writtenAt;
          record.visitCount += 1;
          record.sortOrder = record.lastVisit?.getTime() ?? record.sortOrder;
        });
      }
      const storedCity = cityFromPlace(place);
      byName.set(cityKey(storedCity), place);
      await memory.update(record => {
        record.placeId = place?.id;
        record.placeDetail = resolved.detail;
        record.placeCity = storedCity.name;
        record.placeRegion = storedCity.region;
        record.placeCountryCode = storedCity.countryCode;
      });
      reconciledCount += 1;
    }

    return reconciledCount;
  });
}
