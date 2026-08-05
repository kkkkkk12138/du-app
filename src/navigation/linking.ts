import { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './RootNavigator';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['duapp://'],
  config: {
    screens: {
      Main: {
        screens: {
          Daily: 'daily',
          Letters: 'letters',
          Write: 'write',
          Faraway: 'faraway',
          Profile: 'profile',
        },
      },
      Unseal: 'unseal/:letterId?',
      NewLetter: 'new-letter',
      ProfileEdit: 'profile/edit',
      AnnualSummary: 'profile/annual',
      Bookshelf: 'profile/bookshelf',
      Scraps: 'profile/scraps',
      Feedback: 'profile/feedback',
      LegalDocument: 'legal/:type',
      About: 'about',
      AuthorLetter: 'author-letter',
    },
  },
};
