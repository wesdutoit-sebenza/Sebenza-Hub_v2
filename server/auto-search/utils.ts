/**
 * Auto Search Utility Functions
 * 
 * Scoring and matching utilities for the AI-powered job matching system.
 * Based on multi-factor analysis: skills, location, salary, seniority, etc.
 */

/**
 * Calculate Jaccard similarity between two arrays of strings
 * Used for skills matching: |intersection| / |union|
 * 
 * @param a - First array (e.g., candidate skills)
 * @param b - Second array (e.g., job required skills)
 * @returns Similarity score from 0.0 to 1.0
 */
export function jaccard(a: string[], b: string[]): number {
  if (!a || !b || (a.length === 0 && b.length === 0)) return 0;
  
  const A = new Set(a.map(s => s.toLowerCase().trim()));
  const B = new Set(b.map(s => s.toLowerCase().trim()));
  
  const intersection = Array.from(A).filter(x => B.has(x)).length;
  const union = new Set(Array.from(A).concat(Array.from(B))).size;
  
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371; // Earth radius in km
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon / 2) ** 2;
  
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Calculate location score using exponential decay
 * Closer distances get higher scores
 * 
 * @param distanceKm - Distance in kilometers
 * @param k - Decay constant (default 20, lower = faster decay)
 * @returns Score from 0.0 to 1.0
 */
export function locationScore(distanceKm: number | null | undefined, k: number = 20): number {
  if (distanceKm == null) return 0.5; // Unknown distance gets neutral score
  return Math.exp(-distanceKm / k);
}

/**
 * Calculate salary alignment score
 * Checks overlap between job salary range and candidate expectations
 * 
 * @param jobMin - Job minimum salary
 * @param jobMax - Job maximum salary
 * @param candMin - Candidate minimum expected salary
 * @param candMax - Candidate maximum expected salary
 * @returns Score from 0.0 to 1.0
 */
export function salaryAlignment(
  jobMin?: number | null,
  jobMax?: number | null,
  candMin?: number | null,
  candMax?: number | null
): number {
  // If job doesn't specify salary, return neutral score
  if (jobMin == null && jobMax == null) return 0.6;
  
  const jMin = jobMin ?? jobMax ?? 0;
  const jMax = jobMax ?? jobMin ?? 0;
  const cMin = candMin ?? 0;
  const cMax = candMax ?? cMin;
  
  // Calculate overlap
  const overlap = Math.max(0, Math.min(jMax, cMax) - Math.max(jMin, cMin));
  const span = Math.max(jMax, cMax) - Math.min(jMin, cMin) || 1;
  
  // Proportional alignment: 0.6 base + 0.4 for full overlap
  return overlap > 0 ? 0.6 + 0.4 * (overlap / span) : 0.1;
}

/**
 * Seniority level ordering for South African market
 */
const SENIORITY_ORDER = [
  "intern",
  "entry",
  "junior", 
  "intermediate",
  "mid",
  "senior",
  "lead",
  "manager",
  "director",
  "executive"
];

/**
 * Calculate seniority alignment score
 * Exact match = 1.0, one level away = 0.7, two levels = 0.4, etc.
 * 
 * @param jobSeniority - Job seniority level
 * @param targetSeniority - Candidate target seniority
 * @returns Score from 0.0 to 1.0
 */
export function seniorityAlignment(
  jobSeniority?: string | null,
  targetSeniority?: string | null
): number {
  if (!jobSeniority || !targetSeniority) return 0.6; // Unknown = neutral
  
  const ji = SENIORITY_ORDER.indexOf(jobSeniority.toLowerCase());
  const ti = SENIORITY_ORDER.indexOf(targetSeniority.toLowerCase());
  
  if (ji < 0 || ti < 0) return 0.6; // Unknown level = neutral
  
  const distance = Math.abs(ji - ti);
  
  if (distance === 0) return 1.0;   // Exact match
  if (distance === 1) return 0.7;   // One level away
  if (distance === 2) return 0.4;   // Two levels away
  return 0.2;                        // More than two levels
}

