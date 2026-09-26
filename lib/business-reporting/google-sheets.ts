import type { D1Database } from "@cloudflare/workers-types";
import { authenticatedGoogleRequest, GoogleDriveError, type DriveRuntimeConfig } from "../google-drive";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const WORKBOOK_TITLE = "NaTarot Business Control Center";
const WORKBOOK_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const WORKBOOK_APP_PROPERTY = "natarotPurpose";
const WORKBOOK_APP_PROPERTY_VALUE = "business-control-center-v1";
const COLUMN_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type ReportingOwner = {
  memberId: string;
  googleSubject: string;
  googleEmail: string;
};

export type ReportingRequestInput = {
  database: D1Database;
  config: DriveRuntimeConfig;
  memberId: string;
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
};

export type ReportingRequest = (input: ReportingRequestInput) => Promise<Response>;

export class BusinessReportingGoogleError extends Error {
  constructor(
    readonly code: "google_unavailable" | "google_authorization" | "google_rejected" | "google_not_found" | "google_workbook_ambiguous",
  ) {
    const message = code === "google_unavailable"
      ? "Google reporting service is temporarily unavailable."
      : code === "google_authorization"
        ? "Google reporting authorization is unavailable."
        : code === "google_not_found"
          ? "The NaTarot reporting workbook could not be found."
          : code === "google_workbook_ambiguous"
            ? "More than one NaTarot reporting workbook was found."
            : "Google rejected the reporting request.";
    super(message);
    this.name = "BusinessReportingGoogleError";
  }
}

export type GoogleRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  allowNotFound?: boolean;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(response: Response, now: number): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

function retryDelay(attempt: number, options: Required<Pick<GoogleRetryOptions, "baseDelayMs" | "maxDelayMs" | "random">>): number {
  const jitter = Math.max(0, Math.min(1, options.random()));
  const delay = options.baseDelayMs * 2 ** Math.max(0, attempt - 1) * (1 + jitter * 0.2);
  return Math.min(options.maxDelayMs, Math.round(delay));
}

function errorForResponse(response: Response): BusinessReportingGoogleError {
  if (response.status === 401 || response.status === 403) return new BusinessReportingGoogleError("google_authorization");
  return new BusinessReportingGoogleError("google_rejected");
}

export async function googleFetchWithRetry(
  request: () => Promise<Response>,
  input: GoogleRetryOptions = {},
): Promise<Response> {
  const maxAttempts = Math.max(1, Math.floor(input.maxAttempts ?? 5));
  const baseDelayMs = Math.max(0, input.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, input.maxDelayMs ?? 30_000);
  const sleep = input.sleep ?? wait;
  const random = input.random ?? Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await request();
    } catch (error) {
      if (error instanceof BusinessReportingGoogleError) throw error;
      if (error instanceof GoogleDriveError && error.code === "not_connected") {
        throw new BusinessReportingGoogleError("google_authorization");
      }
      if (attempt === maxAttempts) throw new BusinessReportingGoogleError("google_unavailable");
      await sleep(retryDelay(attempt, { baseDelayMs, maxDelayMs, random }));
      continue;
    }

    if (response.ok) return response;
    if (response.status === 404 && input.allowNotFound) return response;

    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (!retryable) throw errorForResponse(response);
    if (attempt === maxAttempts) throw new BusinessReportingGoogleError("google_unavailable");

    const retryAfter = response.status === 429 ? retryAfterMilliseconds(response, Date.now()) : null;
    await sleep(retryAfter === null ? retryDelay(attempt, { baseDelayMs, maxDelayMs, random }) : Math.min(maxDelayMs, Math.round(retryAfter)));
  }
  throw new BusinessReportingGoogleError("google_unavailable");
}

