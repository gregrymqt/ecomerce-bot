import { createContext } from 'react';
import type {
  LoginCredentials,
  RegisterPayload,
  UpdateUserPayload,
  AuthState,
  UserResponse,
  GoogleCallbackRequest,
  AuthTokenResponse,
} from '../types/auth.types';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<UserResponse>;
  register: (payload: RegisterPayload) => Promise<UserResponse>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateUserPayload) => Promise<void>;
  switchTenant: (tenantId: string) => void;
  checkAuth: () => Promise<void>;
  initiateGoogleLogin: (tenantName?: string) => Promise<void>;
  loginWithGoogleCallback: (payload: GoogleCallbackRequest) => Promise<AuthTokenResponse>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
