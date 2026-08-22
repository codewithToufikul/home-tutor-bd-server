import type { Model, Types } from 'mongoose';

export interface ICoachingBatch {
  _id?: Types.ObjectId | string;
  batchName: string;
  className: string;
  subject: string;
  schedule?: string;
  fee?: number;
  maxStudents?: number;
  enrolledCount?: number;
  status?: 'Active' | 'Completed' | 'Upcoming';
  instructorName?: string;
  createdAt?: Date;
}

export interface ICoachingProfile {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId;
  instituteName: string;
  tradeLicense?: string;
  phone?: string;
  email?: string;
  district?: string;
  location?: string;
  about?: string;
  batches: ICoachingBatch[];
  assignedTutorIds?: Types.ObjectId[];
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CoachingModel = Model<ICoachingProfile>;
