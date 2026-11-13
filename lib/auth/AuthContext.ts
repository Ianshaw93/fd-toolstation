import { createContext, useContext } from 'react';

export interface AuthAccount {
  oid?: string;
  name: string;
  username: string;
}

interface AuthContextValue {
  account: AuthAccount | null;
  ready: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  account: null,
  ready: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
