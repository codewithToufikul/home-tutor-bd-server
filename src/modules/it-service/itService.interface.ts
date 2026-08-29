import type { Document, Types } from 'mongoose';

export type ITServiceCategory =
  | 'web_development'
  | 'app_development'
  | 'ui_ux_design'
  | 'custom_software'
  | 'digital_marketing'
  | 'cloud_devops'
  | 'ai_data_solutions'
  | 'other';

export interface IITService {
  title: string;
  slug: string;
  category: ITServiceCategory;
  shortDescription: string;
  fullDescription: string;
  icon?: string;
  thumbnail?: string;
  bannerImage?: string;
  startingPrice?: number;
  deliveryTime?: string;
  features: string[];
  technologies: string[];
  isActive: boolean;
  order: number;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ITServiceDocument = IITService & Document;
