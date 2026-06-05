import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fsSync from "fs";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec, execFile } from "child_process";
import { promisify } from "util";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 4000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   FILE LOCATIONS
   ========================================================= */

const LOCAL_PRINTERS_FILE = path.join(__dirname, "data", "printers.json");
const PI_PRINTERS_FILE = "/home/fieldlab/Desktop/bambu-fiware/printers.json";

const PRINTERS_FILE =
  process.env.PRINTERS_FILE ||
  (fsSync.existsSync(PI_PRINTERS_FILE) ? PI_PRINTERS_FILE : LOCAL_PRINTERS_FILE);

const ANALYTICS_EVENTS_FILE =
  process.env.ANALYTICS_EVENTS_FILE ||
  path.join(__dirname, "data", "analytics-events.json");

const ANALYTICS_MAX_EVENTS = Number(process.env.ANALYTICS_MAX_EVENTS || 10000);

const ANALYTICS_STALE_TELEMETRY_MINUTES = Number(
  process.env.ANALYTICS_STALE_TELEMETRY_MINUTES || 3
);

/* =========================================================
   BRIDGE / FIWARE / MQTT VALIDATION CONFIG
   ========================================================= */

const BRIDGE_SERVICE_NAME = process.env.BRIDGE_SERVICE_NAME || "bambu-bridge";

const AUTO_RESTART_BRIDGE_ON_SAVE =
  String(process.env.AUTO_RESTART_BRIDGE_ON_SAVE || "true").toLowerCase() ===
  "true";

const VALIDATE_MQTT_ON_SAVE =
  String(process.env.VALIDATE_MQTT_ON_SAVE || "true").toLowerCase() === "true";

const MQTT_VALIDATOR_SCRIPT =
  process.env.MQTT_VALIDATOR_SCRIPT ||
  path.join(__dirname, "validate_bambu_mqtt.py");

const MQTT_VALIDATOR_PYTHON =
  process.env.MQTT_VALIDATOR_PYTHON ||
  "/home/fieldlab/Desktop/bambu-fiware/venv/bin/python3";

const MQTT_VALIDATION_TIMEOUT_SECONDS = Number(
  process.env.MQTT_VALIDATION_TIMEOUT_SECONDS || 3
);

const ACCESS_HEALTH_CACHE_MS = Number(
  process.env.ACCESS_HEALTH_CACHE_MS || 4000
);

const FIWARE_ENTITY_URL =
  process.env.FIWARE_ENTITY_URL ||
  "http://172.16.101.172:1026/ngsi-ld/v1/entities?type=Printer";

const DEFAULT_FIWARE_ENDPOINT =
  process.env.DEFAULT_FIWARE_ENDPOINT ||
  "http://172.16.101.172:1026/ngsi-ld/v1/entities";

/* =========================================================
   FIWARE HELPERS
   ========================================================= */

function getFiwareHeaders() {
  return {
    Accept: "application/ld+json",
    "fiware-service": "openiot",
    "fiware-servicepath": "/",
  };
}

