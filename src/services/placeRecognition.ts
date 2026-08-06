import { pinyin } from 'pinyin-pro';
import { s2t } from 'chinese-s2t';

export type RecognizedCity = {
  name: string;
  pinyin: string;
  region?: string;
  countryCode?: string;
};

const hanCharacterPattern = /[\u3400-\u9fff]/u;

export function cityPinyin(name: string) {
  const normalized = name?.trim() ?? '';
  if (!normalized) {
    return '';
  }
  if (!hanCharacterPattern.test(normalized)) {
    return normalized.toLocaleUpperCase();
  }
  return pinyin(normalized, {
    toneType: 'none',
    type: 'array',
  })
    .join('')
    .toLocaleUpperCase();
}

export function cityMark(name: string) {
  return Array.from(s2t(name?.trim() ?? ''))[0] ?? '城';
}

const cityCatalog: RecognizedCity[] = [
  { name: '北京', pinyin: 'BEIJING' },
  { name: '上海', pinyin: 'SHANGHAI' },
  { name: '天津', pinyin: 'TIANJIN' },
  { name: '重庆', pinyin: 'CHONGQING' },
  { name: '广州', pinyin: 'GUANGZHOU' },
  { name: '深圳', pinyin: 'SHENZHEN' },
  { name: '杭州', pinyin: 'HANGZHOU' },
  { name: '南京', pinyin: 'NANJING' },
  { name: '苏州', pinyin: 'SUZHOU' },
  { name: '成都', pinyin: 'CHENGDU' },
  { name: '武汉', pinyin: 'WUHAN' },
  { name: '西安', pinyin: 'XIAN' },
  { name: '长沙', pinyin: 'CHANGSHA' },
  { name: '郑州', pinyin: 'ZHENGZHOU' },
  { name: '青岛', pinyin: 'QINGDAO' },
  { name: '厦门', pinyin: 'XIAMEN' },
  { name: '福州', pinyin: 'FUZHOU' },
  { name: '济南', pinyin: 'JINAN' },
  { name: '合肥', pinyin: 'HEFEI' },
  { name: '昆明', pinyin: 'KUNMING' },
  { name: '大连', pinyin: 'DALIAN' },
  { name: '沈阳', pinyin: 'SHENYANG' },
  { name: '哈尔滨', pinyin: 'HAERBIN' },
  { name: '长春', pinyin: 'CHANGCHUN' },
  { name: '石家庄', pinyin: 'SHIJIAZHUANG' },
  { name: '太原', pinyin: 'TAIYUAN' },
  { name: '南昌', pinyin: 'NANCHANG' },
  { name: '南宁', pinyin: 'NANNING' },
  { name: '贵阳', pinyin: 'GUIYANG' },
  { name: '海口', pinyin: 'HAIKOU' },
  { name: '兰州', pinyin: 'LANZHOU' },
  { name: '西宁', pinyin: 'XINING' },
  { name: '银川', pinyin: 'YINCHUAN' },
  { name: '呼和浩特', pinyin: 'HUHEHAOTE' },
  { name: '乌鲁木齐', pinyin: 'WULUMUQI' },
  { name: '拉萨', pinyin: 'LASA' },
  { name: '宁波', pinyin: 'NINGBO' },
  { name: '无锡', pinyin: 'WUXI' },
  { name: '温州', pinyin: 'WENZHOU' },
  { name: '佛山', pinyin: 'FOSHAN' },
  { name: '东莞', pinyin: 'DONGGUAN' },
  { name: '珠海', pinyin: 'ZHUHAI' },
  { name: '泉州', pinyin: 'QUANZHOU' },
  { name: '烟台', pinyin: 'YANTAI' },
  { name: '威海', pinyin: 'WEIHAI' },
  { name: '洛阳', pinyin: 'LUOYANG' },
  { name: '开封', pinyin: 'KAIFENG' },
  { name: '桂林', pinyin: 'GUILIN' },
  { name: '三亚', pinyin: 'SANYA' },
  { name: '绍兴', pinyin: 'SHAOXING' },
  { name: '嘉兴', pinyin: 'JIAXING' },
  { name: '金华', pinyin: 'JINHUA' },
  { name: '台州', pinyin: 'TAIZHOU' },
  { name: '常州', pinyin: 'CHANGZHOU' },
  { name: '扬州', pinyin: 'YANGZHOU' },
  { name: '徐州', pinyin: 'XUZHOU' },
  { name: '南通', pinyin: 'NANTONG' },
  { name: '唐山', pinyin: 'TANGSHAN' },
  { name: '秦皇岛', pinyin: 'QINHUANGDAO' },
  { name: '保定', pinyin: 'BAODING' },
  { name: '香港', pinyin: 'HONG KONG' },
  { name: '澳门', pinyin: 'MACAU' },
  { name: '台北', pinyin: 'TAIPEI' },
  { name: '东京', pinyin: 'TOKYO' },
];

