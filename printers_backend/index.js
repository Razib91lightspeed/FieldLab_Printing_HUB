import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fsSync from "fs";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const app = express();
app.use(cors());
app.use(express.json());

const execAsync = promisify(exec);
const PORT = Number(process.env.PORT || 4000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_PRINTERS_FILE = path.join(__dirname, "data", "printers.json");
const PI_PRINTERS_FILE = "/home/fieldlab/Desktop/bambu-fiware/printers.json";

const PRINTERS_FILE =
  process.env.PRINTERS_FILE ||
  (fsSync.existsSync(PI_PRINTERS_FILE) ? PI_PRINTERS_FILE : LOCAL_PRINTERS_FILE);

const BRIDGE_SERVICE_NAME = process.env.BRIDGE_SERVICE_NAME || "bambu-bridge";
const AUTO_RESTART_BRIDGE_ON_SAVE =
  String(process.env.AUTO_RESTART_BRIDGE_ON_SAVE || "true").toLowerCase() === "true";

const FIWARE_ENTITY_URL =
  process.env.FIWARE_ENTITY_URL ||
  "http://172.16.101.172:1026/ngsi-ld/v1/entities?type=Printer";

const DEFAULT_FIWARE_ENDPOINT =
  process.env.DEFAULT_FIWARE_ENDPOINT ||
  "http://172.16.101.172:1026/ngsi-ld/v1/entities";

const PEPPI_URL =
  "https://peppi-utils.tuni.fi/tilakalenteri/bin/varaukset.cal.php";

/* =========================================================
   HELPERS
   ========================================================= */

function toPeppiDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function getPeppiRange(daysAhead = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  return {
    start: toPeppiDateTime(start),
    end: toPeppiDateTime(end),
  };
}

function buildPeppiForm() {
  const { start, end } = getPeppiRange(7);
  const form = new URLSearchParams();

  form.append("h[]", "3D tulostin_F0-16, Bambu A1");
  form.append("h[]", "3D tulostin_F0-16, Bambu A2");
  form.append("h[]", "3D tulostin_F0-16, Bambu A3");
  form.append("h[]", "3D tulostin_F0-16, Bambu A4");
  form.append("h[]", "3D tulostin_F0-16, Bambu A5 AMS");

  form.append("ta", "F-talo");
  form.append("taloIdx", "152");
  form.append("orgID", "tamk");
  form.append("start", start);
  form.append("end", end);

  return form;
}

function getFiwareHeaders() {
  return {
    Accept: "application/json",
    "fiware-service": "openiot",
    "fiware-servicepath": "/",
    Link:
      '<http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
  };
}

function assertSafeServiceName(name) {
  if (!/^[a-zA-Z0-9_.@-]+$/.test(name)) {
    throw new Error(`Unsafe systemd service name: ${name}`);
  }
}

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
    last_seen: input.last_seen ?? existing.last_seen ?? null,
    last_updated: new Date().toISOString(),
  };
}

function validatePrinter(printer, index = null) {
  const prefix =
    index === null ? `${printer.name || printer.id || "Printer"}` : `Printer ${index + 1}`;

  const errors = [];

  if (!printer.id) errors.push(`${prefix}: missing id`);
  if (!printer.name) errors.push(`${prefix}: missing name`);
  if (!printer.ip) errors.push(`${prefix}: missing ip`);
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(printer.ip)) {
    errors.push(`${prefix}: invalid ip`);
  }
  if (!printer.access_code) errors.push(`${prefix}: missing access_code`);
  if (!printer.serial) errors.push(`${prefix}: missing serial`);

  return errors;
}

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
    const { stdout } = await execAsync(`systemctl is-active ${BRIDGE_SERVICE_NAME}`);
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