async function fetchFiwarePrintersSafe() {
  try {
    const response = await fetch(FIWARE_ENTITY_URL, {
      headers: getFiwareHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();

      return {
        data: [],
        error: `FIWARE request failed: ${response.status} ${text}`,
      };
    }

    const data = await response.json();

    return {
      data: Array.isArray(data) ? data : [],
      error: null,
    };
  } catch (err) {
    console.error("FIWARE fetch failed:", err);

    return {
      data: [],
      error: err.message,
    };
  }
}

/* =========================================================
   FILE HELPERS
   ========================================================= */

async function ensurePrintersFileExists() {
  const dir = path.dirname(PRINTERS_FILE);
  await fs.mkdir(dir, { recursive: true });

  if (!fsSync.existsSync(PRINTERS_FILE)) {
    const initialData = {
      last_updated: new Date().toISOString(),
      fiware_endpoint: DEFAULT_FIWARE_ENDPOINT,
      printers: [],
    };

    await fs.writeFile(
      PRINTERS_FILE,
      JSON.stringify(initialData, null, 2),
      "utf-8"
    );
  }
}

async function readPrintersFile() {
  await ensurePrintersFileExists();

  const raw = await fs.readFile(PRINTERS_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  await fs.mkdir(dir, { recursive: true });

  if (fsSync.existsSync(filePath)) {
    const previous = await fs.readFile(filePath, "utf-8");
    await fs.writeFile(backupPath, previous, "utf-8");
  }

  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

/* =========================================================
   PRINTER CONFIG HELPERS
   ========================================================= */

function sanitizePrinter(input = {}, existing = {}) {
  return {
    id: String(input.id ?? existing.id ?? "").trim(),
    name: String(input.name ?? existing.name ?? "").trim(),
    ip: String(input.ip ?? existing.ip ?? "").trim(),
    access_code: String(input.access_code ?? existing.access_code ?? "").trim(),
    serial: String(input.serial ?? existing.serial ?? "").trim(),

    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : typeof existing.enabled === "boolean"
        ? existing.enabled
        : true,

    is_pipeline_healthy:
      typeof input.is_pipeline_healthy === "boolean"
        ? input.is_pipeline_healthy
        : typeof existing.is_pipeline_healthy === "boolean"
        ? existing.is_pipeline_healthy
        : false,

    health_message:
      input.health_message ??
      existing.health_message ??
      "No health status yet",

    // Structured health fields used by FleetView and SettingsView.
    health_code: input.health_code ?? existing.health_code ?? null,
    access_validation_at:
      input.access_validation_at ?? existing.access_validation_at ?? null,
    mqtt_validation_reason:
      input.mqtt_validation_reason ?? existing.mqtt_validation_reason ?? null,

    last_error: input.last_error ?? existing.last_error ?? null,
    last_error_at: input.last_error_at ?? existing.last_error_at ?? null,
    last_seen: input.last_seen ?? existing.last_seen ?? null,

    last_updated:
      input.last_updated ?? existing.last_updated ?? new Date().toISOString(),
  };
}

function isValidIPv4(ip) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return false;
  }

  return ip.split(".").every((part) => {
    const number = Number(part);
    return Number.isInteger(number) && number >= 0 && number <= 255;
  });
}

function validatePrinter(printer, index = null) {
  const prefix =
    index === null
      ? `${printer.name || printer.id || "Printer"}`
      : `Printer ${index + 1}`;

  const errors = [];

  if (!printer.id) errors.push(`${prefix}: missing id`);
  if (!printer.name) errors.push(`${prefix}: missing name`);
  if (!printer.ip) errors.push(`${prefix}: missing ip`);
  if (printer.ip && !isValidIPv4(printer.ip)) {
    errors.push(`${prefix}: invalid ip`);
  }
  if (!printer.access_code) errors.push(`${prefix}: missing access_code`);
  if (!printer.serial) errors.push(`${prefix}: missing serial`);

  return errors;
}

function assertSafeServiceName(name) {
  if (!/^[a-zA-Z0-9_.@-]+$/.test(name)) {
    throw new Error(`Unsafe systemd service name: ${name}`);
  }
}

function markPrinterAfterSuccessfulValidation(existingPrinter, updates = {}) {
  const now = new Date().toISOString();

  return {
    ...existingPrinter,
    ...updates,

    is_pipeline_healthy: true,
    health_code: "MQTT_OK",
    health_message:
      updates.health_message ||
      "MQTT access code accepted. Bridge restart requested. Waiting for fresh FIWARE telemetry.",

    last_error: null,
    last_error_at: null,
    access_validation_at: now,
    mqtt_validation_reason: updates.mqtt_validation_reason || null,
    last_updated: now,
  };
}


/* =========================================================
   STRUCTURED MQTT HEALTH HELPERS

   Long-term rule:
   - React/FleetView should not guess access-code errors from generic words.
   - The backend converts low-level bridge/validator messages into stable health_code values.
   - rc=5 from Bambu MQTT means the broker refused authentication/authorization,
     which usually means the LAN access code is wrong/rotated.
   ========================================================= */

function textContainsMqttAuthFailure(text = "") {
  const normalized = String(text || "").toLowerCase();

  return (
    normalized.includes("rc=5") ||
    normalized.includes("return code 5") ||
    normalized.includes("connection refused: 5") ||
    normalized.includes("not authorised") ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication failed") ||
    normalized.includes("auth failed") ||
    normalized.includes("bad username") ||
    normalized.includes("bad password") ||
    normalized.includes("wrong access code") ||
    normalized.includes("invalid access code") ||
    normalized.includes("access code invalid") ||
    normalized.includes("code may be wrong")
  );
}

function isMqttAuthHealthCode(value) {
  const code = String(value || "").toUpperCase();

  return (
    code === "MQTT_AUTH_FAILED" ||
    code === "ACCESS_CODE_INVALID" ||
    code === "AUTH_FAILED" ||
    code === "UNAUTHORIZED"
  );
}

function isFreshTelemetryMessage(printer = {}) {
  const message = String(printer.health_message || "").toLowerCase();

  return (
    printer.is_pipeline_healthy === true &&
    (message.includes("fresh mqtt") ||
      message.includes("fresh fiware") ||
      message.includes("fresh telemetry") ||
      message.includes("telemetry received"))
  );
}

function collectHealthText(printer = {}) {
  return [
    printer.health_message,
    printer.healthMessage,
    printer.last_error,
    printer.lastError,
    printer.error,
    printer.status_message,
    printer.pipeline_status,
    printer.mqtt_validation_reason,
  ]
    .filter(Boolean)
    .join(" ");
}

function markPrinterHealthAuthFailed(printer = {}, message = null) {
  const now = new Date().toISOString();

  return {
    ...printer,
    health_code: "MQTT_AUTH_FAILED",
    is_pipeline_healthy: false,
    health_message:
      "Access code error: MQTT authentication failed. Check the current printer access code.",
    last_error:
      message ||
      printer.last_error ||
      "MQTT authentication failed. Check printer access code.",
    last_error_at: printer.last_error_at || now,
    mqtt_validation_reason:
      printer.mqtt_validation_reason || "MQTT_AUTH_FAILED",
  };
}

function normalizePrinterHealth(printer = {}) {
  if (!printer.enabled) {
    return {
      ...printer,
      health_code: "PRINTER_DISABLED",
      is_pipeline_healthy: false,
      health_message: printer.health_message || "Printer disabled",
    };
  }

  /*
    If the bridge has already recovered and is reporting fresh telemetry,
    clear old auth/validation health without touching config fields.
  */
  if (isFreshTelemetryMessage(printer)) {
    return {
      ...printer,
      health_code: "MQTT_OK",
      is_pipeline_healthy: true,
      last_error: null,
      last_error_at: null,
      mqtt_validation_reason: null,
    };
  }

  if (isMqttAuthHealthCode(printer.health_code || printer.healthCode)) {
    return markPrinterHealthAuthFailed(printer);
  }

  const combinedText = collectHealthText(printer);

  /*
    Important discovered case:
    Your bridge writes "MQTT disconnected unexpectedly rc=5".
    rc=5 should become structured health_code MQTT_AUTH_FAILED.
  */
  if (textContainsMqttAuthFailure(combinedText)) {
    return markPrinterHealthAuthFailed(printer, printer.last_error || combinedText);
  }

  if (printer.is_pipeline_healthy === false && !printer.health_code) {
    return {
      ...printer,
      health_code: "MQTT_PIPELINE_UNHEALTHY",
      health_message:
        printer.health_message ||
        "MQTT/FIWARE pipeline is unhealthy, but this has not been confirmed as an access-code problem.",
    };
  }

  return printer;
}

function normalizeConfigHealth(config = {}) {
  if (!Array.isArray(config.printers)) {
    return config;
  }

  return {
    ...config,
    printers: config.printers.map(normalizePrinterHealth),
  };
}

function isMqttAuthFailure(validation = {}) {
  const reason = String(validation.reason || "").toUpperCase();
  const message = String(validation.message || "");
  const stderr = String(validation.stderr || "");
  const stdout = String(validation.stdout || "");
  const combinedText = `${message} ${stderr} ${stdout}`;

  return (
    isMqttAuthHealthCode(reason) ||
    textContainsMqttAuthFailure(combinedText)
  );
}

function markPrinterAfterMqttHealthCheck(printer, validation) {
  const now = new Date().toISOString();

  if (validation?.ok) {
    return {
      ...printer,
      health_code: "MQTT_OK",
      is_pipeline_healthy: true,
      health_message: validation.message || "MQTT access code accepted.",
      last_error: null,
      last_error_at: null,
      access_validation_at: now,
      mqtt_validation_reason: validation.reason || null,
      last_updated: printer.last_updated || now,
    };
  }

  if (isMqttAuthFailure(validation)) {
    return {
      ...printer,
      health_code: "MQTT_AUTH_FAILED",
      is_pipeline_healthy: false,
      health_message:
        "Access code error: MQTT authentication failed. Check the current printer access code.",
      last_error: validation?.message || "Access code invalid",
      last_error_at: now,
      access_validation_at: now,
      mqtt_validation_reason: validation?.reason || "MQTT_AUTH_FAILED",
      last_updated: now,
    };
  }

  return {
    ...printer,
    health_code: "MQTT_CHECK_FAILED",
    is_pipeline_healthy: false,
    health_message:
      validation?.message ||
      "MQTT check failed. Printer may be offline, unreachable, or not publishing.",
    last_error:
      validation?.message ||
      validation?.reason ||
      "MQTT validation failed",
    last_error_at: now,
    access_validation_at: now,
    mqtt_validation_reason: validation?.reason || "MQTT_CHECK_FAILED",
    last_updated: now,
  };
}

function shouldRefreshAccessHealth(printer) {
  if (!printer.enabled) return false;

  if (!printer.access_validation_at) {
    return true;
  }

  const lastMs = new Date(printer.access_validation_at).getTime();

  if (!Number.isFinite(lastMs)) {
    return true;
  }

  return Date.now() - lastMs > ACCESS_HEALTH_CACHE_MS;
}

async function refreshAccessCodeHealth(config) {
  if (!config || !Array.isArray(config.printers)) {
    return config;
  }

  let changed = false;
  const updatedPrinters = [];

  /*
    This is only used by save/settings validation paths.
    /api/dashboard should stay fast and should not validate all printers synchronously.
  */
  for (const printer of config.printers) {
    if (!shouldRefreshAccessHealth(printer)) {
      updatedPrinters.push(normalizePrinterHealth(printer));
      continue;
    }

    try {
      const validation = await validateBambuMqttAccess(printer);
      const updatedPrinter = markPrinterAfterMqttHealthCheck(printer, validation);

      updatedPrinters.push(updatedPrinter);

      if (JSON.stringify(updatedPrinter) !== JSON.stringify(printer)) {
        changed = true;
      }
    } catch (err) {
      const updatedPrinter = markPrinterAfterMqttHealthCheck(printer, {
        ok: false,
        reason: "VALIDATOR_EXCEPTION",
        message: err?.message || "MQTT validation crashed",
      });

      updatedPrinters.push(updatedPrinter);
      changed = true;
    }
  }

  if (!changed) {
    return {
      ...config,
      printers: updatedPrinters,
    };
  }

  const updatedConfig = {
    ...config,
    printers: updatedPrinters,
    last_updated: new Date().toISOString(),
  };

  await writeJsonAtomic(PRINTERS_FILE, updatedConfig);

  return updatedConfig;
}

/* =========================================================
   MQTT ACCESS-CODE VALIDATION
   ========================================================= */

function parseValidatorJson(stdout = "") {
  const lines = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch (_err) {
      // Ignore non-JSON lines such as warnings.
    }
  }

  return null;
}

