import { PLATFORM_LABELS, PLATFORM_VALUES, type PlatformSource } from '../constants/platforms';
import { STATUS_LABELS, STATUS_VALUES, type ApplicationStatus } from '../constants/status';
import type { Application, ApplicationInsert } from '../services/applicationsService';
import { HTTP_URL_PATTERN, autoPrefixUrl } from './url';

// ---------------------------------------------------------------------------
// Export (docs/10-data-import-export.md, Part 1)
// ---------------------------------------------------------------------------

export function applicationsToCsvRows(applications: Application[]) {
  return applications.map((a) => ({
    Company: a.company_name,
    'Job Title': a.job_title,
    Status: STATUS_LABELS[a.status],
    Platform: PLATFORM_LABELS[a.platform_source],
    Location: a.location ?? '',
    'Salary Range': a.salary_range ?? '',
    'Applied Date': a.applied_date ?? '',
    'Job Link': a.job_link ?? '',
    Notes: a.notes ?? '',
    Archived: a.is_archived ? 'Yes' : 'No',
    Added: a.created_at.slice(0, 10),
    'Last Status Change': a.status_changed_at.slice(0, 10),
  }));
}

export function exportFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `job-applications-${y}-${m}-${day}.csv`;
}

export async function downloadCsv(applications: Application[], filename: string): Promise<void> {
  const { unparse } = await import('papaparse'); // lazy — costs nothing to users who never export/import
  const csv = unparse(applicationsToCsvRows(applications));

  // The BOM makes Excel open UTF-8 correctly. Without it, a non-ASCII
  // company name (e.g. "Peso ₱25,000") renders as mojibake — the most common
  // complaint about CSV exports opened on Windows.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import — column mapping (docs/10 Part 2, Step 2)
// ---------------------------------------------------------------------------

export type ImportField =
  | 'company_name'
  | 'job_title'
  | 'status'
  | 'platform_source'
  | 'location'
  | 'salary_range'
  | 'applied_date'
  | 'job_link'
  | 'notes';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  company_name: 'Company',
  job_title: 'Job Title',
  status: 'Status',
  platform_source: 'Platform',
  location: 'Location',
  salary_range: 'Salary Range',
  applied_date: 'Applied Date',
  job_link: 'Job Link',
  notes: 'Notes',
};

/** CSV header -> our field, or null for "Don't import". */
export type ColumnMapping = Record<string, ImportField | null>;

// Deliberately generous: these are the names real spreadsheets actually use.
const HEADER_ALIASES: Record<string, ImportField> = {
  company: 'company_name',
  companyname: 'company_name',
  employer: 'company_name',
  organization: 'company_name',
  organisation: 'company_name',

  jobtitle: 'job_title',
  title: 'job_title',
  position: 'job_title',
  role: 'job_title',

  status: 'status',
  stage: 'status',

  platform: 'platform_source',
  source: 'platform_source',
  jobboard: 'platform_source',
  via: 'platform_source',
  website: 'platform_source',

  location: 'location',
  city: 'location',
  place: 'location',

  salary: 'salary_range',
  salaryrange: 'salary_range',
  pay: 'salary_range',
  compensation: 'salary_range',

  applieddate: 'applied_date',
  dateapplied: 'applied_date',
  date: 'applied_date',
  applied: 'applied_date',

  joblink: 'job_link',
  link: 'job_link',
  url: 'job_link',
  joburl: 'job_link',
  posting: 'job_link',

  notes: 'notes',
  comments: 'notes',
  remarks: 'notes',
};

// Strips Excel's leading BOM (without it the first header never matches an
// alias, which presents as "why is Company the only column it missed?"),
// lowercases, and drops separators so "Job Title" / "job_title" / "JOBTITLE"
// all normalize identically. Reused below to match status/platform label
// strings too, ignoring the same spacing/casing noise.
const BOM = /^\uFEFF/;

export function normalizeHeader(value: string): string {
  return value
    .replace(BOM, '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    mapping[header] = HEADER_ALIASES[normalizeHeader(header)] ?? null;
  }
  return mapping;
}

/** CSV header per our field, the shape `coerceImportRow` actually reads by. */
export type FieldToHeader = Partial<Record<ImportField, string>>;

export function invertColumnMapping(mapping: ColumnMapping): FieldToHeader {
  const inverted: FieldToHeader = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field) inverted[field] = header;
  }
  return inverted;
}

// ---------------------------------------------------------------------------
// Import — value coercion (docs/10 Part 2, Step 3)
// ---------------------------------------------------------------------------

export type DateFormat = 'MDY' | 'DMY';

function buildLabelLookup<T extends string>(
  values: readonly T[],
  labels: Record<T, string>
): Map<string, T> {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(normalizeHeader(value), value);
    map.set(normalizeHeader(labels[value]), value);
  }
  return map;
}

