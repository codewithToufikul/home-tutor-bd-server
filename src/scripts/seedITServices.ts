import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

const itServiceSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true, lowercase: true },
  category: String,
  shortDescription: String,
  fullDescription: String,
  icon: String,
  thumbnail: String,
  bannerImage: String,
  startingPrice: Number,
  deliveryTime: String,
  features: [String],
  technologies: [String],
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const ITService = mongoose.model('ITService', itServiceSchema);

const SEED_SERVICES = [
  {
    title: 'Custom Web Application Development',
    slug: 'custom-web-development',
    category: 'web_development',
    shortDescription: 'Modern, blazing-fast web applications built with React, Next.js, Node.js, and scalable cloud databases.',
    fullDescription: `We build enterprise-grade web applications tailored to your business requirements.\n\nOur team delivers pixel-perfect, responsive UI with high-performance backend APIs, cloud database integration, and full-stack deployment.\n\nWhether it's an e-commerce platform, a school management portal, or a SaaS product — we architect and build scalable solutions that grow with you.`,
    icon: 'Globe',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    deliveryTime: '5–10 Days',
    features: [
      'Responsive UI & UX Design',
      'Fullstack API Integration (REST / GraphQL)',
      'SEO & Core Web Vitals Optimized',
      'Admin Dashboard Included',
      'Authentication & Role-based Access',
      'Cloud Deployment (Vercel / AWS / Railway)',
    ],
    technologies: ['React', 'Next.js', 'Node.js', 'MongoDB', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
    isActive: true,
    order: 1,
  },
  {
    title: 'Mobile App Development (iOS & Android)',
    slug: 'mobile-app-development',
    category: 'app_development',
    shortDescription: 'Cross-platform native-performance mobile applications using Flutter & React Native with push notifications.',
    fullDescription: `We design and develop beautiful, performant cross-platform mobile apps for iOS and Android from a single codebase.\n\nOur apps are integrated with Firebase, REST APIs, push notifications, real-time chat, and payment gateways.\n\nWe handle full project delivery — from design, development, testing to Play Store & App Store submission.`,
    icon: 'Smartphone',
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
    deliveryTime: '10–20 Days',
    features: [
      'Cross-Platform iOS & Android',
      'Firebase & REST API Sync',
      'Play Store & App Store Submission',
      'Real-time Messaging & Notifications',
      'Offline Mode & Local Storage',
      'Biometric / OTP Authentication',
    ],
    technologies: ['Flutter', 'React Native', 'Firebase', 'REST API', 'Dart', 'TypeScript'],
    isActive: true,
    order: 2,
  },
  {
    title: 'UI/UX Design & Brand Prototyping',
    slug: 'ui-ux-design',
    category: 'ui_ux_design',
    shortDescription: 'World-class, high-converting Figma UI/UX designs, wireframes, and design systems for web and mobile.',
    fullDescription: `We create stunning, user-centric UI/UX designs that convert visitors into customers.\n\nOur design process starts with deep research, wireframing, and interactive Figma prototypes — ensuring the final product is both beautiful and highly functional.\n\nDeliveries include a complete design system with reusable components, typography, color tokens, and developer-ready assets.`,
    icon: 'Layout',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80',
    deliveryTime: '3–7 Days',
    features: [
      'Interactive Figma Prototypes',
      'Modern Design System & Component Library',
      'User Journey Mapping & Wireframing',
      'Developer-Ready Asset Export',
      'Mobile-first Responsive Layouts',
      'Dark Mode & Accessibility Compliant',
    ],
    technologies: ['Figma', 'Adobe XD', 'Prototyping', 'Design Systems', 'Framer', 'Zeplin'],
    isActive: true,
    order: 3,
  },
  {
    title: 'School & Tuition Management ERP',
    slug: 'school-tuition-management-software',
    category: 'custom_software',
    shortDescription: 'Complete automation software for schools, coaching centers, and tuition academies with billing and SMS.',
    fullDescription: `We build fully customized ERP systems for educational institutions — schools, coaching centers, tuition academies, and universities.\n\nFeatures include student & teacher portals, automated fee invoicing, attendance tracking with SMS alerts, class scheduling, exam result management, and insightful analytics dashboards.\n\nAll data is cloud-hosted with automated backups and role-based access for Admin, Teachers, Students, and Parents.`,
    icon: 'School',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    deliveryTime: '15–30 Days',
    features: [
      'Student, Teacher & Parent Portals',
      'Automated Fee Invoice & Online Payment',
      'SMS & Email Attendance Alerts',
      'Class Scheduling & Exam Management',
      'Analytics & Performance Reports',
      'Cloud Backup & Multi-branch Support',
    ],
    technologies: ['React', 'Express', 'Node.js', 'PostgreSQL', 'Prisma', 'Cloud Backup', 'SMS Gateway'],
    isActive: true,
    order: 4,
  },
];

async function seed() {
  try {
    await mongoose.connect(DB_URL);
    console.log('✅ Connected to MongoDB');

    // Remove old seed entries (by slug) to prevent duplicates
    const slugs = SEED_SERVICES.map((s) => s.slug);
    await ITService.deleteMany({ slug: { $in: slugs } });
    console.log('🗑️  Cleared existing seed entries');

    const result = await ITService.insertMany(SEED_SERVICES);
    console.log(`🌱 Successfully seeded ${result.length} IT Services:`);
    result.forEach((s) => console.log(`   ✔ ${s.title} [${s.slug}]`));

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB. Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
