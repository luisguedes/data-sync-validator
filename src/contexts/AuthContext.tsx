import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for development
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@conferencia.local',
    name: 'Administrador',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    email: 'colaborador@conferencia.local',
    name: 'Colaborador Demo',
    role: 'colaborador',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        localStorage.removeItem('auth_user');
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Mock authentication - in production, this would call the backend
    const user = mockUsers.find(u => u.email === email);
    
    if (user && password === 'demo123') {
      localStorage.setItem('auth_user', JSON.stringify(user));
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }
    
    return false;
  };

  const logout = () => {
    localStorage.removeItem('auth_user');
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    // Mock registration - in production, this would call the backend
    const newUser: User = {
      id: String(Date.now()),
      email,
      name,
      role: 'colaborador',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setState({
      user: newUser,
      isAuthenticated: true,
      isLoading: false,
    });
    
    return true;
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, register }}>
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
