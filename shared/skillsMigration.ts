/**
 * Migration utilities for converting old skills format to new format
 */

// Old skills format from the complex schema
interface OldSkillsFormat {
  softSkills?: Array<{
    category: string;
    items: string[];
  }>;
  technicalSkills?: Array<{
    category: string;
    items: string[];
  }>;
  languages?: string[];
}

// New skills format is just an array of strings
type NewSkillsFormat = string[];

/**
 * Detects if the skills data is in the old format
 */
export function isOldSkillsFormat(skills: any): skills is OldSkillsFormat {
  if (!skills || typeof skills !== 'object') return false;
  return (
    'softSkills' in skills ||
    'technicalSkills' in skills ||
    'languages' in skills
  );
}

/**
 * Migrates old skills format to new array format
 * Flattens all skills from softSkills, technicalSkills, and languages into a single array
 */
export function migrateSkillsToNewFormat(skills: OldSkillsFormat | NewSkillsFormat): NewSkillsFormat {
  // If it's already in the new format (array), return as-is
  if (Array.isArray(skills)) {
    return skills;
  }

  // If it's in the old format, migrate it
  if (isOldSkillsFormat(skills)) {
    const allSkills: string[] = [];

    // Extract skills from softSkills
    if (skills.softSkills) {
      for (const category of skills.softSkills) {
        if (category.items) {
          allSkills.push(...category.items);
        }
      }
    }

    // Extract skills from technicalSkills
    if (skills.technicalSkills) {
      for (const category of skills.technicalSkills) {
        if (category.items) {
          allSkills.push(...category.items);
        }
      }
    }

    // Extract languages
    if (skills.languages) {
      allSkills.push(...skills.languages);
    }

    // Remove duplicates and limit to 10 skills
    const uniqueSkills = Array.from(new Set(allSkills.filter(s => s.trim())));
    return uniqueSkills.slice(0, 10);
  }

  // Fallback to empty array for invalid data
  return [];
}
