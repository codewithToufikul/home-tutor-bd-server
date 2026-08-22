import { Schema, model } from 'mongoose';
import { BATCH_STATUSES } from './coaching.constants.js';
import type { CoachingModel, ICoachingBatch, ICoachingProfile } from './coaching.interface.js';

const coachingBatchSchema = new Schema<ICoachingBatch>({
  batchName: { type: String, required: true },
  className: { type: String, required: true },
  subject: { type: String, required: true },
  schedule: { type: String, default: '3 Days/Week' },
  fee: { type: Number, default: 0 },
  maxStudents: { type: Number, default: 30 },
  enrolledCount: { type: Number, default: 0 },
  status: { type: String, enum: BATCH_STATUSES, default: 'Active' },
  instructorName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const coachingSchema = new Schema<ICoachingProfile, CoachingModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    instituteName: { type: String, required: true, trim: true },
    tradeLicense: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    district: { type: String, default: 'Dhaka' },
    location: { type: String, default: '' },
    about: { type: String, default: '' },
    batches: { type: [coachingBatchSchema], default: [] },
    assignedTutorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Coaching = model<ICoachingProfile, CoachingModel>('Coaching', coachingSchema);
