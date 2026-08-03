const mockMemory: Record<string, any> = {};
const mockReply: Record<string, any> = {};
const mockLetter: Record<string, any> = {};

Object.assign(mockMemory, {
  id: 'memory-1',
  deleted: false,
  updatedAt: new Date(0),
  prepareUpdate: jest.fn((change: (record: Record<string, any>) => void) => {
    change(mockMemory);
    return mockMemory;
  }),
  prepareDestroyPermanently: jest.fn(() => mockMemory),
});
Object.assign(mockReply, {
  id: 'reply-1',
  prepareDestroyPermanently: jest.fn(() => mockReply),
});
Object.assign(mockLetter, {
  id: 'letter-1',
  status: 'reply',
  replyMemoryId: mockReply.id,
  prepareDestroyPermanently: jest.fn(() => mockLetter),
});

jest.mock('../src/db/database', () => ({
  database: {
    batch: jest.fn().mockResolvedValue(undefined),
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => {
      if (table === 'letters') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue([mockLetter]),
          })),
        };
      }
      return {
        find: jest.fn().mockResolvedValue(mockReply),
      };
    }),
  },
}));

import { database } from '../src/db/database';
import {
  deleteMemory,
  deleteMemoryReply,
} from '../src/features/daily/memoryDetailRepository';
import { deleteLetter } from '../src/features/letters/lettersRepository';

const batchMock = database.batch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMemory.deleted = false;
  mockMemory.updatedAt = new Date(0);
});

test('soft deletes a memory and removes its linked replies and letters', async () => {
  await expect(deleteMemory(mockMemory as never)).resolves.toEqual([
    mockLetter.id,
  ]);

  expect(mockMemory.deleted).toBe(true);
  expect(mockMemory.prepareUpdate).toHaveBeenCalled();
  expect(mockReply.prepareDestroyPermanently).toHaveBeenCalled();
  expect(mockLetter.prepareDestroyPermanently).toHaveBeenCalled();
  expect(batchMock).toHaveBeenCalled();
});

test('permanently removes a reply and its mailbox link', async () => {
  await deleteMemoryReply(mockReply as never);

  expect(mockReply.prepareDestroyPermanently).toHaveBeenCalled();
  expect(mockLetter.prepareDestroyPermanently).toHaveBeenCalled();
  expect(batchMock).toHaveBeenCalledWith(mockLetter, mockReply);
});

test('permanently removes a letter and its owned content', async () => {
  await deleteLetter({
    letter: mockLetter as never,
    memory: mockReply as never,
  });

  expect(batchMock).toHaveBeenCalledWith(mockLetter, mockReply);
});
