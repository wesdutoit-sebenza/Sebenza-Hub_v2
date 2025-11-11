import { db } from "./db";
import { cvs, jobs, competencyTests } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Generates a random alphanumeric code (uppercase letters and numbers only)
 * @param length Number of characters to generate
 * @returns Random alphanumeric string
 */
function generateAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a unique CV reference number in format: CV-XXXXXX
 * Checks database to ensure uniqueness
 */
export async function generateUniqueCVReference(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateAlphanumeric(6);
    const referenceNumber = `CV-${code}`;

    // Check if this reference already exists
    const existing = await db
      .select()
      .from(cvs)
      .where(eq(cvs.referenceNumber, referenceNumber))
      .limit(1);

    if (existing.length === 0) {
      return referenceNumber;
    }

    attempts++;
  }

  // Fallback with timestamp if we couldn't generate unique in 10 tries
  const timestamp = Date.now().toString(36).toUpperCase();
  return `CV-${timestamp}`;
}

/**
 * Generates a unique Job reference number in format: JOB-XXXXXX
 * Checks database to ensure uniqueness
 */
export async function generateUniqueJobReference(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateAlphanumeric(6);
    const referenceNumber = `JOB-${code}`;

    // Check if this reference already exists
    const existing = await db
      .select()
      .from(jobs)
      .where(eq(jobs.referenceNumber, referenceNumber))
      .limit(1);

    if (existing.length === 0) {
      return referenceNumber;
    }

    attempts++;
  }

  // Fallback with timestamp if we couldn't generate unique in 10 tries
  const timestamp = Date.now().toString(36).toUpperCase();
  return `JOB-${timestamp}`;
}

/**
 * Generates a unique Test reference number in format: TEST-XXXXXX
 * Checks database to ensure uniqueness
 */
export async function generateUniqueTestReference(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateAlphanumeric(6);
    const referenceNumber = `TEST-${code}`;

    // Check if this reference already exists
    const existing = await db
      .select()
      .from(competencyTests)
      .where(eq(competencyTests.referenceNumber, referenceNumber))
      .limit(1);

    if (existing.length === 0) {
      return referenceNumber;
    }

    attempts++;
  }

  // Fallback with timestamp if we couldn't generate unique in 10 tries
  const timestamp = Date.now().toString(36).toUpperCase();
  return `TEST-${timestamp}`;
}