/**
 * Calculate employment type & work arrangement alignment
 * Checks if job's type/arrangement matches candidate preferences
 * 
 * @param jobEmploymentType - Job employment type
 * @param jobWorkArrangement - Job work arrangement
 * @param candEmploymentTypes - Candidate preferred employment types
 * @param candWorkArrangements - Candidate preferred work arrangements
 * @returns Score from 0.0 to 1.0
 */
export function typeArrangementMatch(
  jobEmploymentType?: string | null,
  jobWorkArrangement?: string | null,
  candEmploymentTypes?: string[],
  candWorkArrangements?: string[]
): number {
  let score = 0;
  let factors = 0;
  
  // Check employment type match
  if (jobEmploymentType && candEmploymentTypes && candEmploymentTypes.length > 0) {
    score += candEmploymentTypes.includes(jobEmploymentType.toLowerCase()) ? 1 : 0;
    factors++;
  }
  
  // Check work arrangement match
  if (jobWorkArrangement && candWorkArrangements && candWorkArrangements.length > 0) {
    score += candWorkArrangements.includes(jobWorkArrangement.toLowerCase()) ? 1 : 0;
    factors++;
  }
  
  // If no preferences specified, return neutral
  if (factors === 0) return 0.7;
  
  return score / factors;
}

/**
 * Calculate recency score
 * Newer posts get higher scores
 * 
 * @param postedAt - When job was posted
 * @param maxAgeDays - Maximum age in days for full score (default 7)
 * @returns Score from 0.0 to 1.0
 */
export function recencyScore(postedAt: Date, maxAgeDays: number = 7): number {
  const now = new Date();
  const ageMs = now.getTime() - postedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays <= maxAgeDays) return 1.0;
  if (ageDays >= 90) return 0.1; // Very old posts
  
  // Linear decay from maxAgeDays to 90 days
  return 1.0 - (ageDays - maxAgeDays) / (90 - maxAgeDays) * 0.9;
}

/**
 * Heuristic scoring parameters
 */
export interface HeuristicFeatures {
  vecSim: number;        // Vector similarity (0-1)
  skillsJac: number;     // Skills Jaccard (0-1)
  titleSim: number;      // Title similarity (0-1)
  distKm?: number;       // Distance in km (optional)
  salaryAlign: number;   // Salary alignment (0-1)
  seniorityAlign: number;// Seniority alignment (0-1)
  typeArrange: number;   // Type/arrangement match (0-1)
  recency: number;       // Recency score (0-1)
}

/**
 * Calculate overall heuristic score (0-100)
 * Combines all factors with weighted importance
 * 
 * Weights:
 * - 35% Vector similarity (semantic CV↔job match)
 * - 15% Skills overlap
 * - 10% Title similarity
 * - 10% Location proximity
 * - 10% Salary alignment
 * - 8%  Seniority match
 * - 7%  Employment type & arrangement
 * - 5%  Posting recency
 * 
 * @param features - All scoring features
 * @returns Score from 0 to 100
 */
export function heuristicScore(features: HeuristicFeatures): number {
  const loc = features.distKm == null ? 0.5 : locationScore(features.distKm);
  
  const score = 100 * (
    0.35 * features.vecSim +
    0.15 * features.skillsJac +
    0.10 * features.titleSim +
    0.10 * loc +
    0.10 * features.salaryAlign +
    0.08 * features.seniorityAlign +
    0.07 * features.typeArrange +
    0.05 * features.recency
  );
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Used for semantic similarity between text embeddings
 * 
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity from 0.0 to 1.0 (or -1.0 to 1.0 for full cosine range)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) return 0;
  
  // Return normalized similarity (0 to 1 instead of -1 to 1)
  const similarity = dotProduct / magnitude;
  return (similarity + 1) / 2;
}
