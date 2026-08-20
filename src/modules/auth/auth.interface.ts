import type { TRole } from '../user/user.interface.js';

export interface IRegisterUser {
  name: string;
  email: string;
  phone?: string;
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
    email: string;
    role: string;
    avatar?: string;
    isEmailVerified: boolean;
    isApproved: boolean;
  };
}
