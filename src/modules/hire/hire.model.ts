import { Schema, model } from 'mongoose';
import { HIRE_REQUEST_STATUSES } from './hire.constants.js';
import type { HireRequestModel, IHireRequest } from './hire.interface.js';

const requestLocationSchema = new Schema(
  {
    district: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    detailedAddress: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const confirmedTuitionSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'TuitionJob' },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    salary: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    daysPerWeek: { type: String, default: '' },
    studentClass: { type: String, default: '' },
    subjects: { type: [String], default: [] },
    location: { type: requestLocationSchema, default: () => ({}) },
    confirmedAt: { type: Date, default: Date.now },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const hireRequestSchema = new Schema<IHireRequest, HireRequestModel>(
  {
    guardianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guardianName: {
      type: String,
      required: [true, 'Guardian / Student name is required'],
      trim: true,
    },
    guardianPhone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    guardianEmail: {
      type: String,
      trim: true,
      default: '',
    },
    studentClass: {
      type: String,
      trim: true,
      default: '',
    },
    subjects: {
      type: Schema.Types.Mixed,
      default: [],
    },
    salaryOffer: {
      type: Schema.Types.Mixed,
      default: 'Negotiable',
    },
    requirements: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: requestLocationSchema,
      default: () => ({}),
    },
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
    },
    tutorProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'Tutor',
      default: null,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'TuitionJob',
      default: null,
    },
    message: {
      type: String,
      trim: true,
      default: '',
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: HIRE_REQUEST_STATUSES,
        message: '{VALUE} is not a valid hire request status',
      },
      default: 'Pending',
    },
    confirmedTuition: {
      type: confirmedTuitionSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

hireRequestSchema.index({ status: 1 });
hireRequestSchema.index({ tutorId: 1 });
hireRequestSchema.index({ guardianPhone: 1 });
hireRequestSchema.index({ createdAt: -1 });

export const HireRequest = model<IHireRequest, HireRequestModel>('HireRequest', hireRequestSchema);

