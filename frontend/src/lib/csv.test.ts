import { describe, expect, it } from 'vitest';
import type { Application } from '../services/applicationsService';
import {
  applicationsToCsvRows,
  coerceImportRow,
  findWithinFileDuplicates,
  guessColumnMapping,
  invertColumnMapping,
  parseImportedDate,
} from './csv';

describe('applicationsToCsvRows', () => {
  it('uses human-readable headers and display labels, not raw enum values', () => {
    const app = {
      company_name: 'Acme',
      job_title: 'Backend Developer',
      status: 'scheduled_for_interview',
      platform_source: 'jobstreet',
      location: null,
      salary_range: null,
      applied_date: '2026-09-01',
      job_link: null,
      notes: null,
      is_archived: true,
      created_at: '2026-08-20T03:00:00.000Z',
      status_changed_at: '2026-08-25T03:00:00.000Z',
    } as unknown as Application;

    const [row] = applicationsToCsvRows([app]);

    expect(row).toEqual({
      Company: 'Acme',
      'Job Title': 'Backend Developer',
      Status: 'Scheduled for Interview',
      Platform: 'JobStreet',
      Location: '',
      'Salary Range': '',
      'Applied Date': '2026-09-01',
      'Job Link': '',
      Notes: '',
      Archived: 'Yes',
      Added: '2026-08-20',
      'Last Status Change': '2026-08-25',
    });
  });
});

describe('guessColumnMapping', () => {
  it('matches common real-world header names, including an Excel BOM on the first column', () => {
    const mapping = guessColumnMapping(['﻿Company', 'Position', 'Date Applied', 'Notes', 'Nonsense']);

    expect(mapping['﻿Company']).toBe('company_name');
    expect(mapping.Position).toBe('job_title');
    expect(mapping['Date Applied']).toBe('applied_date');
    expect(mapping.Notes).toBe('notes');
    expect(mapping.Nonsense).toBeNull();
  });
});

describe('parseImportedDate', () => {
  it('accepts an ISO date as-is', () => {
    expect(parseImportedDate('2026-09-01', 'MDY')).toBe('2026-09-01');
  });

  it('resolves a genuinely ambiguous date using the chosen format', () => {
    expect(parseImportedDate('03/09/2026', 'MDY')).toBe('2026-03-09');
    expect(parseImportedDate('03/09/2026', 'DMY')).toBe('2026-09-03');
  });

  it('uses the only valid reading even when it contradicts the chosen format', () => {
    // Day 25 cannot be a month, so this is unambiguously DMY regardless of
    // the file-level choice.
    expect(parseImportedDate('25/03/2026', 'MDY')).toBe('2026-03-25');
  });

  it('returns null for an unparseable date', () => {
    expect(parseImportedDate('not a date', 'MDY')).toBeNull();
    expect(parseImportedDate('13/13/2026', 'MDY')).toBeNull();
  });
});

describe('coerceImportRow', () => {
  const mapping = guessColumnMapping(['Company', 'Job Title', 'Status', 'Platform', 'Job Link']);
  const fieldToHeader = invertColumnMapping(mapping);

  it('errors when company or job title is missing', () => {
    const result = coerceImportRow(
      { Company: '', 'Job Title': 'Engineer', Status: '', Platform: '', 'Job Link': '' },
      fieldToHeader,
      'MDY'
    );
    expect(result.severity).toBe('error');
    expect(result.messages).toContain('Company is required');
  });

  it('defaults an unrecognized status/platform with a warning rather than erroring', () => {
    const result = coerceImportRow(
      { Company: 'Acme', 'Job Title': 'Engineer', Status: 'Ghosted', Platform: 'Carrier Pigeon', 'Job Link': '' },
      fieldToHeader,
      'MDY'
    );
    expect(result.severity).toBe('warning');
    expect(result.data.status).toBe('pending_application');
    expect(result.data.platform_source).toBe('other');
  });

  it('matches a status/platform label case-insensitively', () => {
    const result = coerceImportRow(
      {
        Company: 'Acme',
        'Job Title': 'Engineer',
        Status: 'scheduled for interview',
        Platform: 'linkedin',
        'Job Link': '',
      },
      fieldToHeader,
      'MDY'
    );
    expect(result.severity).toBe('ok');
    expect(result.data.status).toBe('scheduled_for_interview');
    expect(result.data.platform_source).toBe('linkedin');
  });

  it('auto-prefixes a bare domain job link, same as the form', () => {
    const result = coerceImportRow(
      {
        Company: 'Acme',
        'Job Title': 'Engineer',
        Status: '',
        Platform: '',
        'Job Link': 'www.linkedin.com/jobs/1',
      },
      fieldToHeader,
      'MDY'
    );
    expect(result.data.job_link).toBe('https://www.linkedin.com/jobs/1');
  });
});

describe('findWithinFileDuplicates', () => {
  it('flags every occurrence after the first matching company + job title', () => {
    const flags = findWithinFileDuplicates([
      { company_name: 'Acme', job_title: 'Engineer' },
      { company_name: 'Globex', job_title: 'Analyst' },
      { company_name: 'acme', job_title: ' Engineer ' },
    ]);
    expect(flags).toEqual([false, false, true]);
  });
});

describe('CSV round trip', () => {
  // The highest-value test in the set (docs/08-testing-and-ci.md #9): export
  // writes display labels, import must recognize them and recover the exact
  // same enum values — this is the class of bug where export says "Scheduled
  // for Interview" and import silently defaults it to Pending.
  it('recovers the same status and platform after export then import', () => {
    const app = {
      company_name: 'Acme',
      job_title: 'Backend Developer',
      status: 'scheduled_for_interview',
      platform_source: 'jobstreet',
      location: null,
      salary_range: null,
      applied_date: '2026-09-01',
      job_link: null,
      notes: null,
      is_archived: false,
      created_at: '2026-08-20T03:00:00.000Z',
      status_changed_at: '2026-08-25T03:00:00.000Z',
    } as unknown as Application;

    const [csvRow] = applicationsToCsvRows([app]);
    const headers = Object.keys(csvRow);
    const mapping = guessColumnMapping(headers);
    const fieldToHeader = invertColumnMapping(mapping);

    const result = coerceImportRow(csvRow as unknown as Record<string, string>, fieldToHeader, 'MDY');

    expect(result.severity).toBe('ok');
    expect(result.data.status).toBe(app.status);
    expect(result.data.platform_source).toBe(app.platform_source);
    expect(result.data.applied_date).toBe(app.applied_date);
  });
});
