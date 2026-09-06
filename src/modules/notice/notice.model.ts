import { Schema, model } from 'mongoose';
import type { INotice, NoticeModel } from './notice.interface.js';

const noticeSchema = new Schema<INotice, NoticeModel>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    audience: {
      type: String,
      enum: ['All', 'Tutors', 'Guardians', 'Students', 'Coaching'],
      default: 'All',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    category: {
      type: String,
      enum: ['Policy', 'Event', 'System', 'General'],
      default: 'General',
    },
    displayUntil: { type: Date, default: null },
    attachmentURL: { type: String, default: '' },
    attachmentName: { type: String, default: '' },
    attachmentPath: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Notice = model<INotice, NoticeModel>('Notice', noticeSchema);
