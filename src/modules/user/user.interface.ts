import type { Model, Types } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from './user.constants.js';

export type TRole = (typeof USER_ROLES)[number];
export type TUserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: TRole;
  avatar?: string;
  fcmTokens?: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isApproved: boolean;
  status: TUserStatus;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserModel extends Model<IUser> {
  isUserExistsByEmail(email: string): Promise<IUser | null>;
  isPasswordMatched(givenPassword: string, savedPassword: string): Promise<boolean>;
}
