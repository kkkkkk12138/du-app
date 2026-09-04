import React, {PropsWithChildren, useEffect, useMemo} from 'react';

import type {AuthProvider} from './AuthProvider';
import {getAccountAuthProvider} from './accountAuthProvider';
import type {AccountSession} from './authTypes';
import {
  hasUnlockedAccountKey as readUnlockedAccountKey,
} from './keyRecoveryState';
import {useAccountStore} from './useAccountStore';

type Props = PropsWithChildren<{
  authProvider?: AuthProvider;
  hasUnlockedAccountKey?: (uid: string) => Promise<boolean>;
}>;

export function AccountSessionBootstrap({
  authProvider,
  hasUnlockedAccountKey = readUnlockedAccountKey,
  children,
}: Props) {
  const provider = useMemo(
    () => authProvider ?? getAccountAuthProvider(),
    [authProvider],
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    const {beginRestore, setSignedIn, setSignedOut} =
      useAccountStore.getState();

    const applySession = async (session: AccountSession | null) => {
      if (!active) {
        return;
      }
      if (!session) {
        setSignedOut();
        return;
      }

      const unlocked = await hasUnlockedAccountKey(session.uid);
      if (active) {
        setSignedIn(session, unlocked);
      }
    };

    const restore = async () => {
      beginRestore();
      try {
        await applySession(await provider.restoreSession());
      } catch {
        if (active) {
          setSignedOut();
        }
      }

      if (active) {
        unsubscribe = provider.subscribe(session => {
          applySession(session).catch(() => {
            if (active) {
              setSignedOut();
            }
          });
        });
      }
    };

    restore().catch(() => {
      if (active) {
        setSignedOut();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [hasUnlockedAccountKey, provider]);

  return <>{children}</>;
}