const extendedMainlandCityCatalog = `
  邯郸 邢台 张家口 承德 沧州 廊坊 衡水
  大同 阳泉 长治 晋城 朔州 晋中 运城 忻州 临汾 吕梁
  包头 乌海 赤峰 通辽 鄂尔多斯 呼伦贝尔 巴彦淖尔 乌兰察布
  兴安 锡林郭勒 阿拉善
  鞍山 抚顺 本溪 丹东 锦州 营口 阜新 辽阳 盘锦 铁岭 朝阳 葫芦岛
  吉林 四平 辽源 通化 白山 松原 白城 延边
  齐齐哈尔 鸡西 鹤岗 双鸭山 大庆 伊春 佳木斯 七台河 牡丹江 黑河
  绥化 大兴安岭
  连云港 淮安 盐城 镇江 泰州 宿迁
  湖州 衢州 舟山 丽水
  芜湖 蚌埠 淮南 马鞍山 淮北 铜陵 安庆 黄山 滁州 阜阳 宿州 六安
  亳州 池州 宣城
  莆田 三明 漳州 南平 龙岩 宁德
  景德镇 萍乡 九江 新余 鹰潭 赣州 吉安 宜春 抚州 上饶
  淄博 枣庄 东营 潍坊 济宁 泰安 日照 临沂 德州 聊城 滨州 菏泽
  平顶山 安阳 鹤壁 新乡 焦作 濮阳 许昌 漯河 三门峡 南阳 商丘
  信阳 周口 驻马店 济源
  黄石 十堰 宜昌 襄阳 鄂州 荆门 孝感 荆州 黄冈 咸宁 随州 恩施
  仙桃 潜江 天门 神农架
  株洲 湘潭 衡阳 邵阳 岳阳 常德 张家界 益阳 郴州 永州 怀化 娄底
  湘西
  韶关 汕头 江门 湛江 茂名 肇庆 惠州 梅州 汕尾 河源 阳江 清远
  中山 潮州 揭阳 云浮
  柳州 梧州 北海 防城港 钦州 贵港 玉林 百色 贺州 河池 来宾 崇左
  三沙 儋州 五指山 琼海 文昌 万宁 东方 定安 屯昌 澄迈 临高 白沙
  昌江 乐东 陵水 保亭 琼中
  自贡 攀枝花 泸州 德阳 绵阳 广元 遂宁 内江 乐山 南充 眉山 宜宾
  广安 达州 雅安 巴中 资阳 阿坝 甘孜 凉山
  六盘水 遵义 安顺 毕节 铜仁 黔西南 黔东南 黔南
  曲靖 玉溪 保山 昭通 丽江 普洱 临沧 楚雄 红河 文山 西双版纳 大理
  德宏 怒江 迪庆
  日喀则 昌都 林芝 山南 那曲 阿里
  铜川 宝鸡 咸阳 渭南 延安 汉中 榆林 安康 商洛
  嘉峪关 金昌 白银 天水 武威 张掖 平凉 酒泉 庆阳 定西 陇南 临夏
  甘南
  海东 海北 黄南 海南 果洛 玉树 海西
  石嘴山 吴忠 固原 中卫
  克拉玛依 吐鲁番 哈密 昌吉 博尔塔拉 巴音郭楞 阿克苏 克孜勒苏
  喀什 和田 伊犁 塔城 阿勒泰 石河子 阿拉尔 图木舒克 五家渠
  北屯 铁门关 双河 可克达拉 昆玉 胡杨河 新星 白杨
`
  .trim()
  .split(/\s+/u)
  .map(name => ({ name, pinyin: cityPinyin(name) }));

cityCatalog.push(...extendedMainlandCityCatalog);

const citySuffixPattern =
  /^(?:[\u4e00-\u9fff]{2,12}(?:省|自治区))?([\u4e00-\u9fff]{2,16}?)(?:市|自治州|地区|盟)/u;

export function normalizeCityName(value: string) {
  return value
    .trim()
    .replace(/^(?:中国|中华人民共和国)/u, '')
    .replace(/(?:特别行政区|自治州|地区|盟|市)$/u, '')
    .replace(/\s+/gu, '')
    .toLocaleLowerCase();
}

export function recognizeKnownCity(
  placeDetail?: string,
  knownCities: RecognizedCity[] = [],
): RecognizedCity | undefined {
  const detail = placeDetail?.trim();
  if (!detail || /^-?\d{1,3}\.\d+\s*[,，]\s*-?\d{1,3}\.\d+$/u.test(detail)) {
    return undefined;
  }

  const candidates = [...knownCities, ...cityCatalog]
    .filter(city => city.name.trim())
    .sort((left, right) => right.name.length - left.name.length);
  const compactDetail = detail.replace(/\s+/gu, '').toLocaleLowerCase();
  const matched = candidates.find(city => {
    const normalized = normalizeCityName(city.name);
    const isDistrictOnly =
      compactDetail === `${normalized}区` ||
      compactDetail === `${normalized}县` ||
      compactDetail === `${normalized}旗`;
    if (isDistrictOnly) {
      return false;
    }
    return (
      compactDetail.includes(normalized) ||
      compactDetail.includes(`${normalized}市`) ||
      (city.pinyin &&
        compactDetail.includes(city.pinyin.replace(/\s+/gu, '').toLowerCase()))
    );
  });
  if (matched) {
    return {
      name: matched.name.replace(/市$/u, ''),
      pinyin: matched.pinyin || cityPinyin(matched.name),
      region: matched.region,
      countryCode: matched.countryCode,
    };
  }
  return undefined;
}

export function recognizeCity(
  placeDetail?: string,
  knownCities: RecognizedCity[] = [],
): RecognizedCity | undefined {
  const detail = placeDetail?.trim();
  const known = recognizeKnownCity(detail, knownCities);
  if (known) {
    return known;
  }
  if (!detail) {
    return undefined;
  }

  const explicit = detail.match(citySuffixPattern)?.[1];
  if (!explicit) {
    return undefined;
  }
  const name = explicit.replace(/^(?:.*省|.*自治区)/u, '').trim();
  return name.length >= 2
    ? {
        name,
        pinyin: cityPinyin(name),
      }
    : undefined;
}

export function placeColor(name: string) {
  const palette = ['#8FA894', '#B88B78', '#8D9AAE', '#B29A6F', '#9B8EA5'];
  const hash = Array.from(name).reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return palette[hash % palette.length];
}
