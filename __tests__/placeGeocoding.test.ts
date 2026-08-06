import { NativeModules } from 'react-native';

import {
  normalizedResult,
  resolveCurrentPlace,
  resolveManualPlace,
  selectFootprintCity,
  shouldGeocodeAmbiguousPlace,
} from '../src/services/placeGeocoding';

describe('place geocoding', () => {
  beforeEach(() => {
    (NativeModules as Record<string, unknown>).DuGeocoder = {
      geocodeAddress: jest.fn(async () => ({
        city: '哈尔滨市',
        locality: '哈尔滨市',
        subAdministrativeArea: '',
        administrativeArea: '黑龙江省',
        region: '黑龙江省',
        countryCode: 'CN',
        detail: '中央大街',
      })),
      reverseGeocode: jest.fn(async () => ({
        city: 'Paris',
        locality: 'Paris',
        subAdministrativeArea: 'Paris',
        administrativeArea: 'Île-de-France',
        region: 'Île-de-France',
        countryCode: 'FR',
        detail: '4e Arrondissement',
      })),
    };
  });

  test('uses the offline catalog before native geocoding', async () => {
    const resolved = await resolveManualPlace('哈尔滨的中央大街');

    expect(resolved?.city.name).toBe('哈尔滨');
    expect(
      (NativeModules.DuGeocoder as any).geocodeAddress,
    ).not.toHaveBeenCalled();
  });

  test('resolves an ambiguous road through the system geocoder', async () => {
    await expect(resolveManualPlace('中央大街')).resolves.toEqual({
      city: {
        name: '哈尔滨',
        pinyin: 'HAERBIN',
        region: '黑龙江省',
        countryCode: 'CN',
      },
      detail: '哈尔滨 · 中央大街',
    });
  });

  test('reverse geocodes worldwide coordinates into a structured city', async () => {
    await expect(resolveCurrentPlace(48.8566, 2.3522)).resolves.toEqual({
      city: {
        name: 'Paris',
        pinyin: 'PARIS',
        region: 'Île-de-France',
        countryCode: 'FR',
      },
      detail: 'Paris · 4e Arrondissement',
    });
  });

  test('groups a direct-controlled municipality district under the municipality', () => {
    expect(
      normalizedResult(
        {
          city: '朝阳区',
          locality: '朝阳区',
          administrativeArea: '北京市',
          countryCode: 'CN',
        },
        '北京市朝阳区三里屯',
      ),
    ).toEqual({
      city: {
        name: '北京',
        pinyin: 'BEIJING',
        region: '北京市',
        countryCode: 'CN',
      },
      detail: '北京市朝阳区三里屯',
    });
  });

  test('groups a county-level city under its prefecture when iOS supplies both', () => {
    expect(
      normalizedResult(
        {
          city: '敦煌市',
          locality: '敦煌市',
          subAdministrativeArea: '酒泉市',
          administrativeArea: '甘肃省',
          countryCode: 'CN',
        },
        '敦煌市鸣沙山',
      ),
    ).toEqual({
      city: {
        name: '酒泉',
        pinyin: 'JIUQUAN',
        region: '甘肃省',
        countryCode: 'CN',
      },
      detail: '酒泉 · 敦煌市鸣沙山',
    });
  });

  test('uses the same hierarchy fields returned by Android Address', () => {
    expect(
      selectFootprintCity({
        city: '敦煌市',
        locality: '敦煌市',
        subAdministrativeArea: '酒泉市',
        administrativeArea: '甘肃省',
        district: '敦煌市',
        countryCode: 'CN',
      }),
    ).toBe('酒泉市');
    expect(
      selectFootprintCity({
        city: '酒泉市',
        locality: '酒泉市',
        subAdministrativeArea: '敦煌市',
        administrativeArea: '甘肃省',
        district: '敦煌市',
        countryCode: 'CN',
      }),
    ).toBe('酒泉市');
  });

  test('prefers overseas locality and falls back when it is unavailable', () => {
    expect(
      selectFootprintCity({
        locality: 'Paris',
        subAdministrativeArea: 'Paris',
        administrativeArea: 'Île-de-France',
        countryCode: 'FR',
      }),
    ).toBe('Paris');
    expect(
      selectFootprintCity({
        subAdministrativeArea: 'Greater London',
        administrativeArea: 'England',
        countryCode: 'GB',
      }),
    ).toBe('Greater London');
  });

  test('does not geocode personal places or bare ambiguous districts', async () => {
    await expect(resolveManualPlace('窗台边')).resolves.toBeUndefined();
    await expect(resolveManualPlace('朝阳区')).resolves.toBeUndefined();
    expect(
      (NativeModules.DuGeocoder as any).geocodeAddress,
    ).not.toHaveBeenCalled();
  });

  test('falls back to an explicit unknown city if native geocoding fails', async () => {
    (NativeModules.DuGeocoder as any).geocodeAddress.mockRejectedValueOnce(
      new Error('offline'),
    );

    await expect(resolveManualPlace('临海市紫阳街')).resolves.toEqual({
      city: {
        name: '临海',
        pinyin: 'LINHAI',
      },
      detail: '临海市紫阳街',
    });
  });

  test('only retries address-like historical details', () => {
    expect(shouldGeocodeAmbiguousPlace('中央大街')).toBe(true);
    expect(shouldGeocodeAmbiguousPlace('Oxford Street')).toBe(true);
    expect(shouldGeocodeAmbiguousPlace('响水')).toBe(true);
    expect(shouldGeocodeAmbiguousPlace('漠河')).toBe(true);
    expect(shouldGeocodeAmbiguousPlace('窗台边')).toBe(false);
    expect(shouldGeocodeAmbiguousPlace('公司')).toBe(false);
    expect(shouldGeocodeAmbiguousPlace('工位')).toBe(false);
    expect(shouldGeocodeAmbiguousPlace('31.23040, 121.47370')).toBe(false);
  });
});
