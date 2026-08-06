import {
  cityMark,
  cityPinyin,
  normalizeCityName,
  placeColor,
  recognizeCity,
  recognizeKnownCity,
} from '../src/services/placeRecognition';

describe('place recognition', () => {
  test.each([
    ['杭州', '杭州'],
    ['杭州市', '杭州'],
    ['Hangzhou', '杭州'],
    ['苏州 · 平江路', '苏州'],
    ['广东省深圳市南山区', '深圳'],
    ['丽水市莲都区', '丽水'],
    ['丽水', '丽水'],
    ['丽江 · 古城', '丽江'],
    ['大理', '大理'],
    ['今天在上海静安寺散步', '上海'],
    ['东京 · 新宿', '东京'],
    ['哈尔滨', '哈尔滨'],
    ['哈尔滨的中央大街', '哈尔滨'],
    ['北京市朝阳区', '北京'],
    ['阿坝藏族羌族自治州', '阿坝'],
    ['锡林郭勒盟', '锡林郭勒'],
  ])('recognizes %s as %s', (detail, city) => {
    expect(recognizeCity(detail)?.name).toBe(city);
  });

  test.each([
    '家里',
    '公司',
    '窗边',
    '窗台边',
    '朝阳区',
    '丽水县',
    '31.23040, 121.47370',
    '',
  ])('does not turn %s into a city', detail => {
    expect(recognizeCity(detail)).toBeUndefined();
  });

  test('keeps unknown explicit cities for native geocoding first', () => {
    expect(recognizeKnownCity('敦煌市鸣沙山')).toBeUndefined();
    expect(recognizeCity('敦煌市鸣沙山')).toEqual({
      name: '敦煌',
      pinyin: 'DUNHUANG',
    });
  });

  test('reuses existing city names and pinyin aliases', () => {
    const known = [{ name: '丽水', pinyin: 'LISHUI' }];

    expect(recognizeCity('丽水 · 莲都区', known)).toEqual(known[0]);
    expect(recognizeCity('Lishui station', known)).toEqual(known[0]);
  });

  test('generates complete pinyin and traditional city marks', () => {
    expect(cityPinyin('连云港')).toBe('LIANYUNGANG');
    expect(cityMark('连云港')).toBe('連');
    expect(cityMark('盐城')).toBe('鹽');
    expect(cityMark('苏州')).toBe('蘇');
    expect(cityMark('东京')).toBe('東');
  });

  test('normalizes an English geocoder city through its pinyin alias', () => {
    expect(recognizeKnownCity('Lianyungang')).toEqual({
      name: '连云港',
      pinyin: 'LIANYUNGANG',
      region: undefined,
      countryCode: undefined,
    });
  });

  test('normalizes administrative suffixes and keeps colors stable', () => {
    expect(normalizeCityName(' 上海市 ')).toBe('上海');
    expect(normalizeCityName('锡林郭勒盟')).toBe('锡林郭勒');
    expect(placeColor('杭州')).toBe(placeColor('杭州'));
    expect(placeColor('杭州')).not.toBe(placeColor('上海'));
  });
});