export const BUSINESS_REPORT_SHEETS = [
  {
    name: "Dashboard",
    headers: ["Metric", "Value", "Currency", "Time zone", "As of"],
  },
  {
    name: "Customers",
    headers: ["Opaque customer ID", "Registration date", "Account status", "Last recorded activity", "Total verified purchases", "Total verified spending (VND)", "Affiliate participation status"],
  },
  {
    name: "Revenue",
    headers: ["Reporting date", "Verified revenue (VND)", "Successful orders", "Refunds (VND)", "Net revenue (VND)", "New paying customers"],
  },
  {
    name: "Affiliate",
    headers: ["Opaque affiliate ID", "Referral count", "Verified conversions", "Commission tier", "Currency", "Eligible commission", "Pending commission", "Reversed commission"],
  },
  {
    name: "Referrals",
    headers: ["Opaque referrer ID", "Opaque referred customer ID", "Attribution timestamp", "Attribution status", "Verified conversion status"],
  },
  {
    name: "Activity",
    headers: ["Date", "Registered users", "Active users", "New users", "Tarot readings", "Returning users"],
  },
  {
    name: "Credits",
    headers: ["Date", "Credits sold", "Credits consumed", "Credits expired", "Credits refunded"],
  },
  {
    name: "System",
    headers: ["Metric", "Value", "Status", "As of"],
  },
] as const;

export type BusinessReportTabName = typeof BUSINESS_REPORT_SHEETS[number]["name"];

type SpreadsheetSheet = { properties?: { sheetId?: number; title?: string; index?: number } };
type SpreadsheetPayload = { spreadsheetId?: string; sheets?: SpreadsheetSheet[] };
type DriveFile = { id?: string; name?: string; mimeType?: string; appProperties?: Record<string, string> };

type GoogleRequestContext = {
  database: D1Database;
  config: DriveRuntimeConfig;
  owner: ReportingOwner;
  request?: ReportingRequest;
  retry?: GoogleRetryOptions;
};

async function callApi(
  context: GoogleRequestContext,
  url: string,
  init: { method?: string; headers?: HeadersInit; body?: BodyInit | null } = {},
  retry: GoogleRetryOptions = {},
): Promise<Response> {
  const request = context.request ?? authenticatedGoogleRequest;
  return googleFetchWithRetry(
    () => request({ database: context.database, config: context.config, memberId: context.owner.memberId, url, ...init }),
    { ...context.retry, ...retry },
  );
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new BusinessReportingGoogleError("google_rejected");
  }
}

function workbookSearchUrl(pageToken?: string): string {
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("q", "appProperties has { key='" + WORKBOOK_APP_PROPERTY + "' and value='" + WORKBOOK_APP_PROPERTY_VALUE + "' } and trashed=false");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,appProperties)");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url.toString();
}

async function findManagedWorkbook(context: GoogleRequestContext): Promise<DriveFile | null> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const response = await callApi(context, workbookSearchUrl(pageToken));
    const payload = await readJson<{ files?: DriveFile[]; nextPageToken?: string; incompleteSearch?: boolean }>(response);
    if (payload.incompleteSearch === true) throw new BusinessReportingGoogleError("google_unavailable");
    files.push(...(Array.isArray(payload.files) ? payload.files : []));
    pageToken = typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined;
  } while (pageToken);

  if (files.length > 1) throw new BusinessReportingGoogleError("google_workbook_ambiguous");
  const file = files[0];
  if (!file) return null;
  if (file.appProperties?.[WORKBOOK_APP_PROPERTY] !== WORKBOOK_APP_PROPERTY_VALUE
    || file.mimeType !== WORKBOOK_MIME_TYPE
    || file.name !== WORKBOOK_TITLE
    || typeof file.id !== "string"
    || !file.id) {
    throw new BusinessReportingGoogleError("google_workbook_ambiguous");
  }
  return file;
}