async function validateBambuMqttAccess(printer) {
  if (!VALIDATE_MQTT_ON_SAVE) {
    return {
      ok: true,
      skipped: true,
      reason: "VALIDATION_DISABLED",
      message: "MQTT validation is disabled.",
    };
  }

  if (!printer.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "PRINTER_DISABLED",
      message: "Printer is disabled, so MQTT validation was skipped.",
    };
  }

  if (!fsSync.existsSync(MQTT_VALIDATOR_SCRIPT)) {
    return {
      ok: false,
      reason: "VALIDATOR_SCRIPT_MISSING",
      message: `MQTT validator script was not found: ${MQTT_VALIDATOR_SCRIPT}`,
    };
  }

  if (!fsSync.existsSync(MQTT_VALIDATOR_PYTHON)) {
    return {
      ok: false,
      reason: "VALIDATOR_PYTHON_MISSING",
      message: `MQTT validator Python was not found: ${MQTT_VALIDATOR_PYTHON}`,
    };
  }

  const args = [
    MQTT_VALIDATOR_SCRIPT,
    "--ip",
    printer.ip,
    "--serial",
    printer.serial,
    "--access-code",
    printer.access_code,
    "--timeout",
    String(MQTT_VALIDATION_TIMEOUT_SECONDS),
  ];

  try {
    const { stdout, stderr } = await execFileAsync(
      MQTT_VALIDATOR_PYTHON,
      args,
      {
        timeout: Math.max(10, MQTT_VALIDATION_TIMEOUT_SECONDS + 4) * 1000,
        maxBuffer: 1024 * 1024,
      }
    );

    const parsed = parseValidatorJson(stdout);

    if (!parsed) {
      return {
        ok: false,
        reason: "VALIDATOR_BAD_OUTPUT",
        message: "MQTT validator did not return valid JSON.",
        stdout: stdout?.trim?.() || "",
        stderr: stderr?.trim?.() || "",
      };
    }

    return {
      ...parsed,
      stderr: stderr?.trim?.() || "",
    };
  } catch (err) {
    const parsed = parseValidatorJson(err?.stdout || "");

    if (parsed) {
      return {
        ...parsed,
        stderr: err?.stderr?.trim?.() || "",
      };
    }

    return {
      ok: false,
      reason: "VALIDATOR_COMMAND_FAILED",
      message:
        err?.message ||
        "MQTT validator command failed before returning JSON.",
      stdout: err?.stdout?.trim?.() || "",
      stderr: err?.stderr?.trim?.() || "",
    };
  }
}

/* =========================================================
   BRIDGE HELPERS
   ========================================================= */

async function restartBridgeService() {
  if (process.platform !== "linux") {
    return {
      ok: true,
      skipped: true,
      message: "Restart skipped outside Linux",
    };
  }

  assertSafeServiceName(BRIDGE_SERVICE_NAME);

  const { stdout, stderr } = await execAsync(
    `sudo systemctl restart ${BRIDGE_SERVICE_NAME}`
  );

  return {
    ok: true,
    skipped: false,
    message: `Bridge service '${BRIDGE_SERVICE_NAME}' restarted`,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
  };
}

