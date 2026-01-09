/**
 * Authentication Service - Connects to local backend JWT auth
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'colaborador' | 'viewer';
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
}

const TOKEN_KEY = 'auth_token';

// Get backend URL from settings or default
const getBackendUrl = (): string => {
  const settings = localStorage.getItem('app_settings');
  if (settings) {
    const parsed = JSON.parse(settings);
    return parsed.preferences?.backendUrl || 'http://localhost:3001';
  }
  return 'http://localhost:3001';
};

// Get stored token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Store token
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

// Remove token
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Get auth headers
export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Login
export async function login(email: string, password: string): Promise<LoginResponse> {
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      setToken(data.token);
      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    }
    
    return {
      success: false,
      message: data.message || 'Erro ao fazer login',
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Não foi possível conectar ao servidor',
    };
  }
}

// Register
export async function register(email: string, password: string, name: string): Promise<LoginResponse> {
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      setToken(data.token);
      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    }
    
    return {
      success: false,
      message: data.message || 'Erro ao registrar',
    };
  } catch (error) {
    console.error('Register error:', error);
    return {
      success: false,
      message: 'Não foi possível conectar ao servidor',
    };
  }
}

// Get current user
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: getAuthHeaders(),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    
    // Token invalid or expired
    if (response.status === 401) {
      removeToken();
    }
    
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

// Logout
export function logout(): void {
  removeToken();
  localStorage.removeItem('auth_user'); // Remove old mock auth
}

// Check if authenticated
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Parse JWT payload (without verification - verification is server-side)
export function parseToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      removeToken();
      return null;
    }
    
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
