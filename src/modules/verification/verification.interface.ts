import type { Model, Types } from 'mongoose';
import { VERIFICATION_STATUSES } from './verification.constants.js';

export type TVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface IVerification {
  _id?: Types.ObjectId;
  tutorId: Types.ObjectId;
  nidDocument?: string;
  certificateDocuments?: string[];
  cvDocument?: string;
  status: TVerificationStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VerificationModel = Model<IVerification>;
