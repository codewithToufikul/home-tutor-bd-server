import type { Model, Types } from 'mongoose';

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface IEnrollment {
  _id?: Types.ObjectId | string;
  coachingId: Types.ObjectId | string;
  batchId: string;
  batchName: string;
  studentUserId: Types.ObjectId | string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  institution?: string;
  studentClass?: string;
  status: EnrollmentStatus;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EnrollmentModel = Model<IEnrollment>;
