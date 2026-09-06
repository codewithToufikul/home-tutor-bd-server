import { AppError } from '../../errors/AppError.js';
import type { IBlog } from './blog.interface.js';
import { Blog } from './blog.model.js';

const generateSlug = async (title: string, currentId?: string): Promise<string> => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  if (!baseSlug) baseSlug = 'blog-post';

  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await Blog.findOne({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) });
    if (!existing) break;
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
};

const calculateReadTime = (content: string): number => {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 180));
};

const createBlog = async (payload: Partial<IBlog>, authorId?: string) => {
  if (!payload.title || !payload.content) {
    throw new AppError(400, 'Title and content are required for a blog post.');
  }

  const slug = payload.slug ? await generateSlug(payload.slug) : await generateSlug(payload.title);
  const readTimeMinutes = payload.readTimeMinutes || calculateReadTime(payload.content);

  const blog = await Blog.create({
    ...payload,
    slug,
    readTimeMinutes,
    authorId: authorId ? (authorId as any) : undefined,
    authorName: payload.authorName || 'Home Tutor Editorial',
    isPublished: payload.isPublished ?? true,
  });

  return blog;
};

const getAllBlogs = async (query: Record<string, unknown> = {}) => {
  const filter: Record<string, unknown> = {};

  if (query['isPublished'] !== undefined) {
    filter['isPublished'] = query['isPublished'] === 'true' || query['isPublished'] === true;
  } else if (!query['all']) {
    // Default public view: only published
    filter['isPublished'] = true;
  }

  if (query['category'] && query['category'] !== 'All') {
    filter['category'] = query['category'];
  }

  if (query['search']) {
    const q = String(query['search']).trim();
    filter['$or'] = [
      { title: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { excerpt: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(query['page']) || 1);
  const limit = Math.max(1, Number(query['limit']) || 20);
  const skip = (page - 1) * limit;

  const [blogs, total] = await Promise.all([
    Blog.find(filter).sort({ isFeatured: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);

  return {
    blogs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getBlogByIdOrSlug = async (idOrSlug: string) => {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
  const query = isObjectId ? { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] } : { slug: idOrSlug };

  const blog = await Blog.findOneAndUpdate(
    query,
    { $inc: { views: 1 } },
    { returnDocument: 'after' }
  ).lean();

  if (!blog) {
    throw new AppError(404, 'Blog post not found.');
  }

  // Fetch 3 related blogs
  const relatedBlogs = await Blog.find({
    _id: { $ne: blog._id },
    category: blog.category,
    isPublished: true,
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  return {
    ...blog,
    relatedBlogs,
  };
};

const updateBlog = async (id: string, payload: Partial<IBlog>) => {
  if (payload.title && !payload.slug) {
    payload.slug = await generateSlug(payload.title, id);
  }
  if (payload.content) {
    payload.readTimeMinutes = calculateReadTime(payload.content);
  }

  const blog = await Blog.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
  if (!blog) {
    throw new AppError(404, 'Blog post not found.');
  }
  return blog;
};

const deleteBlog = async (id: string) => {
  const blog = await Blog.findByIdAndDelete(id);
  if (!blog) {
    throw new AppError(404, 'Blog post not found.');
  }
  return blog;
};

const seedInitialBlogsIfEmpty = async () => {
  const count = await Blog.countDocuments();
  if (count > 0) return;

  const initialBlogs: Partial<IBlog>[] = [
    {
      title: 'কীভাবে একজন সফল ও জনপ্রিয় প্রাইভেট টিউটর হবেন? (Tutor Guide)',
      slug: 'how-to-become-successful-home-tutor-bangladesh',
      category: 'Tuition Tips',
      excerpt: 'টিউশনিতে ভালো করার কিছু অত্যন্ত কার্যকর কৌশল, যা আপনার পড়ানোর মান বৃদ্ধি করবে এবং অভিভাবকদের আস্থাশীল করবে।',
      content: `টিউশনি শুধুমাত্র একটি পার্ট-টাইম পেশা নয়, বরং এটি শিক্ষকতার প্রথম পদক্ষেপ এবং ভবিষ্যতের জন্য দারুণ একটি ক্যারিয়ার স্কিল। একজন সফল টিউটর হতে হলে বিষয়ের প্রতি গভীর দখল থাকার পাশাপাশি শিক্ষার্থীর মানসিকতা বোঝা ও অভিভাবকদের সাথে পেশাদার যোগাযোগ বজায় রাখা জরুরি।

### ১. প্রথম ক্লাসের প্রস্তুতি (First Impression)
প্রথম দিনের ক্লাসে যথাসময়ে উপস্থিত হওয়া অত্যন্ত গুরুত্বপূর্ণ। শিক্ষার্থীর বর্তমান পাঠ্যক্রম, সিলেবাস এবং দুর্বলতার জায়গাগুলো চিহ্নিত করুন।

### ২. কনসেপ্ট ক্লিয়ারিং মেথড
মুখস্থ করানোর চেয়ে বিষয়টি কেন এবং কীভাবে কাজ করছে তা বাস্তব উদাহরণের মাধ্যমে বুঝিয়ে দিন। এতে শিক্ষার্থী পড়ার প্রতি আগ্রহী হবে।

### ৩. নিয়মিত মূল্যায়ন ও সাপ্তাহিক পরীক্ষা
প্রতি সপ্তাহে যা পড়ানো হলো তার উপর ছোট একটি টেস্ট নিন। এর মাধ্যমে শিক্ষার্থীর অগ্রগতি ট্র্যাক করা সহজ হয় এবং অভিভাবকও ফলাফল দেখে সন্তুষ্ট হন।

### ৪. পেশাদারিত্ব ও সময়ানুবর্তিতা
ক্লাসের শিডিউল মেনে চলুন এবং অপ্রয়োজনীয়ভাবে ছুটি নেওয়া থেকে বিরত থাকুন। কোনো পরিবর্তন হলে অভিভাবকদের আগেই বিনয়ের সাথে জানিয়ে দিন।`,
      coverImage: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1200&q=80',
      authorName: 'Home Tutor Research Desk',
      readTimeMinutes: 4,
      isPublished: true,
      isFeatured: true,
      views: 128,
    },
    {
      title: 'সন্তানের জন্য সঠিক হোম টিউটর নির্বাচনের গুরুত্বপূর্ণ গাইডলাইন (Parents Guide)',
      slug: 'how-parents-choose-best-home-tutor-guide',
      category: 'Parents Guide',
      excerpt: 'সন্তানের রেজাল্ট ও ভবিষ্যতের জন্য বিশ্বস্ত ও যোগ্য শিক্ষক খোঁজার সময় অভিভাবকদের যে বিষয়গুলো খেয়াল রাখা উচিত।',
      content: `অভিভাবকদের কাছে সন্তানের সঠিক শিক্ষা ও পরিচর্যা সবচেয়ে গুরুত্বপূর্ণ দায়িত্ব। একজন ভালো শিক্ষক শুধুমাত্র পড়াশোনাতেই সাহায্য করেন না, বরং শিক্ষার্থীর মোটিভেশন ও কনফিডেন্স বাড়াতে অগ্রণী ভূমিকা রাখেন।

### ১. টিউটরের শিক্ষাগত যোগ্যতা ও বিশ্ববিদ্যালয় ব্যাকগ্রাউন্ড
টিউটর কোন বিশ্ববিদ্যালয়ে এবং কোন ডিপার্টমেন্টে পড়ছেন তা যাচাই করুন। বিজ্ঞান বিভাগের শিক্ষার্থীদের জন্য ইঞ্জিনিয়ারিং বা সায়েন্স ব্যাকগ্রাউন্ডের টিউটর এবং কমার্স বা আর্টসের জন্য সংশ্লিষ্ট ব্যাকগ্রাউন্ডের শিক্ষক নেওয়া শ্রেয়।

### ২. ভেরিফিকেশন ও নিরাপত্তা (NID & Student ID)
Home Tutor BD-এর মতো বিশ্বস্ত প্ল্যাটফর্ম ব্যবহার করুন যেখানে টিউটরদের জাতীয় পরিচয়পত্র (NID) এবং বিশ্ববিদ্যালয় আইডি কার্ড অ্যাডমিন কর্তৃক ভেরিফাইড থাকে।

### ৩. টিউটরের ধৈর্য ও বুঝানোর ক্ষমতা
প্রথম ২-৩ দিনের ডেমো ক্লাসে লক্ষ্য করুন শিক্ষক কতটুকু ধৈর্য নিয়ে আপনার সন্তানের প্রশ্নগুলোর উত্তর দিচ্ছেন।`,
      coverImage: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80',
      authorName: 'Academic Advisory Board',
      readTimeMinutes: 5,
      isPublished: true,
      isFeatured: true,
      views: 94,
    },
    {
      title: 'বোর্ড পরীক্ষা ও এডমিশন টেস্টে ভালো করার ৫টি সেরা টেকনিক (Study Hacks)',
      slug: '5-study-hacks-to-ace-board-exams-and-admission',
      category: 'Study Guides',
      excerpt: 'কম পরিশ্রমে সর্বোচ্চ ফলাফল অর্জনের জন্য বৈজ্ঞানিক স্টাডি মেথড এবং টাইম ম্যানেজমেন্ট সিক্রেটস।',
      content: `পড়াশোনা করার সময় ঘণ্টার পর ঘণ্টা বই নিয়ে বসে থাকার চেয়ে স্মার্টলি পড়ার অভ্যাস গড়ে তোলা বেশি ফলপ্রসূ।

### ১. পোমোডোরো টেকনিক (Pomodoro Method)
একটানা পড়ার চেয়ে ২৫ মিনিট গভীর মনোযোগ দিয়ে পড়ুন, এরপর ৫ মিনিটের একটি বিরতি নিন। প্রতি ৪টি সেশনের পর ১৫-২০ মিনিটের লম্বা বিরতি দিন। এতে মস্তিষ্কের রিটেনশন পাওয়ার বৃদ্ধি পায়।

### ২. অ্যাক্টিভ রিকল ও স্পেসড রিপিটেশন
পড়ার পর বই বন্ধ করে নিজে নিজে মনে করার চেষ্টা করুন অথবা খাতায় মূল পয়েন্টগুলো লিখে ফেলুন। ১ দিন, ৩ দিন ও ৭ দিন পর রিভিশন দিন।

### ৩. বিগত বছরের প্রশ্ন বিশ্লেষণ (Question Bank Analysis)
বিগত ৫-১০ বছরের বোর্ড ও বিশ্ববিদ্যালয়ের প্রশ্ন সমাধান করলে প্রশ্নের ধরন ও গুরুত্বপূর্ণ টপিকগুলো সহজেই আয়ত্তে আসে।`,
      coverImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
      authorName: 'Engr. Toufikul Islam',
      readTimeMinutes: 4,
      isPublished: true,
      isFeatured: true,
      views: 215,
    }
  ];

  await Blog.insertMany(initialBlogs);
  console.log('✅ Initial educational blogs seeded successfully into MongoDB!');
};

// Seed on module initialization
setTimeout(() => {
  seedInitialBlogsIfEmpty().catch((err) => console.warn('⚠️ Blog seed error:', err));
}, 3000);

export const BlogService = {
  createBlog,
  getAllBlogs,
  getBlogByIdOrSlug,
  updateBlog,
  deleteBlog,
};
