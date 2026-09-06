import type { Model, Types } from 'mongoose';

export interface IDownloadFile {
  _id?: Types.ObjectId | string;
  title: string;
  description?: string;
  fileUrl: string;           // Cloudflare R2 public URL
  publicId: string;          // R2 object key (path inside bucket)
  fileName: string;
  fileType: string;           // PDF, DOCX, etc.
  fileSize: string;           // e.g., "2.4 MB"
  category: 'Lecture Notes' | 'Syllabus' | 'E-Book' | 'Question Bank' | 'Lab Manual' | 'Diagrams' | 'Study Guide' | 'General';
  targetRoles: Array<'student' | 'tutor' | 'coaching' | 'guardian' | 'all'>;
  uploadedBy: Types.ObjectId | string;
  downloadsCount: number;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DownloadFileModel = Model<IDownloadFile>;
