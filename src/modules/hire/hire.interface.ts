import type { Model, Types } from 'mongoose';
import { HIRE_REQUEST_STATUSES } from './hire.constants.js';

export type THireRequestStatus = (typeof HIRE_REQUEST_STATUSES)[number];

export interface IHireRequest {
  _id?: Types.ObjectId;
  guardianId: Types.ObjectId;
  tutorId: Types.ObjectId;
  jobId?: Types.ObjectId;
  message?: string;
  status: THireRequestStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type HireRequestModel = Model<IHireRequest>;
