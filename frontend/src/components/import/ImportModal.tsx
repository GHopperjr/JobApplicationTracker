import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import {
  IMPORT_FIELD_LABELS,
  coerceImportRow,
  findWithinFileDuplicates,
  guessColumnMapping,
  invertColumnMapping,
  type ColumnMapping,
  type DateFormat,
  type ImportField,
  type ImportSeverity,
} from '../../lib/csv';
import { cn } from '../../lib/cn';
import { findPotentialDuplicates, type ApplicationInsert } from '../../services/applicationsService';
import { PartialImportError } from '../../services/errors';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';

const MAX_ROWS = 500;
const MAX_BYTES = 1024 * 1024; // 1MB
const DUPLICATE_CHECK_BATCH = 10;

type RawCsvRow = Record<string, string>;

type ReviewRow = {
  raw: RawCsvRow;
  data: ApplicationInsert;
  severity: ImportSeverity;
  messages: string[];
  isDuplicate: boolean;
  skip: boolean;
};

type Step =
  | { step: 'choose' }
  | { step: 'map'; rows: RawCsvRow[]; headers: string[]; mapping: ColumnMapping }
  | { step: 'review'; mapping: ColumnMapping; rows: ReviewRow[] }
  | { step: 'importing'; toImport: ApplicationInsert[]; progress: number }
  // Reached only on failure — on success the modal just closes (the toast
  // says "Imported N applications", docs/10 Step 4) and `imported` here is
  // always < `toImport.length`, so Retry always has a non-empty remainder.
  | { step: 'result'; toImport: ApplicationInsert[]; imported: number; error?: PartialImportError };

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// en-US (and PH, which follows the same convention) defaults to MM/DD/YYYY;
// almost everywhere else reads DD/MM/YYYY first. Only a starting guess — the
// review step lets the user override it for the whole file.
function guessLocaleDateFormat(): DateFormat {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('en-US') || locale.startsWith('en-PH') ? 'MDY' : 'DMY';
  } catch {
    return 'MDY';
  }
}

const IMPORT_FIELD_OPTIONS: ImportField[] = [
  'company_name',
  'job_title',
  'status',
  'platform_source',
  'location',
  'salary_range',
  'applied_date',
  'job_link',
  'notes',
];

function coerceRows(rows: RawCsvRow[], mapping: ColumnMapping, dateFormat: DateFormat): ReviewRow[] {
  const fieldToHeader = invertColumnMapping(mapping);
  const coerced = rows.map((raw) => ({ raw, ...coerceImportRow(raw, fieldToHeader, dateFormat) }));

  const withinFile = findWithinFileDuplicates(
    coerced.map((r) => ({ company_name: r.data.company_name, job_title: r.data.job_title }))
  );

  return coerced.map((r, i) => ({ ...r, isDuplicate: withinFile[i], skip: withinFile[i] }));
}

