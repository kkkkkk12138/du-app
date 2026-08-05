import RNFS from 'react-native-fs';

type MockUser = {
  id: string;
  nickname: string;
  avatarChar: string;
  avatarPath?: string;
  birthday?: Date;
  update: jest.Mock<Promise<void>, [change: (record: MockUser) => void]>;
};

const mockUser: MockUser = {
  id: 'user-1',
  nickname: '渡河人',
  avatarChar: '渡',
  update: jest.fn(async change => {
    change(mockUser);
  }),
};

const counts: Record<string, number> = {
  letters: 2,
  wishes: 4,
  quests: 1,
};
const mockMemories = Array.from({ length: 8 }, (_, index) => ({
  placeId: index < 3 ? 'shanghai' : index < 6 ? 'tokyo' : undefined,
}));
const mockPlaces = [{ id: 'shanghai' }, { id: 'tokyo' }];

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => {
      if (table === 'users') {
        return {
          find: jest.fn().mockResolvedValue(mockUser),
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue([mockUser]),
          })),
        };
      }
      if (table === 'memories') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue(mockMemories),
          })),
        };
      }
      if (table === 'places') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue(mockPlaces),
          })),
        };
      }
      return {
        query: jest.fn(() => ({
          fetchCount: jest.fn().mockResolvedValue(counts[table]),
        })),
      };
    }),
  },
}));

import {
  getProfileData,
  updateProfile,
} from '../src/features/profile/profileRepository';

test('reads profile statistics from local collections', async () => {
  await expect(getProfileData('user-1')).resolves.toEqual({
    nickname: '渡河人',
    avatarChar: '渡',
    avatarPath: undefined,
    birthday: undefined,
    daysSinceJoining: 1,
    memoryCount: 8,
    placeCount: 2,
    letterCount: 2,
    wishCount: 4,
    questCount: 1,
  });
});

test('persists a trimmed nickname and first avatar character', async () => {
  const birthday = new Date(1995, 9, 12);
  await updateProfile({
    anonymousId: 'user-1',
    nickname: '  写字的人  ',
    avatarChar: '舟影',
    birthday,
  });

  expect(mockUser.nickname).toBe('写字的人');
  expect(mockUser.avatarChar).toBe('舟');
  expect(mockUser.birthday).toEqual(birthday);
});

test('promotes a selected avatar draft before persisting its path', async () => {
  await updateProfile({
    anonymousId: 'user-1',
    nickname: '写字的人',
    avatarChar: '舟',
    avatarPath: '/tmp/du-drafts/photo-avatar.jpg',
  });

  expect(RNFS.copyFile).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-avatar.jpg',
    expect.stringContaining('/du-attachments/photo-'),
  );
  expect(mockUser.avatarPath).toContain('/du-attachments/photo-');
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/du-drafts/photo-avatar.jpg');
});
