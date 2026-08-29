import type { ITuitionJob, IMatchDetails } from '../modules/tuition/tuition.interface.js';
import type { ITutor } from '../modules/tutor/tutor.interface.js';
import type { IMatcher, IMatchResult } from './matching.interface.js';

// ─── Score Constants ──────────────────────────────────────────────────────────
const WEIGHTS = {
  SUBJECT: 30,       // সবচেয়ে গুরুত্বপূর্ণ
  LOCATION: 20,      // district (10) + area bonus (10)
  MEDIUM: 15,
  CLASS: 10,
  SALARY: 10,
  GENDER: 5,
  QUALIFICATION: 5,
  // Bonus (soft score — মূল 100-এর বাইরে)
  VERIFIED: 3,
  PREMIUM: 2,
  RATING_PER_STAR: 1, // max 5 pts (5 stars)
  EXPERIENCE_PER_YEAR: 0.5, // max 5 pts (10+ years)
} as const;

const MINIMUM_SCORE_THRESHOLD = 85; // matching score ৮৫+ হলেই কেবল অটো শর্টলিস্টে আসবে

/**
 * Qualification Level Hierarchy
 * উচ্চতর মান = উচ্চতর সংখ্যা
 */
const QUALIFICATION_LEVELS: Record<string, number> = {
  ssc: 1,
  'এসএসসি': 1,
  hsc: 2,
  'এইচএসসি': 2,
  diploma: 2,
  graduate: 3,
  'স্নাতক': 3,
  honours: 3,
  bachelor: 3,
  masters: 4,
  'স্নাতকোত্তর': 4,
  msc: 4,
  mba: 4,
  phd: 5,
  'পিএইচডি': 5,
};

/**
 * Qualification level বের করে (case-insensitive)
 */
const getQualificationLevel = (q: string): number => {
  const normalized = (q || '').toLowerCase().trim();
  return QUALIFICATION_LEVELS[normalized] ?? 0;
};

/**
 * Experience string থেকে বছর বের করে।
 * "3 years", "5+ years", "২ বছর" ইত্যাদি handle করে।
 */
