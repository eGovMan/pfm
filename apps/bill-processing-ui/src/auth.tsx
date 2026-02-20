import React, { createContext, useContext, useEffect, useState } from 'react';
import Keycloak from 'keycloak-js';
import { keycloakUrl, keycloakRealm, keycloakClient } from './config';

type AuthState = { keycloak: Keycloak; token: string; ready: true } | { ready: false };

const AuthContext = createContext<AuthState>({ ready: false });

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) return { ready: false };
  return ctx;
}

export function hasRole(keycloak: Keycloak, role: string): boolean {
  const realm = keycloak.tokenParsed as { realm_access?: { roles?: string[] } } | undefined;
  return realm?.realm_access?.roles?.includes(role) ?? false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false });

  useEffect(() => {
    const kc = new Keycloak({ url: keycloakUrl, realm: keycloakRealm, clientId: keycloakClient });
    kc.init({ onLoad: 'login-required' })
      .then((authenticated) => {
        if (authenticated && kc.token) {
          setState({ keycloak: kc, token: kc.token, ready: true });
        } else {
          setState({ ready: false });
        }
      })
      .catch(() => setState({ ready: false }));
  }, []);

  if (!state.ready) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Loading / redirecting to login…</p>
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