const STATUS_LOOKUP = buildLabelLookup<ApplicationStatus>(STATUS_VALUES, STATUS_LABELS);
const PLATFORM_LOOKUP = buildLabelLookup<PlatformSource>(PLATFORM_VALUES, PLATFORM_LABELS);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isValidYmd(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Accepts YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY. `dateFormat` resolves the
 * genuinely ambiguous case (both parts <= 12); when only one reading is a
 * valid calendar date, that reading wins regardless of the chosen format —
 * e.g. "25/03/2026" is unambiguously DMY even if the file-level choice is MDY.
 */
export function parseImportedDate(value: string, dateFormat: DateFormat): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = ISO_DATE.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidYmd(year, month, day) ? trimmed : null;
  }

  const slash = SLASH_DATE.exec(trimmed);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3]);

    const [preferredMonth, preferredDay] = dateFormat === 'MDY' ? [first, second] : [second, first];
    if (isValidYmd(year, preferredMonth, preferredDay)) {
      return toIsoDate(year, preferredMonth, preferredDay);
    }

    const [altMonth, altDay] = dateFormat === 'MDY' ? [second, first] : [first, second];
    return isValidYmd(year, altMonth, altDay) ? toIsoDate(year, altMonth, altDay) : null;
  }

  return null;
}

export type ImportSeverity = 'ok' | 'warning' | 'error';

export type ParsedImportRow = {
  data: ApplicationInsert;
  severity: ImportSeverity;
  messages: string[];
};

/**
 * Applies `fieldToHeader` to one raw CSV row and coerces every value per the
 * docs/10 value-coercion table. Only a missing company or job title is an
 * error (blocks the row); everything else degrades to a sensible default
 * with a warning — refusing an entire import over one unrecognized platform
 * string would be user-hostile.
 */
export function coerceImportRow(
  raw: Record<string, string>,
  fieldToHeader: FieldToHeader,
  dateFormat: DateFormat
): ParsedImportRow {
  const messages: string[] = [];
  let severity: ImportSeverity = 'ok';
  const warn = (message: string) => {
    messages.push(message);
    if (severity === 'ok') severity = 'warning';
  };

  const fieldValue = (field: ImportField): string => {
    const header = fieldToHeader[field];
    return header ? (raw[header] ?? '').trim() : '';
  };

  const companyName = fieldValue('company_name');
  const jobTitle = fieldValue('job_title');
  if (!companyName) {
    messages.push('Company is required');
    severity = 'error';
  }
  if (!jobTitle) {
    messages.push('Job title is required');
    severity = 'error';
  }

  const statusRaw = fieldValue('status');
  const status = statusRaw ? STATUS_LOOKUP.get(normalizeHeader(statusRaw)) : undefined;
  if (statusRaw && !status) warn(`Unknown status "${statusRaw}" — defaulted to Pending Application`);
  else if (!statusRaw) warn('No status given — defaulted to Pending Application');

  const platformRaw = fieldValue('platform_source');
  const platform = platformRaw ? PLATFORM_LOOKUP.get(normalizeHeader(platformRaw)) : undefined;
  if (platformRaw && !platform) warn(`Unknown platform "${platformRaw}" — defaulted to Other`);
  else if (!platformRaw) warn('No platform given — defaulted to Other');

  const dateRaw = fieldValue('applied_date');
  const appliedDate = dateRaw ? parseImportedDate(dateRaw, dateFormat) : null;
  if (dateRaw && !appliedDate) warn(`Unrecognized date "${dateRaw}" — left blank`);

  const linkRaw = fieldValue('job_link');
  const prefixedLink = linkRaw ? autoPrefixUrl(linkRaw) : '';
  const isValidLink = HTTP_URL_PATTERN.test(prefixedLink);
  if (linkRaw && !isValidLink) warn(`Invalid job link "${linkRaw}" — left blank`);

  const data: ApplicationInsert = {
    company_name: companyName,
    job_title: jobTitle,
    status: status ?? 'pending_application',
    platform_source: platform ?? 'other',
    location: fieldValue('location') || null,
    salary_range: fieldValue('salary_range') || null,
    applied_date: appliedDate,
    job_link: isValidLink ? prefixedLink : null,
    notes: fieldValue('notes') || null,
  };

  return { data, severity, messages };
}

/**
 * Rows sharing the same company + job title (case-insensitive, trimmed) are
 * duplicates of each other within the file. The first occurrence is treated
 * as the original; every later occurrence is flagged — mirroring how an
 * existing-row duplicate is flagged (docs/10 Step 3).
 */
export function findWithinFileDuplicates(
  rows: { company_name: string; job_title: string }[]
): boolean[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const key = `${row.company_name.trim().toLowerCase()}|${row.job_title.trim().toLowerCase()}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}
