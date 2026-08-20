import { Schema, model } from 'mongoose';
import {
  APPROVAL_STATUSES,
  GENDER_PREFERENCES,
  TUITION_JOB_STATUSES,
} from './tuition.constants.js';
import type { ITuitionJob, TuitionJobModel } from './tuition.interface.js';

const tuitionLocationSchema = new Schema(
  {
    district: { type: String, required: [true, 'District is required'], trim: true },
    area: { type: String, required: [true, 'Area is required'], trim: true },
  },
  { _id: false },
);

const tuitionJobSchema = new Schema<ITuitionJob, TuitionJobModel>(
  {
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted By User ID is required'],
    },
    studentClass: { type: String, required: [true, 'Student Class is required'], trim: true },
    subjects: { type: [String], required: [true, 'At least one subject is required'], default: [] },
    location: {
      type: tuitionLocationSchema,
      required: [true, 'Location (District and Area) is required'],
    },
    salary: { type: Number, required: [true, 'Salary is required'] },
    medium: { type: String, required: [true, 'Medium is required'], trim: true },
    genderPreference: {
      type: String,
      enum: { values: GENDER_PREFERENCES, message: '{VALUE} is not a valid gender preference' },
      default: 'Any',
    },
    tutoringDays: { type: [String], default: [] },
    numStudents: { type: Number, default: 1 },
    requirements: { type: [String], default: [] },
    status: {
      type: String,
      enum: { values: TUITION_JOB_STATUSES, message: '{VALUE} is not a valid status' },
      default: 'Open',
    },
    approvalStatus: {
      type: String,
      enum: { values: APPROVAL_STATUSES, message: '{VALUE} is not a valid approval status' },
      default: 'Pending',
    },
  },
  { timestamps: true },
);

// ─── Indexes ───────────────────────────────────────────────────────────────
tuitionJobSchema.index({ 'location.district': 1 });
tuitionJobSchema.index({ 'location.area': 1 });
tuitionJobSchema.index({ subjects: 1 });
tuitionJobSchema.index({ status: 1 });
tuitionJobSchema.index({ approvalStatus: 1 });
tuitionJobSchema.index({ medium: 1 });
tuitionJobSchema.index({ salary: 1 });
tuitionJobSchema.index({ postedBy: 1 });

// Compound: most common job search pattern
tuitionJobSchema.index({ approvalStatus: 1, status: 1, 'location.district': 1 });
tuitionJobSchema.index({ approvalStatus: 1, subjects: 1 });
tuitionJobSchema.index({ postedBy: 1, status: 1 });

export const TuitionJob = model<ITuitionJob, TuitionJobModel>('TuitionJob', tuitionJobSchema);
