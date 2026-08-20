import { Schema, model } from 'mongoose';
import { VERIFICATION_STATUSES } from './verification.constants.js';
import type { IVerification, VerificationModel } from './verification.interface.js';

const verificationSchema = new Schema<IVerification, VerificationModel>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
    },
    nidDocument: {
      type: String,
      default: '',
    },
    certificateDocuments: {
      type: [String],
      default: [],
    },
    cvDocument: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: VERIFICATION_STATUSES,
        message: '{VALUE} is not a valid verification status',
      },
      default: 'Pending',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

export const Verification = model<IVerification, VerificationModel>('Verification', verificationSchema);
