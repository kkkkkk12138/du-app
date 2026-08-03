type MockUser = {
  id: string;
  nickname: string;
  avatarChar: string;
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
  memories: 8,
  places: 3,
  letters: 2,
};

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
    daysSinceJoining: 1,
    memoryCount: 8,
    placeCount: 3,
    letterCount: 2,
  });
});

test('persists a trimmed nickname and first avatar character', async () => {
  await updateProfile({
    anonymousId: 'user-1',
    nickname: '  写字的人  ',
    avatarChar: '舟影',
  });

  expect(mockUser.nickname).toBe('写字的人');
  expect(mockUser.avatarChar).toBe('舟');
});
