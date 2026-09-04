import {create} from 'zustand';

import type {AccountSession} from './authTypes';

export type AccountState =
  | {status: 'restoring'}
  | {status: 'signed_out'}
  | {status: 'signed_in_locked'; session: AccountSession}
  | {status: 'signed_in_unlocked'; session: AccountSession};

type AccountStore = {
  account: AccountState;
  beginRestore: () => void;
  setSignedOut: () => void;
  setSignedIn: (session: AccountSession, unlocked: boolean) => void;
};

export const useAccountStore = create<AccountStore>(set => ({
  account: {status: 'restoring'},
  beginRestore: () => set({account: {status: 'restoring'}}),
  setSignedOut: () => set({account: {status: 'signed_out'}}),
  setSignedIn: (session, unlocked) =>
    set({
      account: {
        status: unlocked ? 'signed_in_unlocked' : 'signed_in_locked',
        session,
      },
    }),
}));
