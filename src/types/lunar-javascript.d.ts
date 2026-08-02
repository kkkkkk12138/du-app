declare module 'lunar-javascript' {
  type JieQi = {
    getName(): string;
  };

  type Lunar = {
    getYearInGanZhi(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getPrevJieQi(wholeDay?: boolean): JieQi;
    getNextJieQi(wholeDay?: boolean): JieQi;
    getDayYi(): string[];
  };

  export const Solar: {
    fromDate(date: Date): {
      getLunar(): Lunar;
    };
  };
}