// Existing-row duplicates are checked by reusing findPotentialDuplicates,
// batched rather than fired all at once (docs/10-data-import-export.md
// Step 3). Rows that already errored (e.g. missing company) are skipped —
// an empty company would ilike-match everything.
async function checkExistingDuplicates(rows: ReviewRow[]): Promise<ReviewRow[]> {
  const result = [...rows];
  const checkable = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.severity !== 'error');

  for (let i = 0; i < checkable.length; i += DUPLICATE_CHECK_BATCH) {
    const batch = checkable.slice(i, i + DUPLICATE_CHECK_BATCH);
    const matches = await Promise.all(
      batch.map(({ row }) => findPotentialDuplicates(row.data.company_name, row.data.job_title))
    );
    matches.forEach((found, j) => {
      if (found.length === 0) return;
      const { index } = batch[j];
      result[index] = { ...result[index], isDuplicate: true, skip: true };
    });
  }

  return result;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { show } = useToast();
  const { importMany } = useApplicationMutations({
    onImported: (n) => show(`Imported ${n} application${n === 1 ? '' : 's'}.`),
  });

  const [state, setState] = useState<Step>({ step: 'choose' });
  const [fileError, setFileError] = useState<string | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat>(guessLocaleDateFormat());
  const [isChecking, setIsChecking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setState({ step: 'choose' });
    setFileError(null);
    onClose();
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please choose a .csv file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError('That file is too large (max 1MB).');
      return;
    }

    const Papa = await import('papaparse'); // dynamic — costs nothing until Import is opened
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0 || result.data.length === 0) {
          setFileError('That file has no data rows to import.');
          return;
        }
        if (result.data.length > MAX_ROWS) {
          setFileError(`That file has ${result.data.length} rows — the limit is ${MAX_ROWS}.`);
          return;
        }
        setState({ step: 'map', rows: result.data, headers, mapping: guessColumnMapping(headers) });
      },
      error: () => setFileError('Could not read that file. Is it a valid CSV?'),
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const runReview = async (rows: RawCsvRow[], mapping: ColumnMapping) => {
    setIsChecking(true);
    const coerced = coerceRows(rows, mapping, dateFormat);
    const checked = await checkExistingDuplicates(coerced);
    setIsChecking(false);
    setState({ step: 'review', mapping, rows: checked });
  };

  const handleDateFormatChange = async (next: DateFormat) => {
    setDateFormat(next);
    if (state.step !== 'review') return;
    setIsChecking(true);
    const coerced = coerceRows(
      state.rows.map((r) => r.raw),
      state.mapping,
      next
    );
    const checked = await checkExistingDuplicates(coerced);
    setIsChecking(false);
    setState({ step: 'review', mapping: state.mapping, rows: checked });
  };

  const toggleSkip = (index: number) => {
    if (state.step !== 'review') return;
    const rows = state.rows.map((r, i) => (i === index ? { ...r, skip: !r.skip } : r));
    setState({ ...state, rows });
  };

  // On success the modal just closes — `useApplicationMutations`' own
  // onSuccess already fired the "Imported N applications." toast, so there
  // is nothing left for this callback to do (docs/10 Step 4). On failure,
  // the modal stays open with an honest "imported N of M" and a retry.
  const startImport = (toImport: ApplicationInsert[]) => {
    setState({ step: 'importing', toImport, progress: 0 });
    importMany
      .mutateAsync({
        rows: toImport,
        onProgress: (imported, total) => {
          setState((prev) =>
            prev.step === 'importing' ? { ...prev, progress: imported / total } : prev
          );
        },
      })
      .then(handleClose)
      .catch((err) => {
        if (err instanceof PartialImportError) {
          setState({ step: 'result', toImport, imported: err.importedCount, error: err });
        } else {
          setState({ step: 'result', toImport, imported: 0 });
        }
      });
  };

  const handleImportClick = () => {
    if (state.step !== 'review') return;
    const toImport = state.rows.filter((r) => r.severity !== 'error' && !r.skip).map((r) => r.data);
    startImport(toImport);
  };

  // Sequential chunks mean the first `imported` rows of `toImport` are
  // exactly the ones already committed — retrying only the remainder is
  // what makes "the duplicate check will skip anything already imported"
  // true without re-querying anything (docs/10 Step 4).
  const handleRetry = () => {
    if (state.step !== 'result') return;
    startImport(state.toImport.slice(state.imported));
  };

  const title =
    state.step === 'choose'
      ? 'Import applications'
      : state.step === 'map'
        ? 'Map columns'
        : state.step === 'review'
          ? 'Review and fix'
          : state.step === 'importing'
            ? 'Importing…'
            : 'Import incomplete';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} closeOnBackdrop={state.step !== 'importing'}>
      {state.step === 'choose' && (
        <ChooseStep
          isDragging={isDragging}
          fileError={fileError}
          fileInputRef={fileInputRef}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onFileInputChange={onFileInputChange}
        />
      )}

      {state.step === 'map' && (
        <MapStep
          headers={state.headers}
          mapping={state.mapping}
          onChangeMapping={(mapping) => setState({ ...state, mapping })}
          onBack={() => setState({ step: 'choose' })}
          onContinue={() => void runReview(state.rows, state.mapping)}
          isChecking={isChecking}
        />
      )}

      {state.step === 'review' && (
        <ReviewStep
          rows={state.rows}
          mapping={state.mapping}
          dateFormat={dateFormat}
          onChangeDateFormat={(f) => void handleDateFormatChange(f)}
          onToggleSkip={toggleSkip}
          onBack={() => setState({ step: 'map', rows: state.rows.map((r) => r.raw), headers: Object.keys(state.mapping), mapping: state.mapping })}
          onImport={handleImportClick}
          isChecking={isChecking}
        />
      )}

      {state.step === 'importing' && <ImportingStep progress={state.progress} count={state.toImport.length} />}

      {state.step === 'result' && (
        <ResultStep
          imported={state.imported}
          total={state.toImport.length}
          onClose={handleClose}
          onRetry={handleRetry}
        />
      )}
    </Modal>
  );
}

function ChooseStep({
  isDragging,
  fileError,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
}: {
  isDragging: boolean;
  fileError: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-10 text-center text-sm transition-colors duration-100',
          isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
        )}
      >
        <p className="font-medium text-slate-700">Drop a CSV file here, or click to browse</p>
        <p className="text-xs text-slate-500">Max 500 rows, 1MB.</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onFileInputChange}
      />
      {fileError && (
        <p role="alert" className="mt-3 text-xs text-rose-600">
          {fileError}
        </p>
      )}
    </div>
  );
}

