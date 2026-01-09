/**
 * Authentication Service - Connects to local backend JWT auth with refresh tokens
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'colaborador' | 'viewer';
}

export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  message?: string;
}

const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// Get backend URL from settings or default
const getBackendUrl = (): string => {
  const settings = localStorage.getItem('app_settings');
  if (settings) {
    const parsed = JSON.parse(settings);
    return parsed.preferences?.backendUrl || 'http://localhost:3001';
  }
  return 'http://localhost:3001';
};

// Get stored tokens
export const getToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

// Store tokens
export const setTokens = (accessToken: string, refreshToken?: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

// Remove tokens
export const removeTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('auth_user'); // Remove old mock auth
};

// Alias for backward compatibility
export const setToken = (token: string): void => setTokens(token);
export const removeToken = (): void => removeTokens();

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

// Check if token is expired or about to expire (within 1 minute)
export const isTokenExpired = (token: string, bufferSeconds = 60): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expiresAt = payload.exp * 1000;
    const bufferMs = bufferSeconds * 1000;
    
    return Date.now() >= expiresAt - bufferMs;
  } catch {
    return true;
  }
};

// Refresh the access token using refresh token
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.accessToken) {
        setTokens(data.accessToken);
        console.log('🔄 Access token refreshed');
        return data.accessToken;
      }
    }
    
    // Refresh token invalid or expired
    removeTokens();
    return null;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// Get valid token (refresh if needed)
export async function getValidToken(): Promise<string | null> {
  const token = getToken();
  
  if (!token) return null;
  
  // If token is expired or about to expire, try to refresh
  if (isTokenExpired(token)) {
    return await refreshAccessToken();
  }
  
  return token;
}

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
      setTokens(data.accessToken, data.refreshToken);
      return {
        success: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
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
      setTokens(data.accessToken, data.refreshToken);
      return {
        success: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
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
  // First try to get a valid token (refresh if needed)
  const token = await getValidToken();
  if (!token) return null;
  
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    
    // Token invalid on server
    if (response.status === 401) {
      // Try one more refresh
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryResponse = await fetch(`${backendUrl}/api/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newToken}`,
          },
        });
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          return data.user;
        }
      }
      removeTokens();
    }
    
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

// Logout
export async function logout(revokeAll = false): Promise<void> {
  const refreshToken = getRefreshToken();
  const backendUrl = getBackendUrl();
  
  // Try to revoke the refresh token on server
  if (refreshToken) {
    try {
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ refreshToken, revokeAll }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  removeTokens();
}

// Check if authenticated
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  
  // Check if token is not expired (with no buffer - we'll refresh if needed)
  return !isTokenExpired(token, 0);
}

// Parse JWT payload (without verification - verification is server-side)
export function parseToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration (with no buffer for immediate parsing)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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

// Setup automatic token refresh
let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefresh(intervalMs = 5 * 60 * 1000): void {
  // Refresh every 5 minutes by default
  stopTokenRefresh();
  
  refreshInterval = setInterval(async () => {
    const token = getToken();
    if (token && isTokenExpired(token, 120)) { // Refresh if expiring within 2 minutes
      await refreshAccessToken();
    }
  }, intervalMs);
}

export function stopTokenRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
