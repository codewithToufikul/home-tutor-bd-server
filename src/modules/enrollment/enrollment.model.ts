import { Schema, model } from 'mongoose';
import type { EnrollmentModel, IEnrollment } from './enrollment.interface.js';

const enrollmentSchema = new Schema<IEnrollment, EnrollmentModel>(
  {
    coachingId:     { type: Schema.Types.ObjectId, ref: 'Coaching', required: true },
    batchId:        { type: String, required: true },
    batchName:      { type: String, required: true },
    studentUserId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentName:    { type: String, default: '' },
    studentEmail:   { type: String, default: '' },
    studentPhone:   { type: String, default: '' },
    institution:    { type: String, default: '' },
    studentClass:   { type: String, default: '' },
    status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    note:           { type: String, default: '' },
  },
  { timestamps: true }
);

// Prevent duplicate enrollment for the same student in the same batch
enrollmentSchema.index({ coachingId: 1, batchId: 1, studentUserId: 1 }, { unique: true });

export const Enrollment = model<IEnrollment, EnrollmentModel>('Enrollment', enrollmentSchema);
