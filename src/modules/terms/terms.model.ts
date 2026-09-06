import { Schema, model } from 'mongoose';
import type { ITerm, TermModel } from './terms.interface.js';

export const DEFAULT_TERMS: Array<Omit<ITerm, '_id' | 'createdAt' | 'updatedAt'>> = [
  {
    category: 'tutor',
    title: 'সার্ভিস চার্জ প্রদান:',
    content: 'টিউশন কনফর্ম হওয়ার (৭-১০) দিনের মধ্যে, প্রথম মাসের বেতনের ৬০% টাকা Home Tutor Provider BD-কে সার্ভিস চার্জ হিসেবে প্রদান করতে হবে।',
    order: 1,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'টিউশন বাতিল হলে ফেরত:',
    content: 'টিউশন কনফর্ম হওয়ার (৭-১০) দিনের মধ্যে প্রথম মাসের বেতনের ৬০% টাকা প্রদান করার পর যদি টিউশন ১ মাসের মধ্যে অভিভাবক কর্তৃক অনিচ্ছাকৃত কারণে চলে যায়, তবে ৩০% টাকা ফেরত দেওয়া হবে। তবে টিউটরের নিজস্ব ভুলের কারণে (যেমন: অনিয়মিত যাওয়া, পড়াতে অপারগতা) টিউশন বাতিল হলে কোনো সার্ভিস চার্জ ফেরত দেওয়া হবে না।',
    order: 2,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'গার্ডিয়ানের সাথে যোগাযোগ:',
    content: 'গার্ডিয়ানের নাম্বার পাওয়ার সাথে সাথে ১ ঘণ্টার মধ্যে গার্ডিয়ানের সাথে ফোনে যোগাযোগ করতে হবে এবং Home Tutor Provider BD কর্তৃপক্ষকে কল আপডেট জানাতে হবে।',
    order: 3,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'ডেমো ক্লাসের আপডেট:',
    content: 'ডেমো ক্লাসের সময়সূচি ও ফলাফল নিয়মিত অ্যাডমিনকে জানাতে হবে। আপডেট না জানানোর কারণে যদি টিউশন বাতিল হয়ে যায়, তার দায়ভার সম্পূর্ণ টিউটরের থাকবে।',
    order: 4,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'ডেমো ক্লাস নীতিমালা:',
    content: 'টিউটরকে সর্বোচ্চ ২টি ফ্রি ডেমো ক্লাস করাতে হবে, যার জন্য অগ্রিম কোনো অর্থ দাবি করা যাবে না। অভিভাবক সন্তুষ্ট হয়ে কনফার্ম করলে নিয়মিত ক্লাস শুরু হবে।',
    order: 5,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'দায়িত্বহীনতার পরিণতি ও BTPA পলিসি:',
    content: 'টিচারের দায়িত্বহীনতার কারণে যদি টিউশন বাতিল হয়, তাহলে ভবিষ্যতে আর টিউশন দেওয়া হবে না। এ বিষয়ে BTPA (Bangladesh Tuition Provider Association)-এ রিপোর্ট করা হতে পারে।',
    order: 6,
    isActive: true,
  },
  {
    category: 'tutor',
    title: 'আবেদন নীতিমালা ও সততা:',
    content: 'টিউশনে আবেদন করার সময় বিষয়, লোকেশন, স্যালারি ও সাপ্তাহিক দিন ভালোভাবে দেখে আবেদন করুন। নাম্বার পাওয়ার পর দূরত্ব বা সময়ের অজুহাতে টিউশন ড্রপ করা যাবে না।',
    order: 7,
    isActive: true,
  },
  {
    category: 'student_guardian',
    title: 'যোগ্য ও ভেরিফাইড টিউটর নির্বাচন:',
    content: 'অভিভাবকরা টিউটরের জাতীয় পরিচয়পত্র ও স্টুডেন্ট আইডি কার্ড যাচাই করে নিতে পারবেন। আমাদের সকল প্রিমিয়াম টিউটর প্ল্যাটফর্ম ভেরিফাইড।',
    order: 8,
    isActive: true,
  },
  {
    category: 'student_guardian',
    title: 'ডেমো ক্লাস ও চূড়ান্তকরণ:',
    content: 'অভিভাবক ও শিক্ষার্থীর পছন্দ অনুযায়ী ২টি ডেমো ক্লাসের পর টিউটরকে নিয়মিত পড়ানোর জন্য নিশ্চিত করতে হবে। কোনো কারণে পছন্দ না হলে দ্রুত কর্তৃপক্ষকে জানাতে হবে।',
    order: 9,
    isActive: true,
  },
  {
    category: 'coaching',
    title: 'কোচিং সেন্টার ও ব্যাচ ম্যানেজমেন্ট:',
    content: 'রেজিস্টার্ড কোচিং সেন্টারসমূহ তাদের নিজস্ব ব্যাচ, বিষয় ও ফি প্ল্যাটফর্মে যুক্ত করতে পারবে। প্ল্যাটফর্মের মাধ্যমে ভর্তি হওয়া শিক্ষার্থীদের সঠিক ট্র্যাকিং নিশ্চিত করতে হবে।',
    order: 10,
    isActive: true,
  },
  {
    category: 'general',
    title: 'প্ল্যাটফর্ম ব্যবহারের সাধারণ শর্তাবলী:',
    content: 'Home Tutor Provider BD শিক্ষক ও শিক্ষার্থীদের মাঝে একটি বিশ্বস্ত সেতুবন্ধন। যে কোনো ধরনের অনৈতিক বা প্রতারণামূলক কার্যকলাপের বিরুদ্ধে জিরো টলারেন্স নীতি অনুসরণ করা হয়।',
    order: 11,
    isActive: true,
  }
];

const termSchema = new Schema<ITerm, TermModel>(
  {
    category: {
      type: String,
      enum: ['tutor', 'student_guardian', 'coaching', 'general'],
      required: true,
      default: 'tutor',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

termSchema.index({ category: 1, order: 1 });

export const Term = model<ITerm, TermModel>('Term', termSchema);
