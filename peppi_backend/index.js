import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 5001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const CACHE_FILE = path.join(DATA_DIR, "peppi_cache.json");

const PEPPI_URL =
  process.env.PEPPI_URL ||
  "https://peppi-utils.tuni.fi/tilakalenteri/bin/varaukset.cal.php";

const DEFAULT_DAYS_AHEAD = Number(process.env.DAYS_AHEAD || 7);

const PEPPI_PRINTERS = [
  "3D tulostin_F0-16, Bambu A1",
  "3D tulostin_F0-16, Bambu A2",
  "3D tulostin_F0-16, Bambu A3",
  "3D tulostin_F0-16, Bambu A4",
  "3D tulostin_F0-16, Bambu A5 AMS",
];

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

function getPeppiRange(daysAhead = DEFAULT_DAYS_AHEAD) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  return {
    start: toPeppiDateTime(start),
    end: toPeppiDateTime(end),
  };
}

function buildPeppiForm(daysAhead = DEFAULT_DAYS_AHEAD) {
  const { start, end } = getPeppiRange(daysAhead);
  const form = new URLSearchParams();

  for (const printerName of PEPPI_PRINTERS) {
    form.append("h[]", printerName);
  }

  form.append("ta", "F-talo");
  form.append("taloIdx", "152");
  form.append("orgID", "tamk");
  form.append("start", start);
  form.append("end", end);

  return form;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeCache(payload) {
  await ensureDataDir();

  const cachePayload = {
    updated_at: new Date().toISOString(),
    source: "peppi",
    ...payload,
  };

  await fs.writeFile(CACHE_FILE, JSON.stringify(cachePayload, null, 2), "utf-8");
  return cachePayload;
}

async function readCache() {
  if (!fsSync.existsSync(CACHE_FILE)) {
    return null;
  }

  const raw = await fs.readFile(CACHE_FILE, "utf-8");
  return JSON.parse(raw);
}

async function fetchPeppiBookings(daysAhead = DEFAULT_DAYS_AHEAD) {
  const form = buildPeppiForm(daysAhead);

  const response = await fetch(PEPPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Peppi request failed with ${response.status}: ${text}`);
  }

  const data = await response.json();

  const cachePayload = await writeCache({
    ok: true,
    days_ahead: daysAhead,
    printers: PEPPI_PRINTERS,
    bookings: Array.isArray(data) ? data : [],
  });

  return cachePayload;
}

/* =========================================================
   ROUTES
   ========================================================= */

app.get("/api/health", async (_req, res) => {
  const cacheExists = fsSync.existsSync(CACHE_FILE);

  res.json({
    ok: true,
    service: "peppi_backend",
    port: PORT,
    peppi_url: PEPPI_URL,
    default_days_ahead: DEFAULT_DAYS_AHEAD,
    cache_file: CACHE_FILE,
    cache_exists: cacheExists,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/peppi", async (req, res) => {
  const daysAhead = Number(req.query.days || DEFAULT_DAYS_AHEAD);

  try {
    const result = await fetchPeppiBookings(daysAhead);

    return res.json({
      ok: true,
      source: "live",
      updated_at: result.updated_at,
      days_ahead: result.days_ahead,
      bookings: result.bookings,
      printers: result.printers,
      warning: null,
    });
  } catch (err) {
    console.error("GET /api/peppi failed:", err.message);

    const cached = await readCache();

    if (cached) {
      return res.json({
        ok: true,
        source: "cache",
        updated_at: cached.updated_at,
        days_ahead: cached.days_ahead,
        bookings: cached.bookings || [],
        printers: cached.printers || PEPPI_PRINTERS,
        warning: `Live Peppi request failed. Showing cached data. Details: ${err.message}`,
      });
    }

    return res.status(500).json({
      ok: false,
      source: "none",
      error: "Failed to fetch Peppi bookings and no cache is available",
      details: err.message,
      bookings: [],
    });
  }
});

app.get("/api/peppi/cache", async (_req, res) => {
  const cached = await readCache();

  if (!cached) {
    return res.status(404).json({
      ok: false,
      error: "No Peppi cache found yet",
      bookings: [],
    });
  }

  return res.json({
    ok: true,
    source: "cache",
    ...cached,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Peppi backend running on port ${PORT}`);
  console.log(`📄 Cache file: ${CACHE_FILE}`);
});