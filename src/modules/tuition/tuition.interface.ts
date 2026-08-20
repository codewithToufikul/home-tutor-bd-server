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

export interface ITuitionJob {
  _id?: Types.ObjectId;
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
  status: TTuitionJobStatus;
  approvalStatus: TApprovalStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TuitionJobModel = Model<ITuitionJob>;
