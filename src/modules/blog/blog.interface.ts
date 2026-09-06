import type { Model, Types } from 'mongoose';

export interface IBlog {
  _id?: Types.ObjectId | string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  authorName: string;
  authorAvatar?: string;
  authorId?: Types.ObjectId | string;
  category: string;
  tags?: string[];
  readTimeMinutes?: number;
  views?: number;
  isPublished?: boolean;
  isFeatured?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BlogModel = Model<IBlog>;
