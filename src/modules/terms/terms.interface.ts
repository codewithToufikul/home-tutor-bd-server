import type { Model, Types } from 'mongoose';

export type TermCategory = 'tutor' | 'student_guardian' | 'coaching' | 'general';

export interface ITerm {
  _id?: Types.ObjectId | string;
  category: TermCategory;
  title: string;
  content: string;
  order: number;
  isActive: boolean;
  updatedBy?: Types.ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TermModel = Model<ITerm>;