async function getBridgeStatus() {
  if (process.platform !== "linux") {
    return {
      ok: true,
      active: null,
      raw: "unknown",
      message: "Bridge status unavailable outside Linux",
    };
  }

  assertSafeServiceName(BRIDGE_SERVICE_NAME);

  try {
    const { stdout } = await execAsync(
      `systemctl is-active ${BRIDGE_SERVICE_NAME}`
    );

    return {
      ok: true,
      active: stdout.trim() === "active",
      raw: stdout.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      active: false,
      raw: error?.stdout?.trim?.() || "inactive",
      error: error?.stderr?.trim?.() || error.message,
    };
  }
}

/* =========================================================
   ANALYTICS HELPERS
   ========================================================= */

function makeEventId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getValue(input, key) {
  const raw = input?.[key];

  if (raw && typeof raw === "object" && "value" in raw) {
    return raw.value;
  }

  return raw;
}

function toBoolean(value, fallback = null) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "online"].includes(normalized)) return true;
    if (["false", "0", "no", "offline"].includes(normalized)) return false;
  }

  return fallback;
}

function toMs(value) {
  if (!value) return null;

  const date = new Date(value);
  const ms = date.getTime();

  return Number.isNaN(ms) ? null : ms;
}

function minutesBetween(startIso, endIso) {
  const start = toMs(startIso);
  const end = toMs(endIso);

  if (!start || !end || end < start) return null;

  return Math.round(((end - start) / 60000) * 10) / 10;
}

function getLocalDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "").toLowerCase();

  if (
    status.includes("error") ||
    status.includes("fail") ||
    status.includes("alarm")
  ) {
    return "error";
  }

  if (
    status.includes("print") ||
    status.includes("printing") ||
    status.includes("running") ||
    status.includes("run") ||
    status.includes("busy") ||
    status.includes("pause") ||
    status.includes("paused")
  ) {
    return "printing";
  }

  if (
    status.includes("finish") ||
    status.includes("complete") ||
    status.includes("done")
  ) {
    return "finished";
  }

  return "idle";
}

function normalizePrinterName(value) {
  return String(value || "")
    .replace("urn:ngsi-ld:printer:", "")
    .replaceAll("_", " ")
    .trim();
}

function normalizeObservation(input = {}) {
  const rawId =
    input.printerId ||
    input.id ||
    input.entityId ||
    getValue(input, "id") ||
    getValue(input, "serial") ||
    getValue(input, "name");

  const rawName =
    input.printerName ||
    input.name ||
    getValue(input, "name") ||
    normalizePrinterName(rawId);

  const printerId = String(rawId || rawName || "").trim();
  const printerName = normalizePrinterName(rawName || printerId);

  if (!printerId && !printerName) {
    return null;
  }

  const rawStatus =
    input.status ||
    getValue(input, "status") ||
    getValue(input, "state") ||
    getValue(input, "printStatus");

  const status = normalizeStatus(rawStatus);

  const online = toBoolean(input.online ?? getValue(input, "online"), true);

  const alerts = Number(input.alerts ?? getValue(input, "alerts") ?? 0);

  const lastSeen =
    input.lastSeen ||
    input.last_seen ||
    getValue(input, "lastSeen") ||
    getValue(input, "last_seen") ||
    null;

  const lastSeenMs = toMs(lastSeen);

  const stale =
    lastSeenMs !== null &&
    Date.now() - lastSeenMs >
      ANALYTICS_STALE_TELEMETRY_MINUTES * 60 * 1000;

  const bookingStatus = String(input.bookingStatus || "").toLowerCase();

  const bookingWarning =
    input.bookingWarning || input.health_message || input.warning || null;

  const hasBookingRaw =
    typeof input.hasBooking === "boolean" ? input.hasBooking : null;

  const isPrinting =
    toBoolean(input.isPrinting, null) === true || status === "printing";

  let bookingCompliance = "unknown_booking";

  if (isPrinting) {
    if (
      bookingStatus === "without-booking" ||
      bookingStatus === "without_booking" ||
      hasBookingRaw === false ||
      String(bookingWarning || "").toLowerCase().includes("without booking") ||
      String(bookingWarning || "").toLowerCase().includes("no booking")
    ) {
      bookingCompliance = "without_booking";
    } else if (
      bookingStatus === "with-booking" ||
      bookingStatus === "with_booking" ||
      hasBookingRaw === true ||
      input.currentBooking
    ) {
      bookingCompliance = "with_booking";
    }
  }

  const errorActive =
    status === "error" || online === false || stale || alerts > 0;

  let errorMessage = null;

  if (status === "error") {
    errorMessage = "Printer reported an error";
  } else if (online === false) {
    errorMessage = "Printer is offline or MQTT telemetry is unavailable";
  } else if (stale) {
    errorMessage = `Telemetry is stale for more than ${ANALYTICS_STALE_TELEMETRY_MINUTES} minutes`;
  } else if (alerts > 0) {
    errorMessage = `${alerts} active alert${alerts > 1 ? "s" : ""}`;
  }

  return {
    printerId,
    printerName,
    status,
    online,
    alerts,
    lastSeen,
    isPrinting,
    bookingCompliance,
    errorActive,
    errorMessage,
  };
}

async function ensureAnalyticsFileExists() {
  const dir = path.dirname(ANALYTICS_EVENTS_FILE);
  await fs.mkdir(dir, { recursive: true });

  if (!fsSync.existsSync(ANALYTICS_EVENTS_FILE)) {
    const initialData = {
      last_updated: new Date().toISOString(),
      states: {},
      events: [],
    };

    await fs.writeFile(
      ANALYTICS_EVENTS_FILE,
      JSON.stringify(initialData, null, 2),
      "utf-8"
    );
  }
}

