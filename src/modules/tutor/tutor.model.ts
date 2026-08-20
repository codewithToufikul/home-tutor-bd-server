import { Schema, model } from 'mongoose';
import { GENDERS } from './tutor.constants.js';
import type { ITutor, TutorModel } from './tutor.interface.js';

const tutorLocationSchema = new Schema(
  {
    district: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const tutorSchema = new Schema<ITutor, TutorModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    university: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    qualification: { type: String, trim: true, default: '' },
    experience: { type: String, trim: true, default: '' },
    subjects: { type: [String], default: [] },
    preferredAreas: { type: [String], default: [] },
    mediums: { type: [String], default: [] },
    salary: { type: Number, default: 0 },
    gender: {
      type: String,
      enum: { values: GENDERS, message: '{VALUE} is not a valid gender' },
      default: 'Male',
    },
    location: {
      type: tutorLocationSchema,
      default: () => ({ district: '', area: '' }),
    },
    bio: { type: String, trim: true, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    nid: { type: String, default: '' },
    certificates: { type: [String], default: [] },
    cv: { type: String, default: '' },
  },
  { timestamps: true },
);

// ─── Single Field Indexes ──────────────────────────────────────────────────
tutorSchema.index({ subjects: 1 });
tutorSchema.index({ 'location.district': 1 });
tutorSchema.index({ 'location.area': 1 });
tutorSchema.index({ isVerified: 1 });
tutorSchema.index({ isPremium: 1 });
tutorSchema.index({ rating: -1 });
tutorSchema.index({ salary: 1 });

// ─── Compound Indexes ─────────────────────────────────────────────────────
// Most common search: district + subject + verified tutors
tutorSchema.index({ 'location.district': 1, subjects: 1, isVerified: 1 });
// Sorting by premium first, then rating
tutorSchema.index({ isPremium: -1, rating: -1 });
// Salary range filter combined with district
tutorSchema.index({ 'location.district': 1, salary: 1 });
// Area within district
tutorSchema.index({ 'location.district': 1, 'location.area': 1 });

export const Tutor = model<ITutor, TutorModel>('Tutor', tutorSchema);
