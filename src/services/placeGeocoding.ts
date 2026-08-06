import { NativeModules } from 'react-native';

import {
  cityPinyin,
  normalizeCityName,
  recognizeCity,
  recognizeKnownCity,
  RecognizedCity,
} from './placeRecognition';

export type NativeGeocodedPlace = {
  city?: string;
  locality?: string;
  subAdministrativeArea?: string;
  administrativeArea?: string;
  district?: string;
  region?: string;
  countryCode?: string;
  detail?: string;
};

export type ResolvedPlace = {
  city: RecognizedCity;
  detail: string;
};

type NativeGeocoder = {
  geocodeAddress(query: string): Promise<NativeGeocodedPlace | null>;
  reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<NativeGeocodedPlace | null>;
};

function geocoder() {
  return NativeModules.DuGeocoder as NativeGeocoder | undefined;
}

const directMunicipalities = new Set(['北京', '上海', '天津', '重庆']);
const prefectureSuffix = /(?:市|自治州|地区|盟)$/u;
const bareSubCityPlace = /^[\u4e00-\u9fff]{2,16}(?:区|县|旗|镇|乡|村)$/u;
const personalPlace =
  /(?:窗台|窗边|阳台|家里|家中|房间|卧室|客厅|厨房|书桌|床边|楼下|公司|办公室|工位|教室|宿舍)(?:边|里|内|附近)?$/u;
const coordinatePlace = /^-?\d{1,3}\.\d+\s*[,，]\s*-?\d{1,3}\.\d+$/u;

function clean(value?: string) {
  return value?.trim() || undefined;
}

export function selectFootprintCity(raw: NativeGeocodedPlace | null) {
  if (!raw) {
    return undefined;
  }
  const countryCode = clean(raw.countryCode)?.toLocaleUpperCase();
  const administrativeArea = clean(raw.administrativeArea ?? raw.region);
  const subAdministrativeArea = clean(raw.subAdministrativeArea);
  const locality = clean(raw.locality);
  const fallback = clean(raw.city);

  if (countryCode === 'CN') {
    const municipality = administrativeArea
      ? Array.from(directMunicipalities).find(
          name =>
            normalizeCityName(administrativeArea) === normalizeCityName(name),
        )
      : undefined;
    if (municipality) {
      return municipality;
    }
    const administrativeCandidates = [
      locality,
      subAdministrativeArea,
      fallback,
    ].filter((value): value is string => Boolean(value));
    const knownPrefecture = administrativeCandidates.find(candidate => {
      const known = recognizeKnownCity(candidate);
      return (
        known &&
        normalizeCityName(candidate) !==
          normalizeCityName(administrativeArea ?? '')
      );
    });
    if (knownPrefecture) {
      return knownPrefecture;
    }
    if (locality && prefectureSuffix.test(locality)) {
      return locality;
    }
    if (subAdministrativeArea && prefectureSuffix.test(subAdministrativeArea)) {
      return subAdministrativeArea;
    }
  }

  return locality ?? subAdministrativeArea ?? fallback ?? administrativeArea;
}

export function normalizedResult(
  raw: NativeGeocodedPlace | null,
  originalDetail: string,
): ResolvedPlace | undefined {
  const cityName = selectFootprintCity(raw);
  if (!cityName) {
    return undefined;
  }

  const knownCity = recognizeKnownCity(cityName);
  const normalizedCityName =
    knownCity?.name ?? cityName.replace(/(?:自治州|地区|盟|市)$/u, '');
  const city: RecognizedCity = {
    name: normalizedCityName,
    pinyin: Array.from(normalizedCityName).every(
      character => character.charCodeAt(0) <= 127,
    )
      ? normalizedCityName.toLocaleUpperCase()
      : knownCity?.pinyin || cityPinyin(normalizedCityName),
    region: clean(raw?.administrativeArea ?? raw?.region) ?? knownCity?.region,
    countryCode:
      clean(raw?.countryCode)?.toLocaleUpperCase() ?? knownCity?.countryCode,
  };
  const detail = originalDetail.trim();
  const includesCity = normalizeCityName(detail).includes(
    normalizeCityName(city.name),
  );

  return {
    city,
    detail: includesCity ? detail : `${city.name} · ${detail}`,
  };
}

export async function resolveManualPlace(
  detail: string,
): Promise<ResolvedPlace | undefined> {
  const normalizedDetail = detail.trim();
  const local = recognizeKnownCity(normalizedDetail);
  if (local) {
    return { city: local, detail: normalizedDetail };
  }
  const inferred = recognizeCity(normalizedDetail);
  if (
    !inferred &&
    (bareSubCityPlace.test(normalizedDetail) ||
      personalPlace.test(normalizedDetail))
  ) {
    return undefined;
  }

  const native = geocoder();
  if (!native) {
    return inferred ? { city: inferred, detail: normalizedDetail } : undefined;
  }

  try {
    return (
      normalizedResult(
        await native.geocodeAddress(normalizedDetail),
        normalizedDetail,
      ) ?? (inferred ? { city: inferred, detail: normalizedDetail } : undefined)
    );
  } catch {
    return inferred ? { city: inferred, detail: normalizedDetail } : undefined;
  }
}

export async function resolveCurrentPlace(
  latitude: number,
  longitude: number,
): Promise<ResolvedPlace | undefined> {
  const native = geocoder();
  if (!native) {
    return undefined;
  }

  try {
    const raw = await native.reverseGeocode(latitude, longitude);
    const coordinate = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const detail = raw?.detail?.trim() || coordinate;
    return normalizedResult(raw, detail);
  } catch {
    return undefined;
  }
}

export function shouldGeocodeAmbiguousPlace(detail: string) {
  const normalizedDetail = detail.trim();
  return Boolean(
    normalizedDetail &&
      !coordinatePlace.test(normalizedDetail) &&
      !personalPlace.test(normalizedDetail),
  );
}