async function readAnalyticsStore() {
  await ensureAnalyticsFileExists();

  const raw = await fs.readFile(ANALYTICS_EVENTS_FILE, "utf-8");
  const parsed = JSON.parse(raw);

  return {
    last_updated: parsed.last_updated || new Date().toISOString(),
    states:
      parsed.states && typeof parsed.states === "object" ? parsed.states : {},
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
}

async function writeAnalyticsStore(store) {
  const payload = {
    ...store,
    last_updated: new Date().toISOString(),
    events: store.events.slice(-ANALYTICS_MAX_EVENTS),
  };

  await writeJsonAtomic(ANALYTICS_EVENTS_FILE, payload);

  return payload;
}

function findEvent(store, eventId) {
  return store.events.find((event) => event.id === eventId);
}

async function observeAnalyticsSnapshot(rawObservations = [], meta = {}) {
  const observations = rawObservations
    .map((item) => normalizeObservation(item))
    .filter(Boolean);

  const store = await readAnalyticsStore();
  const nowIso = new Date().toISOString();

  for (const observation of observations) {
    const key = observation.printerId || observation.printerName;

    const previousState = store.states[key] || {
      printerId: observation.printerId,
      printerName: observation.printerName,
      activeUsageEventId: null,
      activeErrorEventId: null,
    };

    if (observation.isPrinting) {
      if (!previousState.activeUsageEventId) {
        const event = {
          id: makeEventId("usage"),
          type: "usage_session",
          printerId: observation.printerId,
          printerName: observation.printerName,
          bookingCompliance: observation.bookingCompliance,
          startedAt: nowIso,
          endedAt: null,
          durationMinutes: null,
          source: meta.source || "unknown",
          lastSeenAt: nowIso,
        };

        store.events.push(event);
        previousState.activeUsageEventId = event.id;
      } else {
        const activeEvent = findEvent(store, previousState.activeUsageEventId);

        if (activeEvent) {
          activeEvent.lastSeenAt = nowIso;

          if (
            activeEvent.bookingCompliance === "unknown_booking" &&
            observation.bookingCompliance !== "unknown_booking"
          ) {
            activeEvent.bookingCompliance = observation.bookingCompliance;
          }

          if (observation.bookingCompliance === "without_booking") {
            activeEvent.bookingCompliance = "without_booking";
          }
        }
      }
    } else if (previousState.activeUsageEventId) {
      const activeEvent = findEvent(store, previousState.activeUsageEventId);

      if (activeEvent && !activeEvent.endedAt) {
        activeEvent.endedAt = nowIso;
        activeEvent.durationMinutes = minutesBetween(
          activeEvent.startedAt,
          activeEvent.endedAt
        );
        activeEvent.lastSeenAt = nowIso;
      }

      previousState.activeUsageEventId = null;
    }

    if (observation.errorActive) {
      if (!previousState.activeErrorEventId) {
        const event = {
          id: makeEventId("mqtt"),
          type: "mqtt_error",
          printerId: observation.printerId,
          printerName: observation.printerName,
          message: observation.errorMessage || "MQTT or printer error detected",
          startedAt: nowIso,
          resolvedAt: null,
          resolutionMinutes: null,
          source: meta.source || "unknown",
          lastSeenAt: nowIso,
        };

        store.events.push(event);
        previousState.activeErrorEventId = event.id;
      } else {
        const activeError = findEvent(store, previousState.activeErrorEventId);

        if (activeError) {
          activeError.message =
            observation.errorMessage || activeError.message;
          activeError.lastSeenAt = nowIso;
        }
      }
    } else if (previousState.activeErrorEventId) {
      const activeError = findEvent(store, previousState.activeErrorEventId);

      if (activeError && !activeError.resolvedAt) {
        activeError.resolvedAt = nowIso;
        activeError.resolutionMinutes = minutesBetween(
          activeError.startedAt,
          activeError.resolvedAt
        );
        activeError.lastSeenAt = nowIso;
      }

      previousState.activeErrorEventId = null;
    }

    store.states[key] = {
      ...previousState,
      printerId: observation.printerId,
      printerName: observation.printerName,
      status: observation.status,
      online: observation.online,
      alerts: observation.alerts,
      lastSeen: observation.lastSeen,
      lastObservedAt: nowIso,
    };
  }

  return writeAnalyticsStore(store);
}

async function observeFiwareSnapshotForAnalytics() {
  const result = await fetchFiwarePrintersSafe();

  if (!result || !Array.isArray(result.data) || result.data.length === 0) {
    return {
      ok: false,
      observed: 0,
      error: result?.error || "No FIWARE printer entities found",
    };
  }

  await observeAnalyticsSnapshot(result.data, {
    source: "fiware-auto",
  });

  return {
    ok: true,
    observed: result.data.length,
    error: null,
  };
}

function average(values) {
  const clean = values.filter(
    (value) => typeof value === "number" && !Number.isNaN(value)
  );

  if (clean.length === 0) return null;

  return Math.round(
    (clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10
  ) / 10;
}

function summarizeEvents(events) {
  const usageEvents = events.filter((event) => event.type === "usage_session");
  const errorEvents = events.filter((event) => event.type === "mqtt_error");

  const withBooking = usageEvents.filter(
    (event) => event.bookingCompliance === "with_booking"
  ).length;

  const withoutBooking = usageEvents.filter(
    (event) => event.bookingCompliance === "without_booking"
  ).length;

  const resolvedErrors = errorEvents.filter(
    (event) => !!event.resolvedAt
  ).length;

  const unresolvedErrors = errorEvents.filter(
    (event) => !event.resolvedAt
  ).length;

  return {
    totalUsageSessions: usageEvents.length,
    withBooking,
    withoutBooking,
    mqttErrors: errorEvents.length,
    resolvedErrors,
    unresolvedErrors,
    averageResolutionMinutes: average(
      errorEvents
        .filter((event) => !!event.resolvedAt)
        .map((event) => event.resolutionMinutes)
    ),
  };
}

function buildDailySeries(events, rangeDays) {
  const todayStart = startOfLocalDay(new Date());
  const days = [];

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const date = new Date(todayStart);
    date.setDate(todayStart.getDate() - i);

    days.push({
      date: getLocalDayKey(date),
      withBooking: 0,
      withoutBooking: 0,
      mqttErrors: 0,
    });
  }

  const byDate = Object.fromEntries(days.map((day) => [day.date, day]));

  for (const event of events) {
    const key = getLocalDayKey(event.startedAt);

    if (!key || !byDate[key]) continue;

    if (event.type === "usage_session") {
      if (event.bookingCompliance === "with_booking") {
        byDate[key].withBooking += 1;
      }

      if (event.bookingCompliance === "without_booking") {
        byDate[key].withoutBooking += 1;
      }
    }

    if (event.type === "mqtt_error") {
      byDate[key].mqttErrors += 1;
    }
  }

  return days;
}

function buildPrinterUsage(events) {
  const usageEvents = events.filter((event) => event.type === "usage_session");
  const grouped = {};

  for (const event of usageEvents) {
    const key = event.printerId || event.printerName;

    if (!grouped[key]) {
      grouped[key] = {
        printerId: event.printerId,
        printerName: event.printerName,
        sessions: 0,
        withBooking: 0,
        withoutBooking: 0,
      };
    }

    grouped[key].sessions += 1;

    if (event.bookingCompliance === "with_booking") {
      grouped[key].withBooking += 1;
    }

    if (event.bookingCompliance === "without_booking") {
      grouped[key].withoutBooking += 1;
    }
  }

  return Object.values(grouped).sort((a, b) => b.sessions - a.sessions);
}

function buildErrorByPrinter(events) {
  const errorEvents = events.filter((event) => event.type === "mqtt_error");
  const grouped = {};

  for (const event of errorEvents) {
    const key = event.printerId || event.printerName;

    if (!grouped[key]) {
      grouped[key] = {
        printerId: event.printerId,
        printerName: event.printerName,
        errorCount: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        resolutionValues: [],
      };
    }

    grouped[key].errorCount += 1;

    if (event.resolvedAt) {
      grouped[key].resolvedCount += 1;

      if (typeof event.resolutionMinutes === "number") {
        grouped[key].resolutionValues.push(event.resolutionMinutes);
      }
    } else {
      grouped[key].unresolvedCount += 1;
    }
  }

  return Object.values(grouped)
    .map((item) => ({
      printerId: item.printerId,
      printerName: item.printerName,
      errorCount: item.errorCount,
      resolvedCount: item.resolvedCount,
      unresolvedCount: item.unresolvedCount,
      averageResolutionMinutes: average(item.resolutionValues),
    }))
    .sort((a, b) => b.errorCount - a.errorCount);
}

function buildLiveWarnings(store) {
  const eventById = Object.fromEntries(
    store.events.map((event) => [event.id, event])
  );

  const warnings = [];

  for (const state of Object.values(store.states || {})) {
    if (state.activeUsageEventId) {
      const event = eventById[state.activeUsageEventId];

      if (event && event.bookingCompliance === "without_booking") {
        warnings.push({
          printerName: state.printerName,
          type: "without-booking",
          message: "Printer is being used without a matching Peppi booking",
          startedAt: event.startedAt,
        });
      }
    }

    if (state.activeErrorEventId) {
      const event = eventById[state.activeErrorEventId];

      if (event) {
        warnings.push({
          printerName: state.printerName,
          type: "mqtt-error",
          message: event.message || "MQTT or printer error is active",
          startedAt: event.startedAt,
        });
      }
    }
  }

  return warnings;
}

function buildAnalyticsSummary(store, rangeMode = "7d") {
  const rangeDays = rangeMode === "30d" ? 30 : 7;

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(todayStart.getDate() - (rangeDays - 1));

  const todayEvents = store.events.filter((event) => {
    const started = toMs(event.startedAt);
    return started !== null && started >= todayStart.getTime();
  });

  const rangeEvents = store.events.filter((event) => {
    const started = toMs(event.startedAt);
    return started !== null && started >= rangeStart.getTime();
  });

  return {
    ok: true,
    date: getLocalDayKey(now),
    rangeMode,
    lastUpdated: store.last_updated,
    today: summarizeEvents(todayEvents),
    range: {
      days: rangeDays,
      ...summarizeEvents(rangeEvents),
      daily: buildDailySeries(rangeEvents, rangeDays),
    },
    printerUsage: buildPrinterUsage(rangeEvents),
    errorByPrinter: buildErrorByPrinter(rangeEvents),
    liveWarnings: buildLiveWarnings(store),
    file: ANALYTICS_EVENTS_FILE,
  };
}

/* =========================================================
   PRINTER CONFIG HANDLERS
   ========================================================= */

async function getPrinterConfigHandler(_req, res) {
  try {
    const rawConfig = await readPrintersFile();

    /*
      Settings page should receive structured health_code values.
      It does not need to guess from raw bridge messages.
    */
    const config = normalizeConfigHealth(rawConfig);

    return res.json(config);
  } catch (err) {
    console.error("GET /api/printer-config failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to read printer config",
      details: err.message,
      file: PRINTERS_FILE,
    });
  }
}

