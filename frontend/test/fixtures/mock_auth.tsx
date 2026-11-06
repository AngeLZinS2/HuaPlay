import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext<any>({
  user: { uid: 'user_test_browser_123', email: 'browser_test@huaplay.app' },
  uid: 'user_test_browser_123',
  isAuthenticated: true,
  isLoading: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState({ uid: 'user_test_browser_123', email: 'browser_test@huaplay.app' });
  return (
    <AuthContext.Provider
      value={{
        user,
        uid: user.uid,
        isAuthenticated: true,
        isLoading: false,
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
