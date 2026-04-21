export type ParsedExperienceSection = {
  title: string;
  bullets: string[];
  header_lines: string[];
};

const EXPERIENCE_SECTION_HEADERS = new Set([
  "experience",
  "professional experience",
  "work experience",
  "relevant experience",
  "employment history",
  "career history",
]);

const NON_EXPERIENCE_SECTION_HEADERS = new Set([
  "summary",
  "professional summary",
  "projects",
  "project experience",
  "technical skills",
  "skills",
  "education",
  "certifications",
  "awards",
  "publications",
  "leadership",
  "activities",
  "volunteer experience",
  "community involvement",
]);

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeadingText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isBulletLine(line: string): boolean {
  return /^[•●◦▪▸▹►*-]\s*/.test(line.trim());
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[•●◦▪▸▹►*-]\s*/, "").trim();
}

function isExperienceSectionHeader(line: string): boolean {
  const normalized = normalizeHeadingText(line);
  return EXPERIENCE_SECTION_HEADERS.has(normalized);
}

function isNonExperienceSectionHeader(line: string): boolean {
  const normalized = normalizeHeadingText(line);
  return NON_EXPERIENCE_SECTION_HEADERS.has(normalized);
}

function looksLikeDateRange(line: string): boolean {
  const normalized = cleanString(line);
  if (!normalized) {
    return false;
  }

  return /(?:jan|feb|mar|apr|may|jun|july?|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*[–-]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|july?|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})/i.test(normalized) ||
    /(?:jan|feb|mar|apr|may|jun|july?|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}/i.test(normalized);
}

function looksLikeYearRange(line: string): boolean {
  const normalized = cleanString(line);
  if (!normalized) {
    return false;
  }

  return /\b\d{4}\s*[–-]\s*(?:present|current|\d{4})\b/i.test(normalized);
}

function looksLikeLocationLine(line: string): boolean {
  const normalized = cleanString(line);
  if (!normalized) {
    return false;
  }

  return /^(remote|hybrid|onsite)$/i.test(normalized) ||
    /^[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*,\s*[A-Z]{2}$/.test(normalized);
}

function looksLikeCompanyLine(line: string): boolean {
  const normalized = cleanString(line);
  if (!normalized) {
    return false;
  }

  if (
    isBulletLine(normalized) ||
    isExperienceSectionHeader(normalized) ||
    isNonExperienceSectionHeader(normalized) ||
    looksLikeDateRange(normalized) ||
    looksLikeYearRange(normalized) ||
    looksLikeLocationLine(normalized) ||
    /[.!?]$/.test(normalized)
  ) {
    return false;
  }

  return /(?:inc|llc|corp|corporation|company|co\.|school|university|department|dept|hospital|health|business|studio|labs|systems|technologies|tech|group|partners)\b/i.test(
    normalized,
  ) || /^[A-Z][A-Za-z0-9&'()./-]*(?:\s+[A-Z][A-Za-z0-9&'()./-]*){0,6}$/.test(normalized);
}

function stripTrailingDateRange(line: string): string {
  const normalized = cleanString(line).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(
      /\s+(?:jan|feb|mar|apr|may|jun|july?|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*[–-]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|july?|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})$/i,
      "",
    )
    .replace(/\s+\d{4}\s*[–-]\s*(?:present|current|\d{4})$/i, "")
    .trim();
}