async function fetchFiwarePrintersSafe() {
  try {
    const response = await fetch(FIWARE_ENTITY_URL, {
      headers: getFiwareHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        data: [],
        error: `FIWARE request failed: ${text}`,
      };
    }

    const data = await response.json();
    return {
      data,
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

async function fetchPeppiBookingsSafe() {
  try {
    const form = buildPeppiForm();

    const response = await fetch(PEPPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        data: [],
        error: `Peppi request failed: ${text}`,
      };
    }

    const data = await response.json();
    return {
      data,
      error: null,
    };
  } catch (err) {
    console.error("Peppi fetch failed:", err);
    return {
      data: [],
      error: err.message,
    };
  }
}

/* =========================================================
   SHARED CONFIG HANDLERS
   ========================================================= */

async function getPrinterConfigHandler(_req, res) {
  try {
    const config = await readPrintersFile();
    res.json(config);
  } catch (err) {
    console.error("GET /api/printer-config failed:", err);
    res.status(500).json({
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

      return merged;
    });

    const duplicateIds = [];
    const seen = new Set();

    for (const printer of printers) {
      if (seen.has(printer.id)) duplicateIds.push(printer.id);
      seen.add(printer.id);
    }

    if (duplicateIds.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Duplicate printer ids: ${Array.from(new Set(duplicateIds)).join(", ")}`,
      });
    }

    const payload = {
      ...currentConfig,
      ...body,
      fiware_endpoint:
        body.fiware_endpoint ||
        currentConfig.fiware_endpoint ||
        DEFAULT_FIWARE_ENDPOINT,
      printers,
      last_updated: new Date().toISOString(),
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

    const updatedPrinter = sanitizePrinter(
      {
        ...existing,
        ...(typeof ip === "string" ? { ip: ip.trim() } : {}),
        ...(typeof access_code === "string" ? { access_code: access_code.trim() } : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {}),
        is_pipeline_healthy: existing.is_pipeline_healthy,
        last_seen: existing.last_seen,
      },
      existing
    );

    const validationErrors = validatePrinter(updatedPrinter);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    config.printers[index] = updatedPrinter;
    config.last_updated = new Date().toISOString();

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
      restart,
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
   SECTION 1 — PEPPI CALENDAR
   ========================================================= */

app.get("/api/peppi", async (_req, res) => {
  const { data, error } = await fetchPeppiBookingsSafe();

  if (error) {
    console.error("GET /api/peppi failed:", error);
  }

  // Always return array for frontend compatibility
  return res.json(data);
});

/* =========================================================
   SECTION 2 — FIWARE PRINTER DATA
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
   SECTION 3 — DASHBOARD DATA
   ========================================================= */

app.get("/api/dashboard", async (_req, res) => {
  const fiwareResult = await fetchFiwarePrintersSafe();
  const peppiResult = await fetchPeppiBookingsSafe();

  if (fiwareResult.error && fiwareResult.data.length === 0) {
    return res.status(500).json({
      ok: false,
      error: "Dashboard request failed",
      details: {
        printersError: fiwareResult.error,
        bookingsError: peppiResult.error,
      },
    });
  }

  return res.json({
    ok: true,
    printers: fiwareResult.data,
    bookings: peppiResult.data,
    warnings: {
      printersError: fiwareResult.error,
      bookingsError: peppiResult.error,
    },
  });
});

/* =========================================================
   SECTION 4 — PRINTER CONFIG
   ========================================================= */

app.get("/api/printer-config", getPrinterConfigHandler);
app.put("/api/printer-config", putPrinterConfigHandler);
app.patch("/api/printer-config/:id", patchPrinterConfigHandler);

/* aliases for future/frontend flexibility */
app.get("/api/settings/printers", getPrinterConfigHandler);
app.put("/api/settings/printers", putPrinterConfigHandler);

/* =========================================================
   SECTION 5 — BRIDGE CONTROL
   ========================================================= */

app.post("/api/restart-bridge", async (_req, res) => {
  try {
    const result = await restartBridgeService();
    res.json(result);
  } catch (err) {
    console.error("POST /api/restart-bridge failed:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to restart bridge",
      details: err.message,
    });
  }
});

app.get("/api/bridge-status", async (_req, res) => {
  try {
    const status = await getBridgeStatus();
    res.json(status);
  } catch (err) {
    console.error("GET /api/bridge-status failed:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to get bridge status",
      details: err.message,
    });
  }
});

/* =========================================================
   SECTION 6 — HEALTH
   ========================================================= */

app.get("/api/health", async (_req, res) => {
  const bridgeStatus = await getBridgeStatus().catch(() => null);

  res.json({
    ok: true,
    port: PORT,
    platform: process.platform,
    printers_file: PRINTERS_FILE,
    bridge_service: BRIDGE_SERVICE_NAME,
    auto_restart_on_save: AUTO_RESTART_BRIDGE_ON_SAVE,
    bridge_status: bridgeStatus,
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 Using printers file: ${PRINTERS_FILE}`);
  console.log(`🔁 Bridge service: ${BRIDGE_SERVICE_NAME}`);
});