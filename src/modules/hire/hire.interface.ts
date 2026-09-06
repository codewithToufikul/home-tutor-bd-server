import type { Model, Types } from 'mongoose';
import { HIRE_REQUEST_STATUSES } from './hire.constants.js';

export type THireRequestStatus = (typeof HIRE_REQUEST_STATUSES)[number];

export interface IConfirmedTuition {
  jobId?: Types.ObjectId;
  applicationId?: Types.ObjectId;
  salary?: number;
  platformFee?: number;
  daysPerWeek?: string;
  studentClass?: string;
  subjects?: string[];
  location?: {
    district?: string;
    area?: string;
    detailedAddress?: string;
  };
  confirmedAt?: Date;
  confirmedBy?: Types.ObjectId;
}

export interface IHireRequest {
  _id?: Types.ObjectId;
  guardianId?: Types.ObjectId;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  studentClass?: string;
  subjects?: string[] | string;
  salaryOffer?: string | number;
  requirements?: string;
  location?: {
    district?: string;
    area?: string;
    detailedAddress?: string;
  };
  tutorId: Types.ObjectId;
  tutorProfileId?: Types.ObjectId;
  jobId?: Types.ObjectId;
  message?: string;
  status: THireRequestStatus;
  adminNotes?: string;
  confirmedTuition?: IConfirmedTuition;
  createdAt?: Date;
  updatedAt?: Date;
}

export type HireRequestModel = Model<IHireRequest>;

