import mongoose, { Schema } from 'mongoose';
import type { DownloadFileModel, IDownloadFile } from './download.interface.js';

const downloadFileSchema = new Schema<IDownloadFile>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true, uppercase: true, default: 'PDF' },
    fileSize: { type: String, default: '0 KB' },
    category: {
      type: String,
      enum: ['Lecture Notes', 'Syllabus', 'E-Book', 'Question Bank', 'Lab Manual', 'Diagrams', 'Study Guide', 'General'],
      default: 'General',
    },
    targetRoles: {
      type: [String],
      enum: ['student', 'tutor', 'coaching', 'guardian', 'all'],
      default: ['all'],
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    downloadsCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

downloadFileSchema.index({ title: 'text', category: 1 });
downloadFileSchema.index({ targetRoles: 1, isPublished: 1 });
downloadFileSchema.index({ createdAt: -1 });

export const DownloadFile = mongoose.model<IDownloadFile, DownloadFileModel>(
  'DownloadFile',
  downloadFileSchema
);
