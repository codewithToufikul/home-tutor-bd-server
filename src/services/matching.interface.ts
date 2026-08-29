import type { ITuitionJob, IMatchDetails } from '../modules/tuition/tuition.interface.js';
import type { ITutor } from '../modules/tutor/tutor.interface.js';

/**
 * একটি Tutor-এর Matching Result
 */
export interface IMatchResult {
  tutorId: string;
  score: number;
  matchDetails: IMatchDetails;
}

/**
 * Pluggable Matcher Interface
 * Rule-Based এবং AI-Based উভয়ই এটি implement করবে।
 * ভবিষ্যতে config.USE_AI_MATCHING = true করলেই AI Matcher ব্যবহার হবে।
 */
export interface IMatcher {
  /**
   * একটি Job ও একটি Tutor-এর মধ্যে Matching Score calculate করবে।
   * @returns 0-100+ score সহ বিস্তারিত breakdown
   */
  calculate(job: ITuitionJob, tutor: ITutor): Promise<IMatchResult>;
}