async function createManagedWorkbook(context: GoogleRequestContext): Promise<string> {
  try {
    const response = await callApi(context, DRIVE_FILES_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: WORKBOOK_TITLE,
        mimeType: WORKBOOK_MIME_TYPE,
        appProperties: { [WORKBOOK_APP_PROPERTY]: WORKBOOK_APP_PROPERTY_VALUE },
      }),
    }, { maxAttempts: 1 });
    const payload = await readJson<DriveFile>(response);
    if (typeof payload.id !== "string" || !payload.id || payload.mimeType !== WORKBOOK_MIME_TYPE) {
      throw new BusinessReportingGoogleError("google_rejected");
    }
    return payload.id;
  } catch (error) {
    if (!(error instanceof BusinessReportingGoogleError) || error.code !== "google_unavailable") throw error;
    const recovered = await findManagedWorkbook(context);
    if (recovered?.id) return recovered.id;
    throw error;
  }
}

async function getSpreadsheet(context: GoogleRequestContext, spreadsheetId: string, allowNotFound = false): Promise<{ response: Response; payload: SpreadsheetPayload | null }> {
  const url = new URL(SHEETS_URL + "/" + encodeURIComponent(spreadsheetId));
  url.searchParams.set("fields", "spreadsheetId,sheets.properties(sheetId,title,index)");
  const response = await callApi(context, url.toString(), {}, { allowNotFound });
  return { response, payload: response.status === 404 ? null : await readJson<SpreadsheetPayload>(response) };
}

function sheetTitleList(payload: SpreadsheetPayload | null): string[] {
  return Array.isArray(payload?.sheets)
    ? payload.sheets.map((sheet) => sheet.properties?.title).filter((title): title is string => typeof title === "string")
    : [];
}

function sheetId(sheet: SpreadsheetSheet): number | null {
  const value = sheet.properties?.sheetId;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

async function ensureExactTabs(context: GoogleRequestContext, spreadsheetId: string, initial: SpreadsheetPayload | null): Promise<string[]> {
  if (!initial || !Array.isArray(initial.sheets)) throw new BusinessReportingGoogleError("google_rejected");
  const expected = BUSINESS_REPORT_SHEETS.map((tab) => tab.name);
  const existing = initial.sheets;
  const seen = new Set<string>();
  const requests: Record<string, unknown>[] = [];
  for (const [index, name] of expected.entries()) {
    if (seen.has(name)) throw new BusinessReportingGoogleError("google_rejected");
    seen.add(name);
    if (!existing.some((sheet) => sheet.properties?.title === name)) {
      requests.push({
        addSheet: {
          properties: {
            title: name,
            index,
            gridProperties: {
              rowCount: 100_000,
              columnCount: Math.max(...BUSINESS_REPORT_SHEETS.map((tab) => tab.headers.length)),
            },
          },
        },
      });
    }
  }
  const named = new Set<string>(expected);
  for (const sheet of existing) {
    const title = sheet.properties?.title;
    const id = sheetId(sheet);
    if (typeof title !== "string" || id === null) throw new BusinessReportingGoogleError("google_rejected");
    if (!named.has(title)) requests.push({ deleteSheet: { sheetId: id } });
  }
  const indexByTitle = new Map<string, number>(expected.map((name, index) => [name, index]));
  for (const sheet of existing) {
    const title = sheet.properties?.title;
    const id = sheetId(sheet);
    if (!title || id === null || !named.has(title)) continue;
    if (sheet.properties?.index !== indexByTitle.get(title)) {
      requests.push({ updateSheetProperties: { properties: { sheetId: id, index: indexByTitle.get(title) }, fields: "index" } });
    }
  }
  if (requests.length) {
    const url = SHEETS_URL + "/" + encodeURIComponent(spreadsheetId) + ":batchUpdate";
    await callApi(context, url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    });
  }
  const refreshed = await getSpreadsheet(context, spreadsheetId);
  const tabs = sheetTitleList(refreshed.payload);
  if (tabs.length !== expected.length || expected.some((name, index) => tabs[index] !== name)) {
    throw new BusinessReportingGoogleError("google_rejected");
  }
  return tabs;
}

