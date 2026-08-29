import type { Model, Types } from 'mongoose';

export type NotificationType =
  | 'application'
  | 'hire_request'
  | 'job_approval'
  | 'tuition_job'
  | 'user_registration'
  | 'tutor_verification'
  | 'payment'
  | 'auto_match'
  | 'system';

export interface INotification {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: Types.ObjectId | string;
  referenceType?: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationModel = Model<INotification>;
