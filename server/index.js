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

const PORT = Number(process.env.PORT || 4000);
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_PRINTERS_FILE = path.join(__dirname, "data", "printers.json");
const PI_PRINTERS_FILE = "/home/fieldlab/Desktop/bambu-fiware/printers.json";

const PRINTERS_FILE =
  process.env.PRINTERS_FILE ||
  (fsSync.existsSync(PI_PRINTERS_FILE) ? PI_PRINTERS_FILE : LOCAL_PRINTERS_FILE);

const BRIDGE_SERVICE_NAME = process.env.BRIDGE_SERVICE_NAME || "bambu-bridge";
const AUTO_RESTART_BRIDGE_ON_SAVE =
  process.env.AUTO_RESTART_BRIDGE_ON_SAVE !== "false";

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
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  await fs.mkdir(dir, { recursive: true });

  if (fsSync.existsSync(filePath)) {
    const previous = await fs.readFile(filePath, "utf-8");
    await fs.writeFile(backupPath, previous, "utf-8");
  }

  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}

function normalizePrinter(input = {}, existing = {}) {
  return {
    id: String(input.id ?? existing.id ?? "").trim(),
    name: String(input.name ?? existing.name ?? "").trim(),
    ip: String(input.ip ?? existing.ip ?? "").trim(),
    access_code: String(
      input.access_code ?? existing.access_code ?? ""
    ).trim(),
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

function validatePrinter(printer, index) {
  const errors = [];

  if (!printer.id) errors.push(`Printer ${index + 1}: missing id`);
  if (!printer.name) errors.push(`Printer ${index + 1}: missing name`);
  if (!printer.ip) errors.push(`Printer ${index + 1}: missing ip`);
  if (!printer.access_code)
    errors.push(`Printer ${index + 1}: missing access_code`);
  if (!printer.serial) errors.push(`Printer ${index + 1}: missing serial`);

  return errors;
}

function mergePrinters(existingPrinters = [], incomingPrinters = []) {
  const existingMap = new Map(existingPrinters.map((p) => [p.id, p]));
  return incomingPrinters.map((incoming) => {
    const existing = existingMap.get(incoming.id) || {};
    return normalizePrinter(incoming, existing);
  });
}

function assertSafeServiceName(name) {
  if (!/^[a-zA-Z0-9_.@-]+$/.test(name)) {
    throw new Error(`Unsafe systemd service name: ${name}`);
  }
}

async function restartBridgeService() {
  if (process.platform !== "linux") {
    return {
      ok: true,
      skipped: true,
      message: "Restart skipped in local development (non-Linux platform)",
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
      message: "Bridge status unavailable in local development",
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
      raw: error?.stdout?.trim?.() || "",
      error: error?.stderr?.trim?.() || error.message,
    };
  }
}

/* =========================================================
   📅 SECTION 1 — PEPPI CALENDAR
   ========================================================= */

app.get("/api/peppi", async (_req, res) => {
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
      return res.status(502).json({
        ok: false,
        error: "Peppi request failed",
        details: text,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("GET /api/peppi failed:", err);
    res.status(500).json({
      ok: false,
      error: "Peppi request failed",
      details: err.message,
    });
  }
});

/* =========================================================
   🖨️ SECTION 2 — FIWARE PRINTER DATA
   ========================================================= */

app.get("/api/printers", async (_req, res) => {
  try {
    const response = await fetch(FIWARE_ENTITY_URL, {
      headers: getFiwareHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        ok: false,
        error: "FIWARE request failed",
        details: text,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("GET /api/printers failed:", err);
    res.status(500).json({
      ok: false,
      error: "FIWARE request failed",
      details: err.message,
    });
  }
});

/* =========================================================
   🚀 SECTION 3 — COMBINED DASHBOARD DATA
   ========================================================= */

app.get("/api/dashboard", async (_req, res) => {
  try {
    const printerRes = await fetch(FIWARE_ENTITY_URL, {
      headers: getFiwareHeaders(),
    });

    if (!printerRes.ok) {
      const text = await printerRes.text();
      return res.status(502).json({
        ok: false,
        error: "FIWARE request failed",
        details: text,
      });
    }

    const printers = await printerRes.json();

    const form = buildPeppiForm();
    const bookingRes = await fetch(PEPPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!bookingRes.ok) {
      const text = await bookingRes.text();
      return res.status(502).json({
        ok: false,
        error: "Booking request failed",
        details: text,
      });
    }

    const bookings = await bookingRes.json();

    res.json({ printers, bookings });
  } catch (err) {
    console.error("GET /api/dashboard failed:", err);
    res.status(500).json({
      ok: false,
      error: "Dashboard request failed",
      details: err.message,
    });
  }
});

/* =========================================================
   ⚙️ SECTION 4 — PRINTER CONFIG (SETTINGS PAGE)
   ========================================================= */

app.get("/api/printer-config", async (_req, res) => {
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
});

app.put("/api/printer-config", async (req, res) => {
  try {
    const body = req.body;

    if (!body || !Array.isArray(body.printers)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload. Expected { printers: [...] }",
      });
    }

    const currentConfig = await readPrintersFile();
    const mergedPrinters = mergePrinters(currentConfig.printers, body.printers);

    const duplicateIds = [];
    const seenIds = new Set();

    for (const printer of mergedPrinters) {
      if (seenIds.has(printer.id)) duplicateIds.push(printer.id);
      seenIds.add(printer.id);
    }

    const validationErrors = mergedPrinters.flatMap(validatePrinter);

    if (duplicateIds.length > 0) {
      validationErrors.push(
        `Duplicate printer ids: ${Array.from(new Set(duplicateIds)).join(", ")}`
      );
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    const payload = {
      ...currentConfig,
      ...body,
      fiware_endpoint:
        body.fiware_endpoint ||
        currentConfig.fiware_endpoint ||
        DEFAULT_FIWARE_ENDPOINT,
      printers: mergedPrinters,
      last_updated: new Date().toISOString(),
    };

    await writeJsonAtomic(PRINTERS_FILE, payload);

    let restart = {
      ok: true,
      skipped: true,
      message: "Auto-restart disabled",
    };

    if (AUTO_RESTART_BRIDGE_ON_SAVE) {
      try {
        restart = await restartBridgeService();
      } catch (restartError) {
        return res.status(500).json({
          ok: false,
          error: "Config saved but bridge restart failed",
          details: restartError.message,
          file: PRINTERS_FILE,
          last_updated: payload.last_updated,
        });
      }
    }

    res.json({
      ok: true,
      message: "Printer config updated successfully",
      file: PRINTERS_FILE,
      last_updated: payload.last_updated,
      restart,
    });
  } catch (err) {
    console.error("PUT /api/printer-config failed:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to update printer config",
      details: err.message,
      file: PRINTERS_FILE,
    });
  }
});

/* Optional future-friendly aliases */
app.get("/api/settings/printers", async (req, res) => {
  req.url = "/api/printer-config";
  app.handle(req, res);
});

app.put("/api/settings/printers", async (req, res) => {
  req.url = "/api/printer-config";
  app.handle(req, res);
});

/* =========================================================
   🔁 SECTION 5 — BRIDGE CONTROL
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
   ❤️ SECTION 6 — HEALTH
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
   🟢 START SERVER
   ========================================================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 Using printers file: ${PRINTERS_FILE}`);
  console.log(`🔁 Bridge service: ${BRIDGE_SERVICE_NAME}`);
});