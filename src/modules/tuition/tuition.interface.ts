import type { Model, Types } from 'mongoose';
import {
  APPROVAL_STATUSES,
  GENDER_PREFERENCES,
  TUITION_JOB_STATUSES,
} from './tuition.constants.js';

export type TGenderPreference = (typeof GENDER_PREFERENCES)[number];
export type TTuitionJobStatus = (typeof TUITION_JOB_STATUSES)[number];
export type TApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ITuitionLocation {
  district: string;
  area: string;
}

/** Auto Matching Score ব্রেকডাউন — কোন criteria-তে কত পয়েন্ট পেয়েছে */
export interface IMatchDetails {
  subjectScore: number;      // max 30
  locationScore: number;     // max 20
  mediumScore: number;       // max 15
  classScore: number;        // max 10
  salaryScore: number;       // max 10
  genderScore: number;       // max 5
  qualificationScore: number; // max 5
  bonusScore: number;        // verified + premium + rating + experience
  totalScore: number;        // 0-100+
}

/** একটি Shortlisted Tutor entry */
export interface IShortlistedTutor {
  tutorId: Types.ObjectId;
  score: number;
  matchDetails: IMatchDetails;
  shortlistedAt: Date;
}

export interface ITuitionJob {
  _id?: Types.ObjectId;
  customId?: string;
  postedBy: Types.ObjectId;
  studentClass: string;
  subjects: string[];
  location: ITuitionLocation;
  salary: number;
  medium: string;
  genderPreference: TGenderPreference;
  tutoringDays?: string[];
  numStudents?: number;
  requirements?: string[];

  // ─── Auto Matching ─────────────────────────────────────────────
  /** Tutor-এর পছন্দের সময়: morning | afternoon | evening */
  preferredTime?: string[];
  /** Guardian-এর প্রত্যাশিত Tutor-এর ন্যূনতম যোগ্যতা */
  tutorQualification?: string;
  /** ন্যূনতম অভিজ্ঞতার বছর */
  tutorExperienceMin?: number;
  /** টিউশনের ধরন: Home | Online | Both */
  tuitionType?: string;
  /** বিস্তারিত বিবরণ */
  description?: string;
  /** System-নির্বাচিত Top 5 Tutor */
  shortlistedTutors?: IShortlistedTutor[];
  /** সর্বশেষ Matching Engine চলার সময় */
  matchingRunAt?: Date;

  status: TTuitionJobStatus;
  approvalStatus: TApprovalStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TuitionJobModel = Model<ITuitionJob>;