function extractExperienceTitle(line: string): string {
  const normalized = cleanString(line);
  if (!normalized) {
    return "";
  }

  if (
    isBulletLine(normalized) ||
    isExperienceSectionHeader(normalized) ||
    isNonExperienceSectionHeader(normalized) ||
    looksLikeLocationLine(normalized)
  ) {
    return "";
  }

  const candidate = stripTrailingDateRange(normalized);
  if (!candidate) {
    return "";
  }

  if (
    candidate.length > 120 ||
    /[.!?]$/.test(candidate) ||
    candidate.includes(",") ||
    !/^[A-Z0-9]/.test(candidate) ||
    /^[([]/.test(candidate)
  ) {
    return "";
  }

  if (looksLikeCompanyLine(candidate) && !looksLikeDateRange(normalized) && !looksLikeYearRange(normalized)) {
    return "";
  }

  return candidate;
}

function looksLikeExperienceTitle(line: string): boolean {
  return Boolean(extractExperienceTitle(line));
}

function looksLikeNewExperienceEntry(lines: string[], startIndex: number): boolean {
  const line = lines[startIndex] ?? "";
  if (!looksLikeExperienceTitle(line)) {
    return false;
  }

  const block: string[] = [line];
  let cursor = startIndex + 1;
  while (cursor < lines.length && block.length < 4) {
    const candidate = lines[cursor];
    if (!candidate || isExperienceSectionHeader(candidate) || isNonExperienceSectionHeader(candidate) || isBulletLine(candidate)) {
      break;
    }
    block.push(candidate);
    cursor += 1;
  }

  const nextBulletLine = lines[startIndex + block.length] ?? "";
  if (!isBulletLine(nextBulletLine)) {
    return false;
  }

  const supportingLines = block.slice(1);
  const hasDateAnchor = looksLikeDateRange(line) || looksLikeYearRange(line) ||
    supportingLines.some((candidate) => looksLikeDateRange(candidate) || looksLikeYearRange(candidate));
  const hasLocationAnchor = supportingLines.some((candidate) => looksLikeLocationLine(candidate));
  const hasCompanyAnchor = supportingLines.some((candidate) => looksLikeCompanyLine(candidate));
  const hasHeaderBlockShape = supportingLines.length >= 2 && supportingLines.some((candidate) => looksLikeExperienceTitle(candidate));

  return hasDateAnchor || hasLocationAnchor || hasCompanyAnchor || hasHeaderBlockShape;
}

export function parseExperienceSections(resumeText: string): ParsedExperienceSection[] {
  const lines = resumeText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const experienceIndex = lines.findIndex((line) => isExperienceSectionHeader(line));
  if (experienceIndex === -1) {
    return [];
  }

  const endIndex = lines.findIndex((line, index) => index > experienceIndex && isNonExperienceSectionHeader(line));
  const slice = lines.slice(experienceIndex + 1, endIndex === -1 ? undefined : endIndex);

  const sections: ParsedExperienceSection[] = [];
  let currentTitle = "";
  let currentBullets: string[] = [];
  let headerLines: string[] = [];

  const flush = () => {
    if (!currentTitle || currentBullets.length === 0) {
      currentTitle = "";
      currentBullets = [];
      headerLines = [];
      return;
    }
    sections.push({
      title: currentTitle,
      bullets: currentBullets,
      header_lines: [...headerLines],
    });
    currentTitle = "";
    currentBullets = [];
    headerLines = [];
  };

  const ensureCurrentTitle = () => {
    if (currentTitle) {
      return;
    }

    const derivedTitle = headerLines.map((line) => extractExperienceTitle(line)).find(Boolean);
    currentTitle = derivedTitle || `Experience ${sections.length + 1}`;
  };

  for (let index = 0; index < slice.length; index += 1) {
    const line = slice[index];
    const isBullet = isBulletLine(line);

    if (isBullet) {
      ensureCurrentTitle();
      currentBullets.push(stripBulletPrefix(line));
      continue;
    }

    if (currentBullets.length > 0) {
      const lastBulletIndex = currentBullets.length - 1;
      const startsNewEntry = looksLikeNewExperienceEntry(slice, index);
      if (lastBulletIndex >= 0 && !startsNewEntry) {
        currentBullets[lastBulletIndex] = `${currentBullets[lastBulletIndex]} ${line}`.replace(/\s+/g, " ").trim();
        continue;
      }

      flush();
      headerLines.push(line);
      continue;
    }

    headerLines.push(line);
  }

  flush();
  return sections;
}

export function buildParserDebug(resumeText: string, sections: ParsedExperienceSection[]) {
  const lines = resumeText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const experienceIndex = lines.findIndex((line) => isExperienceSectionHeader(line));
  const endIndex = lines.findIndex((line, index) => index > experienceIndex && isNonExperienceSectionHeader(line));
  const slice = experienceIndex === -1
    ? []
    : lines.slice(experienceIndex + 1, endIndex === -1 ? undefined : endIndex);

  return {
    experience_header_found: experienceIndex !== -1,
    section_count: sections.length,
    experience_slice_preview: slice.slice(0, 40),
    source_experience_sections: sections.map((section) => ({
      title: section.title,
      bullets: section.bullets,
      header_lines: section.header_lines,
    })),
  };
}
