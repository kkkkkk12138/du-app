import type {TextStyle} from 'react-native';

import {fontFamilies} from '../../tokens/typography';
import {detailColors} from '../daily/MemoryDetailParts';

export const LETTER_TEXT_LINE_HEIGHT = 32;

export const handwrittenLetterText: TextStyle = {
  color: detailColors.ink,
  fontFamily: fontFamilies.serif,
  fontSize: 15,
  fontStyle: 'italic',
  includeFontPadding: false,
  lineHeight: LETTER_TEXT_LINE_HEIGHT,
  letterSpacing: 0.32,
  textShadowColor: 'rgba(110,78,52,0.12)',
  textShadowOffset: {width: 0.2, height: 0.3},
  textShadowRadius: 0.35,
};

export const handwrittenLetterGreeting: TextStyle = {
  ...handwrittenLetterText,
  color: detailColors.inkSoft,
  letterSpacing: 0.5,
};

export function startsWithLetterSalutation(content: string) {
  return /^(展信安|见字如面|亲爱的|你好|未来的自己|那时的我)[，。：:]/u.test(
    content.trim(),
  );
}
