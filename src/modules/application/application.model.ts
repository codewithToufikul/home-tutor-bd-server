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
  },
  {
    timestamps: true,
  },
);

applicationSchema.index({ jobId: 1, tutorId: 1 }, { unique: true });

export const Application = model<IApplication, ApplicationModel>('Application', applicationSchema);
