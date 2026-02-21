import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Keycloak from 'keycloak-js';
import { keycloakUrl, keycloakRealm, keycloakClient } from './config';

type AuthState =
  | { keycloak: Keycloak; token: string; ready: true }
  | { ready: false; error?: string };

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

const INIT_TIMEOUT_MS = 12000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doInit = () => {
    setState({ ready: false });
    const kc = new Keycloak({ url: keycloakUrl, realm: keycloakRealm, clientId: keycloakClient });
    const clearTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setState({
        ready: false,
        error: 'Login is taking too long. Keycloak may be slow or the redirect failed.',
      });
    }, INIT_TIMEOUT_MS);

    kc.init({ onLoad: 'login-required' })
      .then((authenticated) => {
        clearTimeout();
        if (authenticated && kc.token) {
          setState({ keycloak: kc, token: kc.token, ready: true });
        } else {
          setState({ ready: false, error: 'Not authenticated. Try again.' });
        }
      })
      .catch((err) => {
        clearTimeout();
        const msg = err instanceof Error ? err.message : 'Login failed';
        setState({ ready: false, error: msg });
      });
  };

  useEffect(() => {
    doInit();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!state.ready) {
    const loginUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth?client_id=${encodeURIComponent(keycloakClient)}&redirect_uri=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/' : 'http://localhost:3000/')}&response_type=code&scope=openid`;
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 420 }}>
        <p>Loading / redirecting to login…</p>
        {state.error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: 4 }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>{state.error}</p>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Ensure Keycloak is running at{' '}
              <a href={keycloakUrl} target="_blank" rel="noopener noreferrer">{keycloakUrl}</a>
              {' '}and open the Bill UI at <strong>http://localhost:3000</strong>.
            </p>
            <button type="button" onClick={doInit} style={{ marginTop: '0.75rem' }}>
              Retry login
            </button>
            {' '}
            <a href={loginUrl} style={{ marginTop: '0.75rem', display: 'inline-block' }}>
              Open login page in new tab
            </a>
          </div>
        )}
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
