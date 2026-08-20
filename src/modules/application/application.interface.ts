import type { Model, Types } from 'mongoose';
import { APPLICATION_STATUSES } from './application.constants.js';

export type TApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface IApplication {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId;
  tutorId: Types.ObjectId;
  expectedSalary?: number;
  status: TApplicationStatus;
  appliedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ApplicationModel = Model<IApplication>;
