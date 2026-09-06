import type { Model, Types } from 'mongoose';

export interface INotice {
  _id?: Types.ObjectId | string;
  title: string;
  content: string;
  audience: 'All' | 'Tutors' | 'Guardians' | 'Students' | 'Coaching';
  priority: 'Low' | 'Medium' | 'High';
  category: 'Policy' | 'Event' | 'System' | 'General';
  displayUntil?: Date | string;
  attachmentURL?: string;
  attachmentName?: string;
  attachmentPath?: string;
  createdBy?: Types.ObjectId | string;
  isPublished?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NoticeModel = Model<INotice>;
