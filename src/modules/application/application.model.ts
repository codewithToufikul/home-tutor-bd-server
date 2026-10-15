import { Schema, model } from 'mongoose';
import { APPLICATION_STATUSES } from './application.constants.js';
import type { ApplicationModel, IApplication } from './application.interface.js';

const applicationSchema = new Schema<IApplication, ApplicationModel>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'TuitionJob',
      required: [true, 'Job ID is required'],
    },
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
    },
    expectedSalary: {
      type: Number,
      default: 0,
    },
    /** টিউটরের আবেদনপত্র / পরিচিতি বার্তা */
    coverLetter: {
      type: String,
      trim: true,
      default: '',
    },
    /** কখন পড়াতে পারবেন: morning | afternoon | evening */
    availableTime: {
      type: [String],
      default: [],
    },
    /** Auto Matching Engine-এর দেওয়া Score (0-100+), Tutor Apply করলে calculate হয় */
    matchScore: {
      type: Number,
      default: null,
    },
    /** System কর্তৃক Auto Shortlisted হলে true */
    isAutoShortlisted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid application status',
      },
      default: 'Pending',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    demoConfirmedAt: {
      type: Date,
      default: null,
    },
    demoCompletedAt: {
      type: Date,
      default: null,
    },
    finalConfirmedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
    },

    // ─── Digital Legal Contract & Deed Fields ─────────────────────────
    contractId: {
      type: String,
      default: '',
    },
    signatureImage: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    signedAt: {
      type: Date,
      default: Date.now,
    },
    mediaFee: {
      type: Number,
      default: 0,
    },
    securityHash: {
      type: String,
      default: '',
    },
    agreedToTerms: {
      type: Boolean,
      default: false,
    },
    tutorSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    tuitionSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
applicationSchema.index({ jobId: 1, tutorId: 1 }, { unique: true });
applicationSchema.index({ tutorId: 1, status: 1 });
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ matchScore: -1 });
applicationSchema.index({ isAutoShortlisted: 1 });
applicationSchema.index({ contractId: 1 });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });

export const Application = model<IApplication, ApplicationModel>('Application', applicationSchema);