function columnName(count: number): string {
  let value = count;
  let output = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

async function writeHeaders(context: GoogleRequestContext, spreadsheetId: string): Promise<void> {
  const data = BUSINESS_REPORT_SHEETS.map((tab) => ({
    range: tab.name + "!A1:" + columnName(tab.headers.length) + "1",
    values: [tab.headers],
  }));
  const url = new URL(SHEETS_URL + "/" + encodeURIComponent(spreadsheetId) + "/values:batchUpdate");
  url.searchParams.set("valueInputOption", "RAW");
  await callApi(context, url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

export async function ensureBusinessSpreadsheet(input: {
  database: D1Database;
  owner: ReportingOwner;
  config: DriveRuntimeConfig;
  request?: ReportingRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}): Promise<{ spreadsheetId: string; tabs: string[] }> {
  const context: GoogleRequestContext = {
    database: input.database,
    owner: input.owner,
    config: input.config,
    request: input.request,
    retry: { sleep: input.sleep, random: input.random },
  };
  const state = await input.database.prepare("SELECT spreadsheet_id AS spreadsheetId FROM business_reporting_sync_state WHERE id='primary'").first<{ spreadsheetId: string | null }>();
  let spreadsheetId = state?.spreadsheetId ?? null;
  let spreadsheet: { response: Response; payload: SpreadsheetPayload | null } | null = null;

  if (spreadsheetId) {
    spreadsheet = await getSpreadsheet(context, spreadsheetId, true);
    if (spreadsheet.response.status === 404) {
      await input.database.prepare("UPDATE business_reporting_sync_state SET spreadsheet_id=NULL WHERE id='primary' AND spreadsheet_id=?").bind(spreadsheetId).run();
      spreadsheetId = null;
      spreadsheet = null;
    }
  }

  if (!spreadsheetId) {
    const managed = await findManagedWorkbook(context);
    spreadsheetId = managed?.id ?? await createManagedWorkbook(context);
    await input.database.prepare("UPDATE business_reporting_sync_state SET spreadsheet_id=? WHERE id='primary' AND (spreadsheet_id IS NULL OR spreadsheet_id=?)")
      .bind(spreadsheetId, spreadsheetId).run();
    const stored = await input.database.prepare("SELECT spreadsheet_id AS spreadsheetId FROM business_reporting_sync_state WHERE id='primary'").first<{ spreadsheetId: string | null }>();
    if (stored?.spreadsheetId) spreadsheetId = stored.spreadsheetId;
  }

  spreadsheet ??= await getSpreadsheet(context, spreadsheetId);
  const tabs = await ensureExactTabs(context, spreadsheetId, spreadsheet.payload);
  await writeHeaders(context, spreadsheetId);
  return { spreadsheetId, tabs };
}

export async function writeBusinessReportValues(input: {
  database: D1Database;
  owner: ReportingOwner;
  config: DriveRuntimeConfig;
  spreadsheetId: string;
  data: Array<{ range: string; values: Array<Array<string | number | boolean>> }>;
  request?: ReportingRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}): Promise<void> {
  if (!input.data.length) return;
  const context: GoogleRequestContext = {
    database: input.database,
    owner: input.owner,
    config: input.config,
    request: input.request,
    retry: { sleep: input.sleep, random: input.random },
  };
  const url = new URL(SHEETS_URL + "/" + encodeURIComponent(input.spreadsheetId) + "/values:batchUpdate");
  url.searchParams.set("valueInputOption", "RAW");
  await callApi(context, url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data: input.data }),
  });
}

export function reportSheetColumnLabel(index: number): string {
  if (!Number.isSafeInteger(index) || index < 1 || index > COLUMN_LABELS.length) throw new RangeError("Invalid report column.");
  return COLUMN_LABELS[index - 1]!;
}
