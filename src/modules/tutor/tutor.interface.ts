import type { Model, Types } from 'mongoose';
import { GENDERS } from './tutor.constants.js';

export type TGender = (typeof GENDERS)[number];

export interface ITutorLocation {
  district?: string;
  area?: string;
}

export interface ITutor {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  university?: string;
  department?: string;
  qualification?: string;
  experience?: string;
  subjects: string[];
  preferredAreas: string[];
  mediums: string[];
  salary?: number;
  gender?: TGender;
  location?: ITutorLocation;
  bio?: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isPremium: boolean;
  nid?: string;
  certificates?: string[];
  cv?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TutorModel = Model<ITutor>;