const parseExperienceYears = (exp: string): number => {
  if (!exp) return 0;
  const match = exp.match(/(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
};

/**
 * Subject Match Score (0-30)
 * Job-এর subjects-এর কত % Tutor-এর subjects-এ আছে।
 */
const calculateSubjectScore = (jobSubjects: string[], tutorSubjects: string[]): number => {
  if (!jobSubjects.length || !tutorSubjects.length) return 0;

  const jobNorm = jobSubjects.map(s => s.toLowerCase().trim());
  const tutorNorm = tutorSubjects.map(s => s.toLowerCase().trim());

  const matchCount = jobNorm.filter(s => tutorNorm.some(t => t.includes(s) || s.includes(t))).length;
  const ratio = matchCount / jobNorm.length;
  return Math.round(WEIGHTS.SUBJECT * ratio);
};

/**
 * Location Match Score (0-20)
 * District match = 10, Area match (bonus) = 10
 */
const calculateLocationScore = (
  jobDistrict: string,
  jobArea: string,
  tutorDistrict: string,
  tutorArea: string,
  tutorPreferredAreas: string[],
): number => {
  let score = 0;
  const jd = (jobDistrict || '').toLowerCase().trim();
  const td = (tutorDistrict || '').toLowerCase().trim();
  const ja = (jobArea || '').toLowerCase().trim();
  const ta = (tutorArea || '').toLowerCase().trim();
  const tpa = (tutorPreferredAreas || []).map(a => a.toLowerCase().trim());

  if (jd && td && (jd === td || jd.includes(td) || td.includes(jd))) {
    score += 10;
    // Area bonus
    if (ja && (ta === ja || tpa.some(a => a.includes(ja) || ja.includes(a)))) {
      score += 10;
    }
  }
  return score;
};

/**
 * Medium Match Score (0-15)
 */
const calculateMediumScore = (jobMedium: string, tutorMediums: string[]): number => {
  if (!jobMedium || !tutorMediums.length) return 0;
  const jm = jobMedium.toLowerCase().trim();
  const tm = tutorMediums.map(m => m.toLowerCase().trim());

  if (tm.some(m => m === 'both' || m.includes('both'))) return WEIGHTS.MEDIUM;
  if (tm.some(m => m.includes(jm) || jm.includes(m))) return WEIGHTS.MEDIUM;
  return 0;
};

/**
 * Class Match Score (0-10)
 */
const calculateClassScore = (jobClass: string, tutorPreferredClasses: string[]): number => {
  if (!jobClass || !tutorPreferredClasses.length) return 0;
  const jc = jobClass.toLowerCase().trim();
  const tc = tutorPreferredClasses.map(c => c.toLowerCase().trim());

  if (tc.some(c => c.includes(jc) || jc.includes(c))) return WEIGHTS.CLASS;
  return 0;
};

/**
 * Salary Compatibility Score (0-10)
 * Tutor-এর expected salary কতটা job salary-র কাছাকাছি।
 */
const calculateSalaryScore = (jobSalary: number, tutorSalary: number): number => {
  if (!jobSalary || !tutorSalary) return 5; // Data না থাকলে মাঝামাঝি দাও
  const diff = Math.abs(jobSalary - tutorSalary) / jobSalary;

  if (diff <= 0.10) return 10;       // ১০% এর মধ্যে — perfect
  if (diff <= 0.20) return 8;        // ২০% এর মধ্যে — ভালো
  if (diff <= 0.35) return 5;        // ৩৫% এর মধ্যে — ঠিকঠাক
  if (diff <= 0.50) return 2;        // ৫০% পর্যন্ত — কম
  return 0;                          // অনেক বেশি পার্থক্য
};

/**
 * Gender Preference Score (0-5)
 */
const calculateGenderScore = (jobGenderPref: string, tutorGender: string): number => {
  if (!jobGenderPref || jobGenderPref === 'Any') return WEIGHTS.GENDER;
  if (tutorGender && jobGenderPref.toLowerCase() === tutorGender.toLowerCase()) return WEIGHTS.GENDER;
  return 0;
};

/**
 * Qualification Score (0-5)
 * Tutor-এর qualification, job-এর requirement পূরণ করে কিনা।
 */
const calculateQualificationScore = (
  jobQualReq: string | undefined,
  tutorQual: string | undefined,
): number => {
  if (!jobQualReq) return WEIGHTS.QUALIFICATION; // কোনো requirement নেই — সবাই পাবে
  const requiredLevel = getQualificationLevel(jobQualReq);
  const tutorLevel = getQualificationLevel(tutorQual || '');
  if (tutorLevel >= requiredLevel) return WEIGHTS.QUALIFICATION;
  if (tutorLevel === requiredLevel - 1) return 2; // একধাপ কম — আংশিক score
  return 0;
};

/**
 * Bonus Score (soft score — 0-15)
 * Verified, Premium, Rating, Experience
 */
const calculateBonusScore = (tutor: ITutor): number => {
  let bonus = 0;
  if (tutor.isVerified) bonus += WEIGHTS.VERIFIED;
  if (tutor.isPremium) bonus += WEIGHTS.PREMIUM;

  // Rating bonus: per star, max 5 pts
  if (tutor.rating > 0) {
    bonus += Math.min(tutor.rating * WEIGHTS.RATING_PER_STAR, 5);
  }

  // Experience bonus: per year, max 5 pts
  const expYears = parseExperienceYears(tutor.experience || '');
  if (expYears > 0) {
    bonus += Math.min(expYears * WEIGHTS.EXPERIENCE_PER_YEAR, 5);
  }

  return Math.round(bonus * 10) / 10;
};

/**
 * Rule-Based Matcher — IMatcher interface implement করে।
 * এটি পুরোপুরি deterministic, explainable এবং test করা সহজ।
 */
export class RuleBasedMatcher implements IMatcher {
  async calculate(job: ITuitionJob, tutor: ITutor): Promise<IMatchResult> {
    const subjectScore = calculateSubjectScore(job.subjects, tutor.subjects);
    const locationScore = calculateLocationScore(
      job.location.district,
      job.location.area,
      tutor.location?.district || '',
      tutor.location?.area || '',
      tutor.preferredAreas || [],
    );
    const mediumScore = calculateMediumScore(job.medium, tutor.mediums);
    const classScore = calculateClassScore(job.studentClass, tutor.preferredClasses || []);
    const salaryScore = calculateSalaryScore(job.salary, tutor.salary || 0);
    const genderScore = calculateGenderScore(job.genderPreference, tutor.gender || '');
    const qualificationScore = calculateQualificationScore(job.tutorQualification, tutor.qualification);
    const bonusScore = calculateBonusScore(tutor);

    const totalScore = Math.round(
      subjectScore + locationScore + mediumScore + classScore +
      salaryScore + genderScore + qualificationScore + bonusScore
    );

    const matchDetails: IMatchDetails = {
      subjectScore,
      locationScore,
      mediumScore,
      classScore,
      salaryScore,
      genderScore,
      qualificationScore,
      bonusScore,
      totalScore,
    };

    return {
      tutorId: String(tutor._id),
      score: totalScore,
      matchDetails,
    };
  }
}

/**
 * Matching Engine — Tutor Pool থেকে একটি Job-এর জন্য Top N Tutor বাছাই করে।
 */
export const MatchingEngine = {
  /**
   * একটি Job-এর জন্য সেরা Tutor-দের Score calculate করে সাজিয়ে দেয়।
   * @param job — TuitionJob
   * @param tutors — সব Available Tutor
   * @param topN — কতজন চাই (default: 5)
   * @param matcher — কোন Matcher ব্যবহার করব (default: RuleBasedMatcher)
   */
  async run(
    job: ITuitionJob,
    tutors: ITutor[],
    topN = 5,
    matcher: IMatcher = new RuleBasedMatcher(),
  ): Promise<IMatchResult[]> {
    if (!tutors.length) return [];

    // সব Tutor-এর Score calculate করো (parallel)
    const results = await Promise.all(
      tutors.map(tutor => matcher.calculate(job, tutor)),
    );

    // Minimum threshold filter
    const qualified = results.filter(r => r.score >= MINIMUM_SCORE_THRESHOLD);

    if (!qualified.length) return [];

    // Score-এর ভিত্তিতে sort করো (বেশি আগে)
    qualified.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreaker: subjectScore > locationScore
      if (b.matchDetails.subjectScore !== a.matchDetails.subjectScore)
        return b.matchDetails.subjectScore - a.matchDetails.subjectScore;
      return b.matchDetails.locationScore - a.matchDetails.locationScore;
    });

    return qualified.slice(0, topN);
  },
};

export { MINIMUM_SCORE_THRESHOLD };
