const mockParentMemory = {
  id: 'parent-memory',
  content: '那一天的原始日记',
};
const mockReplyMemory = {
  id: 'reply-memory',
  content: '后来写下的回信',
  writtenAt: new Date(2026, 7, 3),
};
const mockReplyLetter = {
  id: 'reply-letter',
  memoryId: mockParentMemory.id,
  replyMemoryId: mockReplyMemory.id,
  sentAt: new Date(2026, 7, 3),
  arriveDate: new Date(2026, 7, 3),
  status: 'reply',
  openedAt: new Date(2026, 7, 3),
  toType: 'memory_reply',
  toName: '曾经的自己',
};

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn((table: string) => {
      if (table === 'letters') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue([mockReplyLetter]),
          })),
          find: jest.fn().mockResolvedValue(mockReplyLetter),
        };
      }
      return {
        find: jest.fn((id: string) =>
          Promise.resolve(
            id === mockReplyMemory.id ? mockReplyMemory : mockParentMemory,
          ),
        ),
      };
    }),
  },
}));

import {
  getLetterDetail,
  getLettersData,
} from '../src/features/letters/lettersRepository';

test('includes Daily replies in the opened mailbox section', async () => {
  const sections = await getLettersData(new Date(2026, 7, 4));

  expect(sections.opened).toHaveLength(1);
  expect(sections.opened[0]).toEqual({
    letter: mockReplyLetter,
    memory: mockReplyMemory,
  });
  expect(sections.arriving).toHaveLength(0);
  expect(sections.traveling).toHaveLength(0);
});

test('opens the reply content instead of the parent Daily memory', async () => {
  const detail = await getLetterDetail(mockReplyLetter.id);

  expect(detail.letter).toBe(mockReplyLetter);
  expect(detail.memory).toBe(mockReplyMemory);
  expect(detail.memory.content).toBe('后来写下的回信');
});
