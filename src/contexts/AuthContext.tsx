import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthState } from '@/types';
import * as authService from '@/services/authService';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from token
  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getToken();
      
      if (token) {
        // First, try to parse the token locally for immediate UI
        const parsedUser = authService.parseToken(token);
        
        if (parsedUser) {
          setState({
            user: {
              id: parsedUser.id,
              email: parsedUser.email,
              name: parsedUser.name,
              role: parsedUser.role,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Start automatic token refresh
          authService.startTokenRefresh();
          
          // Then verify with server in background
          const serverUser = await authService.getCurrentUser();
          if (serverUser) {
            setState(prev => ({
              ...prev,
              user: {
                id: serverUser.id,
                email: serverUser.email,
                name: serverUser.name,
                role: serverUser.role,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }));
          } else {
            // Token invalid on server
            authService.removeTokens();
            authService.stopTokenRefresh();
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        } else {
          // Token expired - try to refresh
          const newToken = await authService.refreshAccessToken();
          if (newToken) {
            const refreshedUser = authService.parseToken(newToken);
            if (refreshedUser) {
              authService.startTokenRefresh();
              setState({
                user: {
                  id: refreshedUser.id,
                  email: refreshedUser.email,
                  name: refreshedUser.name,
                  role: refreshedUser.role,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
          }
          // Couldn't refresh
          authService.removeTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        // No token, try refresh token
        const refreshToken = authService.getRefreshToken();
        if (refreshToken) {
          const newToken = await authService.refreshAccessToken();
          if (newToken) {
            const refreshedUser = authService.parseToken(newToken);
            if (refreshedUser) {
              authService.startTokenRefresh();
              setState({
                user: {
                  id: refreshedUser.id,
                  email: refreshedUser.email,
                  name: refreshedUser.name,
                  role: refreshedUser.role,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
          }
        }
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };
    
    initAuth();
    
    // Cleanup on unmount
    return () => {
      authService.stopTokenRefresh();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await authService.login(email, password);
    
    if (result.success && result.user) {
      authService.startTokenRefresh();
      setState({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }
    
    return false;
  };

  const logout = async () => {
    authService.stopTokenRefresh();
    await authService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    const result = await authService.register(email, password, name);
    
    if (result.success && result.user) {
      authService.startTokenRefresh();
      setState({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }
    
    return false;
  };

  const refreshUser = async () => {
    const user = await authService.getCurrentUser();
    if (user) {
      setState(prev => ({
        ...prev,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