function MapStep({
  headers,
  mapping,
  onChangeMapping,
  onBack,
  onContinue,
  isChecking,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onChangeMapping: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
  isChecking: boolean;
}) {
  const mappedFields = new Set(Object.values(mapping));
  const canContinue = mappedFields.has('company_name') && mappedFields.has('job_title');

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        Match each column from your file to a field. Company and Job Title are required.
      </p>
      <div className="space-y-2">
        {headers.map((header) => (
          <div key={header} className="flex items-center gap-3">
            <span className="w-1/2 truncate text-sm text-slate-700" title={header}>
              {header}
            </span>
            <Select
              label=""
              aria-label={`Field for column ${header}`}
              value={mapping[header] ?? ''}
              onChange={(e) =>
                onChangeMapping({
                  ...mapping,
                  [header]: (e.target.value || null) as ImportField | null,
                })
              }
              className="!py-1.5"
            >
              <option value="">Don't import</option>
              {IMPORT_FIELD_OPTIONS.map((field) => (
                <option key={field} value={field}>
                  {IMPORT_FIELD_LABELS[field]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      {!canContinue && (
        <p className="mt-3 text-xs text-amber-700">Map both Company and Job Title to continue.</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!canContinue} isLoading={isChecking}>
          Continue
        </Button>
      </div>
    </div>
  );
}

const SEVERITY_ICON: Record<ImportSeverity, string> = { ok: '✓', warning: '⚠', error: '✕' };
const SEVERITY_COLOR: Record<ImportSeverity, string> = {
  ok: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-rose-600',
};

function ReviewStep({
  rows,
  mapping,
  dateFormat,
  onChangeDateFormat,
  onToggleSkip,
  onBack,
  onImport,
  isChecking,
}: {
  rows: ReviewRow[];
  mapping: ColumnMapping;
  dateFormat: DateFormat;
  onChangeDateFormat: (f: DateFormat) => void;
  onToggleSkip: (index: number) => void;
  onBack: () => void;
  onImport: () => void;
  isChecking: boolean;
}) {
  const errorCount = rows.filter((r) => r.severity === 'error').length;
  const warningCount = rows.filter((r) => r.severity === 'warning' && !r.isDuplicate).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const importCount = rows.filter((r) => r.severity !== 'error' && !r.skip).length;
  const hasDateColumn = Object.values(mapping).includes('applied_date');

  return (
    <div>
      {hasDateColumn && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Dates in this file are:</span>
          <select
            value={dateFormat}
            onChange={(e) => onChangeDateFormat(e.target.value as DateFormat)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            <option value="MDY">MM/DD/YYYY</option>
            <option value="DMY">DD/MM/YYYY</option>
          </select>
        </div>
      )}

      <p className="mb-2 text-xs font-medium text-slate-600">
        {rows.length} rows · {errorCount} error{errorCount === 1 ? '' : 's'} · {warningCount} warning
        {warningCount === 1 ? '' : 's'} · {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} skipped
      </p>

      <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-xs">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className={cn('w-6 px-2 py-1.5 text-center', SEVERITY_COLOR[row.isDuplicate ? 'warning' : row.severity])}>
                  {row.isDuplicate ? '⊘' : SEVERITY_ICON[row.severity]}
                </td>
                <td className="px-2 py-1.5 text-slate-800">{row.data.company_name || '(missing)'}</td>
                <td className="px-2 py-1.5 text-slate-800">{row.data.job_title}</td>
                <td className="px-2 py-1.5 text-slate-500">{row.messages.join('; ')}</td>
                <td className="px-2 py-1.5 text-right">
                  {row.isDuplicate && (
                    <label className="inline-flex items-center gap-1 text-slate-600">
                      <input type="checkbox" checked={row.skip} onChange={() => onToggleSkip(i)} />
                      Skip
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onImport}
          disabled={importCount === 0}
          isLoading={isChecking}
        >
          {importCount === 0 ? 'Nothing to import' : `Import ${importCount} application${importCount === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}

function ImportingStep({ progress, count }: { progress: number; count: number }) {
  return (
    <div className="py-4">
      <p className="mb-2 text-sm text-slate-600">Importing {count} applications…</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-150"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ResultStep({
  imported,
  total,
  onClose,
  onRetry,
}: {
  imported: number;
  total: number;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">
        Imported {imported} of {total} applications.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Something went wrong partway through. The first {imported} were saved. You can retry the
        rest — the duplicate check will skip anything already imported.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onRetry}>
          Retry remaining
        </Button>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
