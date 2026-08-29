import type { TRole } from '../user/user.interface.js';

export interface IRegisterUser {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  gender?: string;
  password: string;
  role: TRole;
}

export interface ILoginUser {
  email: string;
  password: string;
}

export interface IVerifyOTP {
  email: string;
  otp: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    _id: string;
    name: string;
    username?: string;
    email: string;
    role: string;
    permissions?: string[];
    avatar?: string;
    isEmailVerified: boolean;
    isApproved: boolean;
  };
}
