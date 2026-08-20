import { Schema, model } from 'mongoose';
import { HIRE_REQUEST_STATUSES } from './hire.constants.js';
import type { HireRequestModel, IHireRequest } from './hire.interface.js';

const hireRequestSchema = new Schema<IHireRequest, HireRequestModel>(
  {
    guardianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Guardian ID is required'],
    },
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
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
    status: {
      type: String,
      enum: {
        values: HIRE_REQUEST_STATUSES,
        message: '{VALUE} is not a valid hire request status',
      },
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  },
);

export const HireRequest = model<IHireRequest, HireRequestModel>('HireRequest', hireRequestSchema);
