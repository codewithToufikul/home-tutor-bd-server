import type { Model, Types } from 'mongoose';
import { APPLICATION_STATUSES } from './application.constants.js';

export type TApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ITutorSnapshot {
  name: string;
  email?: string;
  phone?: string;
  nid?: string;
  nidCard?: string;
  studentIdCard?: string;
  university?: string;
  department?: string;
  qualification?: string;
  permanentAddress?: string;
  emergencyPhone?: string;
  avatar?: string;
}

export interface ITuitionSnapshot {
  customId?: string;
  studentClass?: string;
  medium?: string;
  salary?: number;
  mediaFee?: number;
  location?: string;
  area?: string;
  subjects?: string[];
}

export interface IApplication {
  _id?: Types.ObjectId;
  jobId: Types.ObjectId;
  tutorId: Types.ObjectId;
  expectedSalary?: number;
  /** টিউটরের আবেদনপত্র / পরিচিতি বার্তা */
  coverLetter?: string;
  /** কখন পড়াতে পারবেন: morning | afternoon | evening */
  availableTime?: string[];
  /** Auto Matching Engine-এর দেওয়া Score (0-100+) */
  matchScore?: number;
  /** System কর্তৃক Auto Shortlist করা হয়েছে কিনা */
  isAutoShortlisted?: boolean;
  status: TApplicationStatus;
  appliedAt?: Date;

  // ─── Digital Legal Contract & Deed Fields ─────────────────────────
  contractId?: string;              // TMC/{tuitionCustomId}/{timestampHash}
  signatureImage?: string;          // Canvas Signature Base64 or URL
  ipAddress?: string;               // Captured Client IP Address
  userAgent?: string;               // Device & Browser Details
  signedAt?: Date;                  // Exact Timestamp
  mediaFee?: number;                // 60% of Tuition Salary
  securityHash?: string;            // SHA256 Cryptographic Lock Code
  agreedToTerms?: boolean;          // Mandatory Agreement Confirmation
  tutorSnapshot?: ITutorSnapshot;   // Immutable Profile Snapshot
  tuitionSnapshot?: ITuitionSnapshot; // Immutable Tuition Snapshot

  createdAt?: Date;
  updatedAt?: Date;
}

export type ApplicationModel = Model<IApplication>;
