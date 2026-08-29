import type { Model, Types } from 'mongoose';
import { APPLICATION_STATUSES } from './application.constants.js';

export type TApplicationStatus = (typeof APPLICATION_STATUSES)[number];

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
  createdAt?: Date;
  updatedAt?: Date;
}

export type ApplicationModel = Model<IApplication>;
