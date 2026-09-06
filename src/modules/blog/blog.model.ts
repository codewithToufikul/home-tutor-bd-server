import { Schema, model } from 'mongoose';
import type { IBlog, BlogModel } from './blog.interface.js';

const blogSchema = new Schema<IBlog, BlogModel>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '' },
    content: { type: String, required: true },
    coverImage: { type: String, default: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80' },
    authorName: { type: String, default: 'Home Tutor Editorial Team' },
    authorAvatar: { type: String, default: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: {
      type: String,
      default: 'Tuition Tips',
    },
    tags: { type: [String], default: [] },
    readTimeMinutes: { type: Number, default: 4 },
    views: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

blogSchema.index({ title: 'text', content: 'text', category: 'text' });

export const Blog = model<IBlog, BlogModel>('Blog', blogSchema);
