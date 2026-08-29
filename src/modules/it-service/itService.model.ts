import { Schema, model } from 'mongoose';
import type { ITServiceDocument } from './itService.interface.js';

const itServiceSchema = new Schema<ITServiceDocument>(
  {
    title: {
      type: String,
      required: [true, 'Service title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'web_development',
        'app_development',
        'ui_ux_design',
        'custom_software',
        'digital_marketing',
        'cloud_devops',
        'ai_data_solutions',
        'other',
      ],
      default: 'web_development',
      required: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
    },
    fullDescription: {
      type: String,
      required: [true, 'Full description is required'],
    },
    icon: {
      type: String,
      default: 'Code',
    },
    thumbnail: {
      type: String,
      default: '',
    },
    bannerImage: {
      type: String,
      default: '',
    },
    startingPrice: {
      type: Number,
      default: 0,
    },
    deliveryTime: {
      type: String,
      default: '3-7 days',
    },
    features: {
      type: [String],
      default: [],
    },
    technologies: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

itServiceSchema.index({ slug: 1 });
itServiceSchema.index({ category: 1, isActive: 1 });

export const ITService = model<ITServiceDocument>('ITService', itServiceSchema);
