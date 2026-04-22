import resumeIcon from "../../assets/resume-icons/resume-icon.svg";
import resumeIcon3 from "../../assets/resume-icons/resume-icon3.svg";
import resumeIcon4 from "../../assets/resume-icons/resume-icon4.svg";
import resumeIcon5 from "../../assets/resume-icons/resume-icon5.svg";
import creamResumeIcon from "../../assets/resume-icons/applican-cream-resume-icon.svg";

export const RESUME_ICONS = [
  resumeIcon,
  resumeIcon3,
  resumeIcon4,
  resumeIcon5,
  creamResumeIcon,
];

export const INTRO_MESSAGE = "Generating Resume";
export const INTRO_MESSAGE_MS = 3000;
export const QUOTE_ROTATE_MS = 3600;
export const JOB_MARKET_QUOTES = [
  "The average job search takes about 5 months (20 weeks).",
  "Around 34% of job seekers spend 6+ months looking for a job.",
  "Many candidates submit 100-200+ applications before getting an offer.",
  "The probability of getting a job from a single application can be under 1%.",
  "The average job posting receives ~200-250 applications.",
  "Recruiters spend 6-8 seconds reviewing a resume initially.",
  "The average hiring process takes about 42 days from application to offer.",
  "Up to 70% of jobs are filled through networking rather than job boards.",
  "Many applicants apply to 50+ jobs before getting a single interview.",
  "Entry-level roles often require 2-3 years of experience despite being labeled \"entry level.\"",
];

export type ResumeProjectile = {
  id: number;
  icon: string;
  tx: number;
  ty: number;
  scale: number;
  durationMs: number;
  spinDeg: number;
};

const MIN_ANGLE_DEG = -180;
const MAX_ANGLE_DEG = 0;
const MIN_DISTANCE_PX = 380;
const MAX_DISTANCE_PX = 620;
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.12;
const MIN_DURATION_MS = 1400;
export const MAX_PROJECTILE_DURATION_MS = 2000;
const MIN_SPIN_DEG = -26;
const MAX_SPIN_DEG = 26;

export function buildResumeProjectile(id: number): ResumeProjectile {
  const angleDeg = randomBetween(MIN_ANGLE_DEG, MAX_ANGLE_DEG);
  const angleRad = (angleDeg * Math.PI) / 180;
  const distance = randomBetween(MIN_DISTANCE_PX, MAX_DISTANCE_PX);

  return {
    id,
    icon: RESUME_ICONS[Math.floor(Math.random() * RESUME_ICONS.length)],
    tx: Math.cos(angleRad) * distance,
    ty: Math.sin(angleRad) * distance,
    scale: randomBetween(MIN_SCALE, MAX_SCALE),
    durationMs: randomBetween(MIN_DURATION_MS, MAX_PROJECTILE_DURATION_MS),
    spinDeg: randomBetween(MIN_SPIN_DEG, MAX_SPIN_DEG),
  };
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
