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
    username?: string | undefined;
    email?: string | undefined;
    role: string;
    permissions?: string[] | undefined;
    avatar?: string | undefined;
    isEmailVerified: boolean;
    isApproved: boolean;
  };
}
