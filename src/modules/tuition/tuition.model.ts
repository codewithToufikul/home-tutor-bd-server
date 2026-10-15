import { Schema, model } from 'mongoose';
import {
  APPROVAL_STATUSES,
  GENDER_PREFERENCES,
  TUITION_JOB_STATUSES,
} from './tuition.constants.js';
import type { ITuitionJob, TuitionJobModel } from './tuition.interface.js';

const tuitionLocationSchema = new Schema(
  {
    division: { type: String, trim: true, default: '' },
    district: { type: String, required: [true, 'District is required'], trim: true },
    upazila: { type: String, trim: true, default: '' },
    union: { type: String, trim: true, default: '' },
    ward: { type: String, trim: true, default: '' },
    area: { type: String, required: [true, 'Area is required'], trim: true },
    detailedAddress: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

/** Auto Matching Score ব্রেকডাউন Schema */
const matchDetailsSchema = new Schema(
  {
    subjectScore: { type: Number, default: 0 },
    locationScore: { type: Number, default: 0 },
    mediumScore: { type: Number, default: 0 },
    classScore: { type: Number, default: 0 },
    salaryScore: { type: Number, default: 0 },
    genderScore: { type: Number, default: 0 },
    qualificationScore: { type: Number, default: 0 },
    bonusScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Shortlisted Tutor entry Schema */
const shortlistedTutorSchema = new Schema(
  {
    tutorId: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true },
    score: { type: Number, required: true },
    matchDetails: { type: matchDetailsSchema, required: true },
    shortlistedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const tuitionJobSchema = new Schema<ITuitionJob, TuitionJobModel>(
  {
    customId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
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
    salary: { type: Number, required: [true, 'Salary is required'], default: 0 },
    salaryMax: { type: Number },
    salaryRange: { type: String, trim: true },
    negotiable: { type: Boolean, default: false },
    medium: { type: String, required: [true, 'Medium is required'], trim: true },
    genderPreference: {
      type: String,
      enum: { values: GENDER_PREFERENCES, message: '{VALUE} is not a valid gender preference' },
      default: 'Any',
    },
    tutoringDays: { type: [String], default: [] },
    numStudents: { type: Number, default: 1 },
    requirements: { type: [String], default: [] },

    // ─── Contact & Preferences ────────────────────────────────────────────────
    phone: { type: String, trim: true, default: '' },
    whatsappNumber: { type: String, trim: true, default: '' },
    contactName: { type: String, trim: true, default: '' },
    universityPreference: { type: String, trim: true, default: '' },
    studentGender: { type: String, trim: true, default: 'Any' },
    duration: { type: String, trim: true, default: '1.5 Hours' },
    startTime: { type: String, trim: true, default: 'Evening' },

    // ─── Auto Matching ────────────────────────────────────────────────────────
    preferredTime: { type: [String], default: [] },
    tutorQualification: { type: String, trim: true, default: '' },
    tutorExperienceMin: { type: Number, default: 0 },
    tuitionType: { type: String, trim: true, default: 'Home' },
    description: { type: String, trim: true, default: '' },
    /** Top 5 Auto-Matched Tutors — System-generated */
    shortlistedTutors: { type: [shortlistedTutorSchema], default: [] },
    /** শেষবার Matching Engine কখন চলেছে */
    matchingRunAt: { type: Date, default: null },

    assignedTutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    activeDemoCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: { values: TUITION_JOB_STATUSES, message: '{VALUE} is not a valid status' },
      default: 'Open',
    },
    approvalStatus: {
      type: String,
      enum: { values: APPROVAL_STATUSES, message: '{VALUE} is not a valid approval status' },
      default: 'Approved',
    },
  },
  { timestamps: true, strict: false },
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
tuitionJobSchema.index({ createdAt: -1 });

// Compound: most common job search and sort patterns
tuitionJobSchema.index({ approvalStatus: 1, status: 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, status: 1, 'location.district': 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, status: 1, 'location.area': 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, status: 1, medium: 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, status: 1, studentClass: 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, status: 1, tuitionType: 1, createdAt: -1 });
tuitionJobSchema.index({ approvalStatus: 1, subjects: 1 });
tuitionJobSchema.index({ postedBy: 1, status: 1 });

// Auto Matching indexes
tuitionJobSchema.index({ 'shortlistedTutors.tutorId': 1 });
tuitionJobSchema.index({ matchingRunAt: 1 });

export const TuitionJob = model<ITuitionJob, TuitionJobModel>('TuitionJob', tuitionJobSchema);