async function putPrinterConfigHandler(req, res) {
  try {
    const body = req.body;

    if (!body || !Array.isArray(body.printers)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload. Expected { printers: [...] }",
      });
    }

    const currentConfig = await readPrintersFile();

    const printers = body.printers.map((incoming, index) => {
      const existing =
        currentConfig.printers.find((p) => p.id === incoming.id) || {};

      const merged = sanitizePrinter(incoming, existing);
      const errors = validatePrinter(merged, index);

      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      return markPrinterAfterSuccessfulValidation(merged);
    });

    const duplicateIds = [];
    const seen = new Set();

    for (const printer of printers) {
      if (seen.has(printer.id)) {
        duplicateIds.push(printer.id);
      }

      seen.add(printer.id);
    }

    if (duplicateIds.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Duplicate printer ids: ${Array.from(
          new Set(duplicateIds)
        ).join(", ")}`,
      });
    }

    const now = new Date().toISOString();

    const payload = {
      ...currentConfig,
      ...body,
      fiware_endpoint:
        body.fiware_endpoint ||
        currentConfig.fiware_endpoint ||
        DEFAULT_FIWARE_ENDPOINT,
      printers,
      last_updated: now,
    };

    await writeJsonAtomic(PRINTERS_FILE, payload);

    let restart = {
      ok: true,
      skipped: true,
      message: "Auto-restart disabled",
    };

    if (AUTO_RESTART_BRIDGE_ON_SAVE) {
      restart = await restartBridgeService();
    }

    return res.json({
      ok: true,
      message: "Printer config updated successfully",
      file: PRINTERS_FILE,
      last_updated: payload.last_updated,
      restart,
      config: payload,
    });
  } catch (err) {
    console.error("PUT /api/printer-config failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to update printer config",
      details: err.message,
      file: PRINTERS_FILE,
    });
  }
}

async function patchPrinterConfigHandler(req, res) {
  try {
    const printerId = req.params.id;
    const { ip, access_code, enabled } = req.body || {};

    const config = await readPrintersFile();

    if (!config || !Array.isArray(config.printers)) {
      return res.status(500).json({
        ok: false,
        error: "Invalid printer config structure",
      });
    }

    const index = config.printers.findIndex((p) => p.id === printerId);

    if (index === -1) {
      return res.status(404).json({
        ok: false,
        error: "Printer not found",
      });
    }

    const existing = config.printers[index];

    const merged = sanitizePrinter(
      {
        ...existing,
        ...(typeof ip === "string" ? { ip: ip.trim() } : {}),
        ...(typeof access_code === "string"
          ? { access_code: access_code.trim() }
          : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {}),
      },
      existing
    );

    const validationErrors = validatePrinter(merged);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validationErrors.join("; "),
      });
    }

    const mqttValidation = await validateBambuMqttAccess(merged);

    if (!mqttValidation.ok) {
      const failedPrinter = markPrinterAfterMqttHealthCheck(
        merged,
        mqttValidation
      );

      config.printers[index] = failedPrinter;
      config.last_updated = failedPrinter.last_updated;

      await writeJsonAtomic(PRINTERS_FILE, config);

      const isAccessCodeInvalid = isMqttAuthFailure(mqttValidation);

      return res.status(400).json({
        ok: false,
        error: isAccessCodeInvalid
          ? "Access code invalid"
          : "MQTT validation failed",
        details:
          mqttValidation.message ||
          "Could not validate MQTT connection for this printer.",
        validation: mqttValidation,
        config: normalizeConfigHealth(config),
      });
    }

    const updatedPrinter = markPrinterAfterSuccessfulValidation(merged, {
      is_pipeline_healthy: true,
      health_message:
        mqttValidation.message ||
        "MQTT access code accepted. Waiting for bridge restart.",
      last_error: null,
      last_error_at: null,
    });

    config.printers[index] = updatedPrinter;
    config.last_updated = updatedPrinter.last_updated;

    await writeJsonAtomic(PRINTERS_FILE, config);

    let restart = {
      ok: true,
      skipped: true,
      message: "Auto-restart disabled",
    };

    if (AUTO_RESTART_BRIDGE_ON_SAVE) {
      restart = await restartBridgeService();
    }

    return res.json({
      ok: true,
      message: `Printer ${updatedPrinter.name} updated successfully`,
      printer: updatedPrinter,
      last_updated: config.last_updated,
      mqtt_validation: mqttValidation,
      restart,
      config: normalizeConfigHealth(config),
    });
  } catch (err) {
    console.error("PATCH /api/printer-config/:id failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to update printer config",
      details: err.message,
    });
  }
}

/* =========================================================
   LIVE DATA FROM FIWARE
   ========================================================= */

app.get("/api/printers", async (_req, res) => {
  const { data, error } = await fetchFiwarePrintersSafe();

  if (error && data.length === 0) {
    return res.status(500).json({
      ok: false,
      error: "FIWARE request failed",
      details: error,
    });
  }

  return res.json(data);
});

/* =========================================================
   RUNTIME STATE
   ========================================================= */

app.get("/api/printer-runtime", async (_req, res) => {
  try {
    const rawConfig = await readPrintersFile();
    const config = normalizeConfigHealth(rawConfig);
    const fiwareResult = await fetchFiwarePrintersSafe();
    const bridgeStatus = await getBridgeStatus().catch(() => null);

    return res.json({
      ok: true,
      config,
      printers: fiwareResult.data || [],
      warnings: {
        printersError: fiwareResult.error,
      },
      bridge_status: bridgeStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/printer-runtime failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Printer runtime request failed",
      details: err.message,
    });
  }
});

/* =========================================================
   DASHBOARD DATA
   ========================================================= */

app.get("/api/dashboard", async (_req, res) => {
  try {
    const rawConfig = await readPrintersFile();

    /*
      Dashboard must stay fast.
      It reads the bridge-written health state and converts rc=5/auth messages
      into structured health_code values for FleetView.
    */
    const config = normalizeConfigHealth(rawConfig);

    const fiwareResult = await fetchFiwarePrintersSafe();

    return res.json({
      ok: true,
      printers: fiwareResult.data || [],
      configPrinters: config.printers || [],
      configLastUpdated: config.last_updated,
      warnings: {
        printersError: fiwareResult.error,
      },
    });
  } catch (err) {
    console.error("GET /api/dashboard failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Dashboard request failed",
      details: err.message,
    });
  }
});

/* =========================================================
   MANUAL MQTT VALIDATION ROUTE
   ========================================================= */

app.post("/api/validate-printer-access", async (req, res) => {
  try {
    const body = req.body || {};

    const printer = sanitizePrinter({
      id: body.id || "manual-validation",
      name: body.name || "Manual validation",
      ip: body.ip,
      access_code: body.access_code,
      serial: body.serial,
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
    });

    const validationErrors = validatePrinter(printer);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validationErrors.join("; "),
      });
    }

    const validation = await validateBambuMqttAccess(printer);

    return res.status(validation.ok ? 200 : 400).json({
      ok: validation.ok,
      validation,
    });
  } catch (err) {
    console.error("POST /api/validate-printer-access failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Manual MQTT validation failed",
      details: err.message,
    });
  }
});

/* =========================================================
   PRINTER CONFIG ROUTES
   ========================================================= */

app.get("/api/printer-config", getPrinterConfigHandler);
app.put("/api/printer-config", putPrinterConfigHandler);
app.patch("/api/printer-config/:id", patchPrinterConfigHandler);

app.get("/api/settings/printers", getPrinterConfigHandler);
app.put("/api/settings/printers", putPrinterConfigHandler);

/* =========================================================
   BRIDGE CONTROL
   ========================================================= */

app.post("/api/restart-bridge", async (_req, res) => {
  try {
    const result = await restartBridgeService();
    return res.json(result);
  } catch (err) {
    console.error("POST /api/restart-bridge failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to restart bridge",
      details: err.message,
    });
  }
});

app.get("/api/bridge-status", async (_req, res) => {
  try {
    const status = await getBridgeStatus();
    return res.json(status);
  } catch (err) {
    console.error("GET /api/bridge-status failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to get bridge status",
      details: err.message,
    });
  }
});

/* =========================================================
   PEPPI REMOVED FROM THIS BACKEND
   ========================================================= */

app.get("/api/peppi", (_req, res) => {
  return res.status(410).json({
    ok: false,
    error: "Peppi endpoint moved",
    message:
      "Peppi booking data is now served by the separate Peppi backend on port 5050.",
    new_backend_example: "http://localhost:5050/api/peppi",
  });
});

/* =========================================================
   ANALYTICS ROUTES
   ========================================================= */

app.post("/api/analytics/observe", async (req, res) => {
  try {
    const body = req.body || {};

    const observations = Array.isArray(body.printers)
      ? body.printers
      : Array.isArray(body)
      ? body
      : [];

    if (observations.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Expected { printers: [...] } or an array of printer observations",
      });
    }

    const store = await observeAnalyticsSnapshot(observations, {
      source: body.source || "frontend",
    });

    const rangeMode = body.range === "30d" ? "30d" : "7d";

    return res.json({
      ok: true,
      observed: observations.length,
      summary: buildAnalyticsSummary(store, rangeMode),
    });
  } catch (err) {
    console.error("POST /api/analytics/observe failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to observe analytics snapshot",
      details: err.message,
    });
  }
});

app.get("/api/analytics/summary", async (req, res) => {
  try {
    const rangeMode = req.query.range === "30d" ? "30d" : "7d";

    try {
      await observeFiwareSnapshotForAnalytics();
    } catch (sampleError) {
      console.warn("Analytics FIWARE auto-sample failed:", sampleError.message);
    }

    const store = await readAnalyticsStore();
    const summary = buildAnalyticsSummary(store, rangeMode);

    return res.json(summary);
  } catch (err) {
    console.error("GET /api/analytics/summary failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to build analytics summary",
      details: err.message,
      file: ANALYTICS_EVENTS_FILE,
    });
  }
});

/* =========================================================
   SYSTEM TIME SYNC FROM FRONTEND/LAPTOP
   ========================================================= */

app.post("/api/system-time/sync", async (req, res) => {
  try {
    const { isoTime } = req.body || {};

    if (!isoTime || typeof isoTime !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing isoTime. Expected { isoTime: new Date().toISOString() }",
      });
    }

    const parsed = new Date(isoTime);
    const epochMs = parsed.getTime();

    if (!Number.isFinite(epochMs)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid isoTime",
        received: isoTime,
      });
    }

    const year = parsed.getUTCFullYear();

    if (year < 2026 || year > 2100) {
      return res.status(400).json({
        ok: false,
        error: "Rejected unsafe year",
        year,
        received: isoTime,
      });
    }

    const epochSeconds = Math.floor(epochMs / 1000);

    await execAsync("sudo timedatectl set-timezone Europe/Helsinki");
    await execAsync("sudo timedatectl set-ntp false");
    await execAsync(`sudo date -u -s @${epochSeconds}`);

    let bridgeRestart = {
      ok: true,
      skipped: true,
      message: "Bridge restart skipped",
    };

    if (req.body.restartBridge !== false) {
      bridgeRestart = await restartBridgeService();
    }

    const { stdout: localTime } = await execAsync("date");
    const { stdout: utcTime } = await execAsync("date -u");

    return res.json({
      ok: true,
      message: "Pi system time synced from frontend/browser",
      received_iso_time: isoTime,
      epoch_seconds: epochSeconds,
      local_time: localTime.trim(),
      utc_time: utcTime.trim(),
      bridge_restart: bridgeRestart,
    });
  } catch (err) {
    console.error("POST /api/system-time/sync failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to sync Pi time",
      details: err.message,
    });
  }
});

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", async (_req, res) => {
  const bridgeStatus = await getBridgeStatus().catch(() => null);

  return res.json({
    ok: true,
    service: "printer-dashboard-backend",
    role: "printer_gateway_with_analytics",
    port: PORT,
    platform: process.platform,
    printers_file: PRINTERS_FILE,
    analytics_events_file: ANALYTICS_EVENTS_FILE,
    analytics_max_events: ANALYTICS_MAX_EVENTS,
    analytics_stale_telemetry_minutes: ANALYTICS_STALE_TELEMETRY_MINUTES,
    fiware_entity_url: FIWARE_ENTITY_URL,
    bridge_service: BRIDGE_SERVICE_NAME,
    auto_restart_on_save: AUTO_RESTART_BRIDGE_ON_SAVE,
    validate_mqtt_on_save: VALIDATE_MQTT_ON_SAVE,
    mqtt_validator_script: MQTT_VALIDATOR_SCRIPT,
    mqtt_validator_python: MQTT_VALIDATOR_PYTHON,
    mqtt_validation_timeout_seconds: MQTT_VALIDATION_TIMEOUT_SECONDS,
    access_health_cache_ms: ACCESS_HEALTH_CACHE_MS,
    bridge_status: bridgeStatus,
    peppi_removed: true,
    analytics_routes: {
      summary_7d: "/api/analytics/summary?range=7d",
      summary_30d: "/api/analytics/summary?range=30d",
      observe: "/api/analytics/observe",
    },
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Printer backend running on port ${PORT}`);
  console.log(`📄 Using printers file: ${PRINTERS_FILE}`);
  console.log(`📊 Analytics events file: ${ANALYTICS_EVENTS_FILE}`);
  console.log(`🔁 Bridge service: ${BRIDGE_SERVICE_NAME}`);
  console.log(`🔁 Auto restart on save: ${AUTO_RESTART_BRIDGE_ON_SAVE}`);
  console.log(`🔐 Validate MQTT on save: ${VALIDATE_MQTT_ON_SAVE}`);
  console.log(`🐍 MQTT validator python: ${MQTT_VALIDATOR_PYTHON}`);
  console.log(`🐍 MQTT validator script: ${MQTT_VALIDATOR_SCRIPT}`);
  console.log("📅 Peppi booking logic has been moved to separate backend");
  console.log("📊 Analytics routes enabled:");
  console.log("   GET  /api/analytics/summary?range=7d");
  console.log("   GET  /api/analytics/summary?range=30d");
  console.log("   POST /api/analytics/observe");
});