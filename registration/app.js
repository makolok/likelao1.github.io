const STORAGE_KEY = "lao_driving_exam_rows_v2";
const CLOUD_URL_STORAGE_KEY = "lao_driving_exam_cloud_url_v1";
// หากต้องการให้ทุกเครื่องเชื่อมต่ออัตโนมัติโดยไม่ต้องวาง URL เอง สามารถใส่ลิงก์ Firebase Realtime DB ตรงนี้ได้เลย
const DEFAULT_CLOUD_SYNC_URL = "https://likelao1-96736.firebaseio.com/";
// ใส่ลิงก์ Web App URL ที่ได้จาก Google Apps Script ตรงนี้
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxkoZDs4MJiCIO6ZCLzyvmcQ4FyJ4g6TyjzpLPFcSlaKrnzThMNIFb1zhrcWgti-XNn/exec";
const PRINT_PAGE_URL = "petition_form.html";

const DEFAULT_NATIONALITY = "ລາວ / LAO";
const DEFAULT_SCHOOL_NAME = "ຮຮ.ສອນຂັບລົດບ້ານສາມັກຄີ";
const DEFAULT_OTHER_INFO = "ສອບເສັງໃໝ່";
const DEFAULT_INITIAL_STUDENT_CODE = "S500";
const BATCH_SET_MIN = 14;
const BATCH_SET_MAX = 30;
const PAUSE_GAP_MS = 800; // หยุดพักเกิน 0.8 วินาที ถือว่าขึ้นคำ/ส่วนใหม่
const SYNC_INTERVAL_MS = 2500; // ดึงข้อมูลล่าสุดทุก 2.5 วินาที

const REQUIRED_FORM_FIELDS = [
  { key: "examDate", inputId: "examDate", label: "ວັນ​ທີ່​ຂໍ​ເສັງ (วันขอสอบ)" },
  { key: "studentCode", inputId: "studentCode", label: "ລະ​ຫັດ​ນັກ​ຮຽນ (รหัสนักเรียน)" },
  { key: "laoName", inputId: "laoName", label: "ຊື່ພາສາລາວ (ชื่อภาษาลาว)" },
  { key: "enName", inputId: "enName", label: "Name&Surname (ชื่อภาษาอังกฤษ)" },
  { key: "birthDate", inputId: "birthDate", label: "ເກີດວັນ/ເດືອນ/ປີ (วันเกิด)" },
  { key: "birthVillage", inputId: "birthVillage", label: "ເກີດຢູ່ ບ້ານ (บ้านเกิด)" },
  { key: "district", inputId: "district", label: "ເມືອງ (เมือง)" },
  { key: "province", inputId: "province", label: "ແຂວງ (แขวง)" },
  { key: "nationality", inputId: "nationality", label: "ສັນຊາດ (สัญชาติ)" },
  { key: "occupation", inputId: "occupation", label: "ອາຊີບ (อาชีพ)" },
  { key: "batchSet", inputId: "batchSet", label: "ຊຸດ (ชุด)" },
  { key: "phone", inputId: "phone", label: "ໂທລະສັບ (โทรศัพท์)" },
  { key: "licenseType", inputId: "licenseType", label: "ປະ​ເພດ (ประเภทใบขับขี่)" }
];

function validateRequiredFormFields(data) {
  const missing = [];
  for (const f of REQUIRED_FORM_FIELDS) {
    const val = String(data[f.key] ?? "").trim();
    if (!val) {
      missing.push(f);
    }
  }
  return missing;
}

let rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let cloudSyncUrl = (localStorage.getItem(CLOUD_URL_STORAGE_KEY) || DEFAULT_CLOUD_SYNC_URL || "").trim();
let syncTimerId = null;
let isSyncBusy = false;
let connectionState = cloudSyncUrl ? "connecting" : "connecting"; // "online" | "connecting" | "offline"
let lastSyncedAtText = "";

let activeRecognition = null;
let activeButton = null;
let activeInputId = null;
let lastResultTimeByInput = {};
let isNewSessionByInput = {};

let tableSearchKeyword = "";

populateBatchSetOptions();
bindLaoNameAutoSpacing();
initCloudSyncUI();
initStudentCodeField(true);
initFixedFields();
renderTable();
startCloudSyncLoop();

function openPrintPage(selectedIndex = null) {
  stopVoice();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch (_) {}

  let targetUrl = PRINT_PAGE_URL;
  if (typeof selectedIndex === "number" && selectedIndex >= 0 && selectedIndex < rows.length) {
    const r = rows[selectedIndex];
    const params = new URLSearchParams();
    params.set("index", String(selectedIndex));
    if (r && r.studentCode) {
      params.set("code", String(r.studentCode));
    }
    targetUrl = `${PRINT_PAGE_URL}?${params.toString()}`;
  }
  window.location.href = targetUrl;
}

// สร้างตัวเลือกดรอปดาวน์ ຊຸດ ตั้งแต่ 14 ถึง 30 อัตโนมัติ (หากยังไม่มีใน HTML)
function populateBatchSetOptions() {
  const selectEl = document.getElementById("batchSet");
  if (!selectEl) return;

  const existingValues = new Set(Array.from(selectEl.options).map((opt) => opt.value));
  for (let n = BATCH_SET_MIN; n <= BATCH_SET_MAX; n++) {
    const val = String(n);
    if (!existingValues.has(val)) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    }
  }
}

function initFixedFields() {
  const schoolEl = document.getElementById("schoolName");
  if (schoolEl) {
    schoolEl.value = DEFAULT_SCHOOL_NAME;
  }

  const otherEl = document.getElementById("otherInfo");
  if (otherEl) {
    otherEl.value = DEFAULT_OTHER_INFO;
  }
}

function normalizeFirebaseEndpoint(rawUrl) {
  const clean = String(rawUrl || "").trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith(".json")) return clean;
  return `${clean}/driving_exam_students.json`;
}

function initCloudSyncUI() {
  const urlInput = document.getElementById("cloudSyncUrlInput");
  if (urlInput && cloudSyncUrl) {
    urlInput.value = cloudSyncUrl;
  }
  updateSyncStatusLabel();
}

function formatCurrentClockTime() {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

function setConnectionIndicator(state, badgeText) {
  connectionState = state;
  const dotEl = document.getElementById("connectionDot");
  const badgeEl = document.getElementById("connectionBadge");

  if (dotEl) {
    dotEl.classList.remove("online", "connecting", "offline");
    dotEl.classList.add(state);
  }
  if (badgeEl) {
    badgeEl.classList.remove("online", "connecting", "offline");
    badgeEl.classList.add(state);
    badgeEl.textContent = badgeText;
  }
}

function updateSyncStatusLabel(extraNote = "", forcedState = null, forcedBadgeText = null) {
  const summaryEl = document.getElementById("connectionSummaryText");
  const statusEl = document.getElementById("syncStatusText");
  const countLabelEl = document.getElementById("totalStudentsCountLabel");
  const nextCodePreview = computeNextGlobalStudentCode();

  if (countLabelEl) {
    countLabelEl.textContent = `ລາຍຊື່ນັກຮຽນທັງໝົດ: ${rows.length} ຄົນ (ລະຫັດຖັດໄປ: ${nextCodePreview})`;
  }

  if (forcedState) {
    setConnectionIndicator(forcedState, forcedBadgeText || "");
  } else if (!cloudSyncUrl) {
    setConnectionIndicator("connecting", "ໂໝດໃນເຄື່ອງ");
  } else if (connectionState === "online") {
    setConnectionIndicator("online", "ເຊື່ອມຕໍ່ສຳເລັດ");
  } else if (connectionState === "offline") {
    setConnectionIndicator("offline", "ເຊື່ອມຕໍ່ບໍ່ໄດ້");
  } else {
    setConnectionIndicator("connecting", "ກຳລັງເຊື່ອມຕໍ່");
  }

  let modeText = "🟡 ໂໝດໃນເຄື່ອງ (Local)";
  if (cloudSyncUrl) {
    if (connectionState === "online") {
      modeText = "🟢 ເຊື່ອມຕໍ່ສຳເລັດ (Real-time)";
    } else if (connectionState === "offline") {
      modeText = "🔴 ເຊື່ອມຕໍ່ບໍ່ໄດ້ / ອິນເຕີເນັດມີບັນຫາ";
    } else {
      modeText = "🟡 ກຳລັງເຊື່ອມຕໍ່...";
    }
  }

  const timeInfo = lastSyncedAtText ? ` | ເຊື່ອມຕໍ່ລ່າສູດ: ${lastSyncedAtText}` : "";
  const fullText = `${modeText} | ທັງໝົດ: ${rows.length} ຄົນ | ລະຫັດຖັດໄປ: ${nextCodePreview}${timeInfo}${extraNote ? ` (${extraNote})` : ""}`;

  if (summaryEl) {
    summaryEl.textContent = fullText;
  } else if (statusEl) {
    statusEl.textContent = fullText;
  }
}

function saveCloudSyncUrl() {
  const urlInput = document.getElementById("cloudSyncUrlInput");
  const raw = urlInput ? urlInput.value.trim() : "";
  cloudSyncUrl = raw;
  if (raw) {
    localStorage.setItem(CLOUD_URL_STORAGE_KEY, raw);
    connectionState = "connecting";
    updateSyncStatusLabel("ກຳລັງເຊື່ອມຕໍ່...", "connecting", "ກຳລັງເຊື່ອມຕໍ່");
    pullRowsFromCloud(true);
  } else {
    localStorage.removeItem(CLOUD_URL_STORAGE_KEY);
    connectionState = "connecting";
    updateSyncStatusLabel("ປິດການຊິງຄ໌ອອນລາຍ", "connecting", "ໂໝດໃນເຄື່ອງ");
  }
}

function manualRefreshFromCloud() {
  if (!cloudSyncUrl) {
    initStudentCodeField(true);
    renderTable();
    updateSyncStatusLabel("ອັບເດດແລ້ວ", "connecting", "ໂໝດໃນເຄື່ອງ");
    return;
  }
  updateSyncStatusLabel("ກຳລັງກວດສອບ...", "connecting", "ກຳລັງເຊື່ອມຕໍ່");
  pullRowsFromCloud(true);
}

function startCloudSyncLoop() {
  if (syncTimerId) {
    clearInterval(syncTimerId);
  }
  if (cloudSyncUrl) {
    pullRowsFromCloud(true);
  }
  syncTimerId = setInterval(() => {
    if (cloudSyncUrl && !isSyncBusy) {
      pullRowsFromCloud(false);
    }
  }, SYNC_INTERVAL_MS);
}

function normalizeCloudRowsPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }
  if (typeof payload === "object") {
    return Object.values(payload).filter((item) => item && typeof item === "object");
  }
  return [];
}

function sortRowsByStudentCode(list) {
  return [...list].sort((a, b) => {
    const pa = parseStudentCodeParts(a.studentCode);
    const pb = parseStudentCodeParts(b.studentCode);
    if (pa && pb && pa.prefix.toUpperCase() === pb.prefix.toUpperCase()) {
      return pa.num - pb.num;
    }
    return String(a.studentCode || "").localeCompare(String(b.studentCode || ""));
  });
}

async function pullRowsFromCloud(forceUpdateInput = false) {
  const endpoint = normalizeFirebaseEndpoint(cloudSyncUrl);
  if (!endpoint) return;

  if (connectionState !== "online") {
    setConnectionIndicator("connecting", "ກຳລັງເຊື່ອມຕໍ່");
  }

  isSyncBusy = true;
  try {
    const res = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const remoteRows = sortRowsByStudentCode(normalizeCloudRowsPayload(data));

    const prevJson = JSON.stringify(rows);
    const nextJson = JSON.stringify(remoteRows);
    const hasChanged = prevJson !== nextJson;

    rows = remoteRows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    lastSyncedAtText = formatCurrentClockTime();
    connectionState = "online";
    renderTable();

    const codeInput = document.getElementById("studentCode");
    const currentInputVal = codeInput ? codeInput.value.trim() : "";
    const shouldRefreshCode =
      forceUpdateInput ||
      !currentInputVal ||
      isDuplicateStudentCode(currentInputVal);

    if (shouldRefreshCode) {
      initStudentCodeField(true);
    }

    updateSyncStatusLabel(hasChanged ? "ອັບເດດໃໝ່" : "ເຊື່ອມຕໍ່ປົກກະຕິ", "online", "ເຊື່ອມຕໍ່ສຳເລັດ");
  } catch (err) {
    connectionState = "offline";
    updateSyncStatusLabel(`ເຊື່ອມຕໍ່ຂັດຂ້ອງ (ໃຊ້ຂໍ້ມູນໃນເຄື່ອງຊົ່ວຄາວ): ${err.message}`, "offline", "ເຊື່ອມຕໍ່ບໍ່ໄດ້");
  } finally {
    isSyncBusy = false;
  }
}

async function pushRowToCloud(rowData) {
  const endpoint = normalizeFirebaseEndpoint(cloudSyncUrl);
  if (!endpoint) return;

  const baseUrl = endpoint.replace(/\.json$/, "");
  const safeKey = normalizeCodeKey(rowData.studentCode).replace(/[^A-Z0-9_-]/g, "") || `ROW_${Date.now()}`;
  const itemEndpoint = `${baseUrl}/${safeKey}.json`;

  const res = await fetch(itemEndpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rowData)
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  lastSyncedAtText = formatCurrentClockTime();
  connectionState = "online";
  updateSyncStatusLabel("ບັນທຶກຂຶ້ນຄລາວສຳເລັດ", "online", "ເຊື່ອມຕໍ່ສຳເລັດ");
}

// ส่งข้อมูลนักเรียนไปเก็บใน Google Sheets ผ่าน Google Apps Script Web App
async function pushRowToGoogleSheet(rowData) {
  const sheetUrl = String(GOOGLE_SHEET_WEB_APP_URL || "").trim();
  if (!sheetUrl) return;

  await fetch(sheetUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rowData)
  });
}

async function clearCloudDatabase() {
  const endpoint = normalizeFirebaseEndpoint(cloudSyncUrl);
  if (!endpoint) return;
  const res = await fetch(endpoint, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  lastSyncedAtText = formatCurrentClockTime();
  connectionState = "online";
  updateSyncStatusLabel("ລ້າງຂໍ້ມູນອອນລາຍແລ້ວ", "online", "ເຊື່ອມຕໍ່ສຳເລັດ");
}

function normalizeCodeKey(codeStr) {
  return String(codeStr || "").trim().toUpperCase();
}

function isDuplicateStudentCode(codeStr) {
  const target = normalizeCodeKey(codeStr);
  if (!target) return false;
  return rows.some((r) => normalizeCodeKey(r.studentCode) === target);
}

// แยกส่วนประกอบของรหัส เช่น S500 -> { prefix: "S", num: 500, padLength: 3, suffix: "" }
function parseStudentCodeParts(codeStr) {
  const raw = String(codeStr || "").trim();
  const match = raw.match(/^(.*?)(\d+)([^\d]*)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    num: Number(match[2]),
    padLength: match[2].length,
    suffix: match[3]
  };
}

function formatCodeWithParts(parts, numValue) {
  const numText = String(Math.max(0, numValue)).padStart(parts.padLength, "0");
  return `${parts.prefix}${numText}${parts.suffix}`;
}

// หารหัสที่มากที่สุดจากทุกรายการในระบบ (เช่น มี S500, S501, S502 -> จะได้ S503 ทันที)
function computeNextGlobalStudentCode(baseCodeStr = DEFAULT_INITIAL_STUDENT_CODE) {
  const defaultParts = parseStudentCodeParts(baseCodeStr || DEFAULT_INITIAL_STUDENT_CODE);
  if (!defaultParts) return DEFAULT_INITIAL_STUDENT_CODE;

  if (!rows || rows.length === 0) {
    return formatCodeWithParts(defaultParts, defaultParts.num);
  }

  let maxNum = defaultParts.num - 1;
  let activeParts = defaultParts;

  for (const r of rows) {
    const p = parseStudentCodeParts(r.studentCode);
    if (!p) continue;
    if (p.prefix.toUpperCase() === defaultParts.prefix.toUpperCase() && p.num > maxNum) {
      maxNum = p.num;
      activeParts = p;
    }
  }

  let candidateNum = maxNum + 1;
  for (let i = 0; i < 10000; i++) {
    const candidateCode = formatCodeWithParts(activeParts, candidateNum);
    if (!isDuplicateStudentCode(candidateCode)) {
      return candidateCode;
    }
    candidateNum += 1;
  }

  return formatCodeWithParts(activeParts, maxNum + 1);
}

// ค้นหารหัสที่ยังไม่มีในระบบ โดยเริ่มบวกจากรหัสอ้างอิงขึ้นไปทีละขั้นจนกว่าจะเจอเลขที่ว่าง
function findNextAvailableStudentCode(baseCodeStr) {
  const globalNext = computeNextGlobalStudentCode(baseCodeStr);
  const parts = parseStudentCodeParts(baseCodeStr || DEFAULT_INITIAL_STUDENT_CODE);
  const globalParts = parseStudentCodeParts(globalNext);

  if (parts && globalParts && parts.prefix.toUpperCase() === globalParts.prefix.toUpperCase()) {
    const startNum = Math.max(parts.num + 1, globalParts.num);
    for (let i = 0; i < 10000; i++) {
      const candidateCode = formatCodeWithParts(globalParts, startNum + i);
      if (!isDuplicateStudentCode(candidateCode)) {
        return candidateCode;
      }
    }
  }

  return globalNext;
}

// ตั้งค่ารหัสเริ่มต้นอัตโนมัติในช่อง ລະຫັດນັກຮຽນ โดยอิงจากรหัสล่าสุดที่ว่างจริง
function initStudentCodeField(forceOverwrite = false) {
  const inputEl = document.getElementById("studentCode");
  if (!inputEl) return;

  const nextFreeCode = computeNextGlobalStudentCode(DEFAULT_INITIAL_STUDENT_CODE);
  if (forceOverwrite || !inputEl.value.trim() || isDuplicateStudentCode(inputEl.value)) {
    inputEl.value = nextFreeCode;
  }
}

function stopVoice() {
  if (activeRecognition) {
    try {
      activeRecognition.abort();
    } catch (_) {}
    activeRecognition = null;
  }
  if (activeButton) {
    activeButton.textContent = activeButton.dataset.origText || "🎤 ເວົ້າລາວ";
    activeButton = null;
  }
  activeInputId = null;
}

// พจนานุกรมคำ/พยางค์ภาษาลาว -> อังกฤษคาราโอเกะ (เพิ่มคำที่เจอบ่อยได้ตรงนี้)
const LAO_KARAOKE_DICT = {
  "ສົມ": "SOM",
  "ໃຈ": "JAI",
  "ໄຊ": "XAI",
  "ບຸນ": "BOUN",
  "ທັນ": "THAN",
  "ທະວີ": "THAVY",
  "ວີ": "VI",
  "ຄຳ": "KHAM",
  "ພອນ": "PHON",
  "ແກ້ວ": "KEO",
  "ສຸກ": "SOUK",
  "ສີ": "SY",
  "ວົງ": "VONG",
  "ໄຊຍະວົງ": "XAYAVONG",
  "ພົມມະຫາ": "PHOMMAHA",
  "ຈັນ": "CHAN",
  "ທະ": "THA",
  "ກຸນ": "KOUN",
  "ລາວ": "LAO"
};

// ตารางแปลงตัวอักษรลาวเป็นคาราโอเกะแบบเบื้องต้น (เมื่อไม่อยู่ในพจนานุกรม)
const LAO_TO_KARAOKE_MAP = {
  "ກ": "K",
  "ຂ": "KH",
  "ຄ": "KH",
  "ງ": "NG",
  "ຈ": "CH",
  "ສ": "S",
  "ຊ": "X",
  "ຍ": "NY",
  "ດ": "D",
  "ຕ": "T",
  "ຖ": "TH",
  "ທ": "TH",
  "ນ": "N",
  "ບ": "B",
  "ປ": "P",
  "ຜ": "PH",
  "ຝ": "F",
  "ພ": "PH",
  "ຟ": "F",
  "ມ": "M",
  "ຢ": "Y",
  "ຣ": "R",
  "ລ": "L",
  "ວ": "V",
  "ຫ": "H",
  "ອ": "",
  "ຮ": "H",

  // สระและวรรณยุกต์หลัก
  "ະ": "A",
  "າ": "A",
  "ິ": "I",
  "ີ": "I",
  "ຶ": "UE",
  "ື": "UE",
  "ຸ": "OU",
  "ູ": "OU",
  "ເ": "E",
  "ແ": "AE",
  "ໂ": "O",
  "ໄ": "AI",
  "ໃ": "AI",
  "ຳ": "AM",
  "ົ": "O",
  "ຽ": "IA",
  "ັ": "A",
  "່": "",
  "້": "",
  "໊": "",
  "໋": "",
  "໌": "",
  "ໆ": ""
};

// แปลงคำอ่านตัวเลขลาว/ไทย/อังกฤษเป็นตัวเลข 0-9
function wordsToNumberDigits(text) {
  let s = String(text || "").trim().toLowerCase();
  if (!s) return "";

  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
  s = s.replace(/[๐-๙]/g, (d) => String(thaiDigits.indexOf(d)));

  const replacements = [
    [/ສອງພັນ/g, "2000 "],
    [/ຫນຶ່ງພັນ/g, "1000 "],
    [/หนึ่งพัน/g, "1000 "],
    [/สองพัน/g, "2000 "],
    [/ຊາວເອັດ|ຊາວໜຶ່ງ/g, "21 "],
    [/ยี่สิบเอ็ด/g, "21 "],
    [/ຊາວ/g, "20 "],
    [/ยี่สิบ/g, "20 "],
    [/ສາມສິບ/g, "30 "],
    [/สามสิบ/g, "30 "],
    [/ສິບເອັດ/g, "11 "],
    [/สิบเอ็ด/g, "11 "],
    [/ສິບສອງ/g, "12 "],
    [/สิบสอง/g, "12 "],
    [/ສິບ/g, "10 "],
    [/สิบ/g, "10 "],
    [/ຮ້ອຍ/g, "00 "],
    [/ร้อย/g, "00 "],
    [/ສູນ|ศูนย์|zero/g, "0 "],
    [/ໜຶ່ງ|ຫນຶ່ງ|หนึ่ง|one/g, "1 "],
    [/ສອງ|สอง|two/g, "2 "],
    [/ສາມ|สาม|three/g, "3 "],
    [/ສີ່|สี่|four/g, "4 "],
    [/ຫ້າ|ห้า|five/g, "5 "],
    [/ຫົກ|หก|six/g, "6 "],
    [/ເຈັດ|เจ็ด|seven/g, "7 "],
    [/ແປດ|แปด|eight/g, "8 "],
    [/ເກົ້າ|เก้า|nine/g, "9 "]
  ];

  for (const [pattern, val] of replacements) {
    s = s.replace(pattern, val);
  }

  return s;
}

// แยกกลุ่มตัวเลขจากข้อความ เพื่อจัดเป็นรูปแบบ วัน/เดือน/ปี (DD/MM/YYYY)
function extractDateSegments(rawText) {
  const converted = wordsToNumberDigits(rawText)
    .replace(/[\/\-.,\\]+/g, " ")
    .replace(/[^0-9\s]/g, " ")
    .trim();

  if (!converted) return [];

  const tokens = converted.split(/\s+/).filter(Boolean);
  const segments = [];

  for (const tok of tokens) {
    if (/^\d{8}$/.test(tok)) {
      segments.push(tok.slice(0, 2), tok.slice(2, 4), tok.slice(4, 8));
    } else if (/^\d{6}$/.test(tok)) {
      segments.push(tok.slice(0, 2), tok.slice(2, 4), `20${tok.slice(4, 6)}`);
    } else {
      segments.push(tok);
    }
  }

  return segments;
}

function pad2(numStr) {
  const clean = String(numStr || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.length === 1 ? `0${clean}` : clean.slice(0, 2);
}

function normalizeYear(yearStr) {
  const clean = String(yearStr || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 2) {
    const n = Number(clean);
    return n >= 50 ? `25${clean}` : `20${clean}`;
  }
  return clean.slice(0, 4);
}

// จัดรูปแบบวันที่ให้มี / คั่นระหว่าง วัน/เดือน/ปี เช่น 12/11/2026
function formatDateWithSlash(text) {
  const segs = extractDateSegments(text);
  if (segs.length === 0) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  if (segs.length === 1) {
    return segs[0].length <= 2 ? pad2(segs[0]) : segs[0];
  }

  if (segs.length === 2) {
    return `${pad2(segs[0])}/${pad2(segs[1])}`;
  }

  const day = pad2(segs[0]);
  const month = pad2(segs[1]);
  const year = normalizeYear(segs[2]);
  const rest = segs.slice(3).map((x) => x.trim()).filter(Boolean);

  const base = year ? `${day}/${month}/${year}` : `${day}/${month}`;
  return rest.length > 0 ? `${base}/${rest.join("/")}` : base;
}

// จัดรูปแบบชื่อภาษาลาวให้เว้นวรรคสวย ไม่ซ้ำช่องว่าง และแยกคำนำหน้า (ท้าว/นาง/ທ້າວ/ນາງ) ออกจากชื่ออัตโนมัติ
function formatLaoNameSpacing(text) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  s = s.replace(/^(ท้าว|นาง|ທ້າວ|ນາງ)(?=\S)/g, "$1 ");
  s = s.replace(/^(ທ\.|ນ\.)(?=\S)/g, "$1 ");
  s = s.replace(/(\s|^)(ท้าว|นาง|ທ້າວ|ນາງ)(?=[^\s])/g, "$1$2 ");

  return s.replace(/\s+/g, " ").trim();
}

function bindLaoNameAutoSpacing() {
  const laoEl = document.getElementById("laoName");
  if (!laoEl) return;

  laoEl.addEventListener("input", () => {
    const start = laoEl.selectionStart;
    const before = laoEl.value;
    const formatted = formatLaoNameSpacing(before);
    if (formatted !== before) {
      laoEl.value = formatted;
      if (typeof start === "number") {
        const diff = formatted.length - before.length;
        const nextPos = Math.max(0, start + diff);
        laoEl.setSelectionRange(nextPos, nextPos);
      }
    }
    syncEnglishNameFromLaoInput(laoEl.value);
  });

  laoEl.addEventListener("blur", () => {
    laoEl.value = formatLaoNameSpacing(laoEl.value);
    syncEnglishNameFromLaoInput(laoEl.value);
  });
}

// ตรวจจับคำนำหน้าเพศจากเสียงพูด (รองรับทั้งลาว/ไทย/อังกฤษ)
function detectTitlePrefix(rawText) {
  const s = String(rawText || "").trim().toLowerCase();
  if (!s) return null;

  const malePatterns = [
    /^ท้าว\b/,
    /^ผู้ชาย\b/,
    /^มิสเตอร์\b/,
    /^mr\.?\b/,
    /ທ້າວ/i,
    /ຜູ້ຊາຍ/i
  ];
  if (malePatterns.some((re) => re.test(s))) {
    return "Mr.";
  }

  const femalePatterns = [
    /^นาง\b/,
    /^ผู้หญิง\b/,
    /^มิส\b/,
    /^ms\.?\b/,
    /ນາງ/i,
    /ຜູ້ຍິງ/i
  ];
  if (femalePatterns.some((re) => re.test(s))) {
    return "Ms.";
  }

  return null;
}

// ตัดคำนำหน้าออกจากข้อความก่อนนำไปถอดเป็นคาราโอเกะ
function stripTitleWords(rawText) {
  return String(rawText || "")
    .replace(/\b(mr\.?|ms\.?|mrs\.?|miss)\b/gi, " ")
    .replace(/(ท้าว|นาง|ผู้ชาย|ผู้หญิง|มิสเตอร์|มิส|ທ້າວ|ນາງ|ຜູ້ຊາຍ|ຜູ້ຍິງ)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// แปลงคำภาษาลาวที่พูด -> ตัวอักษรคาราโอเกะตัวพิมพ์ใหญ่เบื้องต้น
function laoToKaraokeRawUpper(laoText) {
  const cleaned = String(laoText || "").trim();
  if (!cleaned) return "";

  const words = cleaned.split(/\s+/);
  const convertedWords = words.map((word) => {
    if (/^(mr\.?|ms\.?)$/i.test(word)) {
      return word.toUpperCase();
    }

    if (LAO_KARAOKE_DICT[word]) {
      return LAO_KARAOKE_DICT[word];
    }

    let result = "";
    let i = 0;

    while (i < word.length) {
      let matchedDict = null;

      for (let len = Math.min(6, word.length - i); len >= 2; len--) {
        const sub = word.slice(i, i + len);
        if (LAO_KARAOKE_DICT[sub]) {
          matchedDict = { value: LAO_KARAOKE_DICT[sub], step: len };
          break;
        }
      }

      if (matchedDict) {
        result += matchedDict.value;
        i += matchedDict.step;
        continue;
      }

      const ch = word[i];
      if (Object.prototype.hasOwnProperty.call(LAO_TO_KARAOKE_MAP, ch)) {
        result += LAO_TO_KARAOKE_MAP[ch];
      } else if (/[A-Za-z0-9.]/.test(ch)) {
        result += ch.toUpperCase();
      }
      i += 1;
    }

    return result;
  });

  return convertedWords
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function toTitleCaseWord(word) {
  const w = String(word || "").trim();
  if (!w) return "";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function formatKaraokeNameByRule(text, forcedPrefix = null) {
  let upper = laoToKaraokeRawUpper(text);
  if (!upper) {
    return forcedPrefix ? `${forcedPrefix} ` : "";
  }

  let prefix = null;
  const prefixMatch = upper.match(/^(MR\.|MS\.)(?:\s+|$)/i);
  if (prefixMatch) {
    prefix = prefixMatch[1].toLowerCase() === "mr." ? "Mr." : "Ms.";
    upper = upper.replace(/^(MR\.|MS\.)(?:\s+|$)/i, "").trim();
  }

  upper = upper.replace(/\b(MR\.|MS\.)\b/gi, " ").replace(/\s+/g, " ").trim();

  const finalPrefix = forcedPrefix || prefix;
  const nameTokens = upper ? upper.split(/\s+/).filter(Boolean) : [];

  if (nameTokens.length === 0) {
    return finalPrefix ? `${finalPrefix} ` : "";
  }

  const firstName = toTitleCaseWord(nameTokens[0]);
  const lastNames = nameTokens.slice(1).map((t) => t.toUpperCase());

  const parts = [];
  if (finalPrefix) parts.push(finalPrefix);
  parts.push(firstName);
  if (lastNames.length > 0) parts.push(lastNames.join(" "));

  return parts.join(" ");
}

function isDateField(inputId) {
  return inputId === "examDate" || inputId === "birthDate";
}

// แปลงข้อความที่พูดเป็นรูปแบบคาราโอเกะสำหรับช่อง Name&Surname (enName)
function applyKaraokeToElement(el, newPart, options = {}) {
  if (!el) return;
  const {
    elapsed = Infinity,
    startedNewSession = false,
    resetExisting = false
  } = options;

  const detectedPrefix = detectTitlePrefix(newPart);
  const namePartRaw = stripTitleWords(newPart);
  const convertedPart = laoToKaraokeRawUpper(namePartRaw);
  const currentUpper = resetExisting ? "" : laoToKaraokeRawUpper(el.value);

  if (!currentUpper) {
    el.value = formatKaraokeNameByRule(convertedPart, detectedPrefix);
    return;
  }

  const shouldInsertSpace = startedNewSession || elapsed >= PAUSE_GAP_MS;
  const mergedUpper = convertedPart
    ? (shouldInsertSpace ? `${currentUpper} ${convertedPart}` : `${currentUpper}${convertedPart}`)
    : currentUpper;

  el.value = formatKaraokeNameByRule(mergedUpper, detectedPrefix);
}

// อัปเดตชื่อภาษาอังกฤษ (enName) จากชื่อภาษาลาวปัจจุบันในช่อง laoName แบบอัตโนมัติ
function syncEnglishNameFromLaoInput(laoText, meta = {}) {
  const enEl = document.getElementById("enName");
  if (!enEl) return;

  const cleanLao = formatLaoNameSpacing(laoText);
  if (!cleanLao) {
    enEl.value = "";
    return;
  }

  const detectedPrefix = detectTitlePrefix(cleanLao);
  const namePartRaw = stripTitleWords(cleanLao);
  enEl.value = formatKaraokeNameByRule(namePartRaw, detectedPrefix);
}

function appendTranscriptWithPause(el, newPart, isKaraoke) {
  if (!el) return;
  const now = Date.now();
  const inputId = el.id;
  const prevTime = lastResultTimeByInput[inputId] || 0;
  const elapsed = prevTime > 0 ? now - prevTime : Infinity;
  const startedNewSession = Boolean(isNewSessionByInput[inputId]);

  lastResultTimeByInput[inputId] = now;
  isNewSessionByInput[inputId] = false;

  if (isDateField(inputId)) {
    const currentSegs = extractDateSegments(el.value);
    const incomingSegs = extractDateSegments(newPart);
    const mergedRaw = [...currentSegs, ...incomingSegs].join(" ");
    el.value = formatDateWithSlash(mergedRaw);
    return;
  }

  if (isKaraoke) {
    applyKaraokeToElement(el, newPart, { elapsed, startedNewSession });
    return;
  }

  const currentVal = formatLaoNameSpacing(el.value);
  const cleanPart = formatLaoNameSpacing(newPart);
  if (!cleanPart) return;

  if (!currentVal) {
    el.value = cleanPart;
  } else {
    const shouldInsertSpace = startedNewSession || elapsed >= PAUSE_GAP_MS;
    const combined = shouldInsertSpace ? `${currentVal} ${cleanPart}` : `${currentVal}${cleanPart}`;
    el.value = formatLaoNameSpacing(combined);
  }

  // เมื่อพูดในช่อง ຊື່ພາສາລາວ ให้แปลงเป็นภาษาอังกฤษลงช่อง Name&Surname ให้อัตโนมัติทันที
  if (inputId === "laoName") {
    syncEnglishNameFromLaoInput(el.value);
  }
}

function startVoice(inputId, btnEl) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("เบราว์เซอร์นี้ไม่รองรับ Web Speech API แนะนำให้เปิดด้วย Google Chrome ครับ");
    return;
  }

  if (activeButton === btnEl) {
    stopVoice();
    return;
  }

  stopVoice();

  const isNameEnglishKaraoke = inputId === "enName";
  const recognition = new SpeechRecognition();
  recognition.lang = "lo-LA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  activeRecognition = recognition;
  activeButton = btnEl;
  activeInputId = inputId;
  isNewSessionByInput[inputId] = true;

  if (btnEl && !btnEl.dataset.origText) {
    btnEl.dataset.origText = btnEl.textContent;
  }
  if (btnEl) {
    btnEl.textContent = "🛑 ກຳລັງຟັງ... (ກົດຢຸດ)";
  }

  recognition.onresult = (event) => {
    const rawTranscript = event.results[0][0].transcript;
    const el = document.getElementById(inputId);
    appendTranscriptWithPause(el, rawTranscript, isNameEnglishKaraoke);
  };

  recognition.onerror = (e) => {
    if (e.error !== "aborted") {
      alert("เกิดข้อผิดพลาดในการรับเสียง: " + e.error);
    }
  };

  recognition.onend = () => {
    if (activeRecognition === recognition) {
      activeRecognition = null;
    }
    if (activeButton === btnEl && btnEl) {
      btnEl.textContent = btnEl.dataset.origText || "🎤 ເວົ້າລາວ";
      activeButton = null;
    }
    if (activeInputId === inputId) {
      activeInputId = null;
    }
  };

  try {
    recognition.start();
  } catch (err) {
    stopVoice();
    alert("ไม่สามารถเริ่มรับเสียงได้: " + err.message);
  }
}

function getFormValues() {
  return {
    examDate: formatDateWithSlash(document.getElementById("examDate").value),
    studentCode: document.getElementById("studentCode").value.trim(),
    laoName: formatLaoNameSpacing(document.getElementById("laoName").value),
    enName: formatKaraokeNameByRule(document.getElementById("enName").value),
    birthDate: formatDateWithSlash(document.getElementById("birthDate").value),
    birthVillage: document.getElementById("birthVillage").value.trim(),
    district: document.getElementById("district").value.trim(),
    province: document.getElementById("province").value.trim(),
    nationality: document.getElementById("nationality").value.trim(),
    occupation: document.getElementById("occupation").value,
    batchSet: document.getElementById("batchSet").value,
    phone: document.getElementById("phone").value.trim(),
    licenseType: document.getElementById("licenseType").value,
    schoolName: DEFAULT_SCHOOL_NAME,
    otherInfo: DEFAULT_OTHER_INFO
  };
}

function resetForm(nextCodeForNewRow) {
  document.getElementById("examDate").value = "";
  document.getElementById("studentCode").value = nextCodeForNewRow || "";
  document.getElementById("laoName").value = "";
  document.getElementById("enName").value = "";
  document.getElementById("birthDate").value = "";
  document.getElementById("birthVillage").value = "";
  document.getElementById("district").value = "";
  document.getElementById("province").value = "";
  document.getElementById("nationality").value = DEFAULT_NATIONALITY;
  document.getElementById("occupation").value = "";
  document.getElementById("batchSet").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("licenseType").value = "";
  document.getElementById("schoolName").value = DEFAULT_SCHOOL_NAME;
  document.getElementById("otherInfo").value = DEFAULT_OTHER_INFO;
  lastResultTimeByInput = {};
  isNewSessionByInput = {};
  document.getElementById("laoName").focus();
}

async function addRow() {
  stopVoice();
  const data = getFormValues();

  const missingFields = validateRequiredFormFields(data);
  if (missingFields.length > 0) {
    const missingLines = missingFields.map((f, i) => `${i + 1}. ${f.label}`).join("\n");
    alert(`ไม่สามารถบันทึกได้ครับ กรุณากรอกข้อมูลให้ครบทุกช่องก่อน\n\nช่องที่ยังว่างอยู่ (${missingFields.length} ช่อง):\n${missingLines}`);
    const firstEl = document.getElementById(missingFields[0].inputId);
    if (firstEl) {
      firstEl.focus();
      if (typeof firstEl.scrollIntoView === "function") {
        firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    return;
  }

  // หากเชื่อมต่อ Cloud อยู่ ให้ดึงข้อมูลล่าสุดก่อนบันทึกเพื่อเช็กว่าอาจารย์ท่านอื่นเพิ่งใช้รหัสนี้ไปหรือไม่
  if (cloudSyncUrl) {
    await pullRowsFromCloud(false);
  }

  if (data.studentCode && isDuplicateStudentCode(data.studentCode)) {
    const suggestedFreeCode = computeNextGlobalStudentCode(data.studentCode);
    alert(`รหัสนักเรียน "${data.studentCode}" มีอาจารย์ท่านอื่นบันทึกไปแล้วครับ ระบบเลื่อนเป็นรหัสว่างล่าสุด "${suggestedFreeCode}" ให้แล้ว กดเพิ่มแถวอีกครั้งได้เลยครับ`);
    const codeEl = document.getElementById("studentCode");
    codeEl.value = suggestedFreeCode;
    codeEl.focus();
    codeEl.select();
    return;
  }

  rows.push(data);
  rows = sortRowsByStudentCode(rows);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  renderTable();

  if (cloudSyncUrl) {
    try {
      await pushRowToCloud(data);
    } catch (err) {
      connectionState = "offline";
      updateSyncStatusLabel(`ບັນທຶກໃນເຄື່ອງແລ້ວ (ອອນລາຍຂັດຂ້ອງ: ${err.message})`, "offline", "ເຊື່ອມຕໍ່ບໍ່ໄດ້");
    }
  }

  if (GOOGLE_SHEET_WEB_APP_URL) {
    try {
      await pushRowToGoogleSheet(data);
    } catch (_) {}
  }

  const autoNextCode = computeNextGlobalStudentCode(data.studentCode || DEFAULT_INITIAL_STUDENT_CODE);
  resetForm(autoNextCode);
}

function buildAutoFillPayload(r, index = 0) {
  return {
    source: "lao_driving_exam_autofill",
    rowIndex: index,
    examDate: r.examDate || "",
    studentCode: r.studentCode || "",
    laoName: r.laoName || "",
    enName: r.enName || "",
    birthDate: r.birthDate || "",
    birthVillage: r.birthVillage || "",
    district: r.district || "",
    province: r.province || "",
    nationality: r.nationality || DEFAULT_NATIONALITY,
    occupation: r.occupation || "",
    batchSet: r.batchSet || "",
    phone: r.phone || "",
    licenseType: r.licenseType || "",
    schoolName: DEFAULT_SCHOOL_NAME,
    otherInfo: DEFAULT_OTHER_INFO
  };
}

function writeClipboardSafe(text, onSuccess) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      fallbackCopyText(text, onSuccess);
    });
  } else {
    fallbackCopyText(text, onSuccess);
  }
}

function fallbackCopyText(text, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  if (onSuccess) onSuccess();
}

function copyRowForAutoFill(rowIndex, btnEl) {
  const r = rows[rowIndex];
  if (!r) return;

  const jsonStr = JSON.stringify(buildAutoFillPayload(r, rowIndex));
  writeClipboardSafe(jsonStr, () => {
    if (!btnEl) return;
    const orig = btnEl.dataset.origText || btnEl.textContent;
    btnEl.dataset.origText = orig;
    btnEl.textContent = "✅ ກັອບແລ້ວ";
    btnEl.classList.add("copied");
    setTimeout(() => {
      btnEl.textContent = orig;
      btnEl.classList.remove("copied");
    }, 1200);
  });
}

function copyAllRowsQueue(btnEl) {
  if (!rows || rows.length === 0) {
    alert("ยังไม่มีข้อมูลแถวในตารางครับ");
    return;
  }

  const queuePayload = JSON.stringify({
    source: "lao_driving_exam_queue",
    rows: rows.map((r, i) => buildAutoFillPayload(r, i))
  });

  writeClipboardSafe(queuePayload, () => {
    if (!btnEl) return;
    const orig = btnEl.dataset.origText || btnEl.textContent;
    btnEl.dataset.origText = orig;
    btnEl.textContent = `✅ ກັອບຄິວ ${rows.length} ແຖວແລ້ວ`;
    setTimeout(() => {
      btnEl.textContent = orig;
    }, 1500);
  });
}

function matchesTableSearch(r, keyword) {
  const q = String(keyword || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    r.studentCode,
    r.laoName,
    r.enName,
    r.phone,
    r.birthVillage,
    r.district,
    r.province,
    r.licenseType,
    r.batchSet
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  return hay.includes(q);
}

function getFilteredRowEntries() {
  return rows
    .map((r, idx) => ({ row: r, idx }))
    .filter(({ row }) => matchesTableSearch(row, tableSearchKeyword));
}

function onTableSearchChange() {
  const inp = document.getElementById("tableSearchInput");
  tableSearchKeyword = inp ? inp.value : "";
  renderTable();
}

function clearTableSearch() {
  tableSearchKeyword = "";
  const inp = document.getElementById("tableSearchInput");
  if (inp) inp.value = "";
  renderTable();
}

function copyFirstMatchedRow(btnEl) {
  const matched = getFilteredRowEntries();
  if (!matched.length) {
    alert("ไม่พบรายชื่อที่ตรงกับคำค้นหาครับ");
    return;
  }
  copyRowForAutoFill(matched[0].idx, btnEl);
}

function copyFilteredRowsQueue(btnEl) {
  const matched = getFilteredRowEntries();
  if (!matched.length) {
    alert("ไม่พบรายชื่อที่ตรงกับคำค้นหาครับ");
    return;
  }
  const queuePayload = JSON.stringify({
    source: "lao_driving_exam_queue",
    rows: matched.map(({ row, idx }) => buildAutoFillPayload(row, idx))
  });
  writeClipboardSafe(queuePayload, () => {
    if (!btnEl) return;
    const orig = btnEl.dataset.origText || btnEl.textContent;
    btnEl.dataset.origText = orig;
    btnEl.textContent = `✅ ກັອບຜົນຄົ້ນຫາ ${matched.length} ຄົນແລ້ວ`;
    setTimeout(() => {
      btnEl.textContent = orig;
    }, 1500);
  });
}

function printFirstMatchedRow() {
  const matched = getFilteredRowEntries();
  if (!matched.length) {
    alert("ไม่พบรายชื่อที่ตรงกับคำค้นหาสำหรับพิมพ์ครับ");
    return;
  }
  openPrintPage(matched[0].idx);
}

function renderTable() {
  const tbody = document.querySelector("#dataTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const entries = getFilteredRowEntries();

  if (!entries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="17" style="text-align:center;color:#64748b;padding:14px;">${
      tableSearchKeyword.trim() ? "ບໍ່ພົບລາຍຊື່ທີ່ກົງກັບຄຳຄົ້ນຫາ" : "ຍັງບໍ່ມີຂໍ້ມູນນັກຮຽນ"
    }</td>`;
    tbody.appendChild(tr);
    updateSyncStatusLabel();
    return;
  }

  entries.forEach(({ row: r, idx }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <button type="button" class="copy-btn" onclick="copyRowForAutoFill(${idx}, this)">📋 ສົ່ງໄປກອກ</button>
        <button type="button" class="row-print-btn" onclick="openPrintPage(${idx})">🖨️ Print</button>
      </td>
      <td>${escapeHtml(r.examDate)}</td>
      <td>${escapeHtml(r.studentCode)}</td>
      <td>${escapeHtml(r.laoName)}</td>
      <td>${escapeHtml(r.enName)}</td>
      <td>${escapeHtml(r.birthDate)}</td>
      <td>${escapeHtml(r.birthVillage)}</td>
      <td>${escapeHtml(r.district)}</td>
      <td>${escapeHtml(r.province)}</td>
      <td>${escapeHtml(r.nationality)}</td>
      <td>${escapeHtml(r.occupation)}</td>
      <td>${escapeHtml(r.batchSet)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.licenseType)}</td>
      <td>${escapeHtml(DEFAULT_SCHOOL_NAME)}</td>
      <td>${escapeHtml(DEFAULT_OTHER_INFO)}</td>
    `;
    tbody.appendChild(tr);
  });

  updateSyncStatusLabel(
    tableSearchKeyword.trim() ? `ສະແດງຜົນຄົ້ນຫາ ${entries.length}/${rows.length} ຄົນ` : ""
  );
}

function escapeCSV(val) {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function downloadCSV() {
  if (rows.length === 0) {
    alert("ຍັງບໍ່ມີຂໍ້ມູນດາວໂຫຼດ");
    return;
  }

  const headers = [
    "ລຳດັບ",
    "ວັນ​ທີ່​ຂໍ​ເສັງ",
    "ລະ​ຫັດ​ນັກ​ຮຽນ",
    "ຊື່ພາສາລາວ",
    "Name&Surname",
    "ເກີດວັນ/ເດືອນ/ປີ",
    "ເກີດຢູ່ ບ້ານ",
    "ເມືອງ",
    "ແຂວງ",
    "ສັນຊາດ",
    "ອາຊີບ",
    "ຊຸດ",
    "ໂທລະສັບ",
    "ປະ​ເພດ",
    "ຊື່ໂຮງຮຽນ",
    "ຂໍ້ມູນອື່ນໆ"
  ];

  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r, i) => [
      i + 1,
      r.examDate,
      r.studentCode,
      r.laoName,
      r.enName,
      r.birthDate,
      r.birthVillage,
      r.district,
      r.province,
      r.nationality,
      r.occupation,
      r.batchSet,
      r.phone,
      r.licenseType,
      DEFAULT_SCHOOL_NAME,
      DEFAULT_OTHER_INFO
    ].map(escapeCSV).join(","))
  ];

  const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_driving_exam.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function clearAll() {
  if (!confirm("ต้องการลบข้อมูลที่บันทึกไว้ทั้งหมด (รวมถึงข้อมูลออนไลน์ที่ซิงก์อยู่) ใช่ไหมครับ?")) return;
  rows = [];
  localStorage.removeItem(STORAGE_KEY);
  if (cloudSyncUrl) {
    try {
      await clearCloudDatabase();
    } catch (_) {
      connectionState = "offline";
    }
  }
  renderTable();
  initStudentCodeField(true);
  initFixedFields();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

// --- บล็อกเสริมต่อท้าย: เลข 1-9 มี 0 นำหน้าเป็น 2 หลัก + ทับ (/) ปกติ + พิมพ์วันที่เร็วขึ้น + ปุ่มตอบสนองชัวร์ ---
(function () {
  if (typeof wordsToNumberDigits === "function") {
    const _origWordsToNumberDigits = wordsToNumberDigits;
    wordsToNumberDigits = function (text) {
      let s = _origWordsToNumberDigits(text);
      s = s.replace(/\b([12])\s+000\b/g, (_, d) => `${d}000`);
      s = s.replace(/\b20\s+00\b/g, "2000");
      return s;
    };
  }

  formatDateWithSlash = function (text) {
    const rawStr = String(text || "").trim();
    if (!rawStr) return "";

    const digitsOnly = rawStr.replace(/\D/g, "");
    if (/^[\/\-.\s\d]+$/.test(rawStr) && !/[\/\-]/.test(rawStr) && digitsOnly.length === 8) {
      return `${pad2(digitsOnly.slice(0, 2))}/${pad2(digitsOnly.slice(2, 4))}/${digitsOnly.slice(4, 8)}`;
    }

    const segs = extractDateSegments(rawStr);
    if (segs.length === 0) {
      return rawStr.replace(/\s+/g, " ").trim();
    }
    if (segs.length === 1) {
      return segs[0].length <= 2 ? pad2(segs[0]) : segs[0];
    }
    if (segs.length === 2) {
      return `${pad2(segs[0])}/${pad2(segs[1])}`;
    }

    const day = pad2(segs[0]);
    const month = pad2(segs[1]);
    const year = normalizeYear(segs[2]);
    const rest = segs.slice(3).map((x) => x.trim()).filter(Boolean);
    const base = year ? `${day}/${month}/${year}` : `${day}/${month}`;
    return rest.length > 0 ? `${base}/${rest.join("/")}` : base;
  };

  function bindFastDateInputById(id) {
    const el = document.getElementById(id);
    if (!el || el.dataset.fastDateBound === "1") return;
    el.dataset.fastDateBound = "1";

    el.addEventListener("input", () => {
      const val = el.value;
      const digits = val.replace(/\D/g, "");
      if (!/[\/\-]/.test(val) && digits.length === 8) {
        el.value = formatDateWithSlash(digits);
        return;
      }
      const parts = val.split("/");
      if (parts.length >= 2) {
        const d = parts[0].trim() ? pad2(parts[0]) : "";
        const m = parts[1].trim() ? pad2(parts[1]) : "";
        const y = parts.slice(2).join("/").replace(/[^\d]/g, "").slice(0, 4);
        let nextVal = d;
        if (parts.length === 2) {
          nextVal = `${d}/${m}`;
        } else if (parts.length >= 3) {
          nextVal = y ? `${d}/${m}/${y}` : `${d}/${m}/`;
        }
        if (nextVal && nextVal !== val) {
          el.value = nextVal;
        }
      }
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const formatted = formatDateWithSlash(el.value);
        if (formatted) {
          el.value = formatted;
        }
      }
    });

    el.addEventListener("blur", () => {
      if (el.value.trim()) {
        el.value = formatDateWithSlash(el.value);
      }
    });
  }

  function initAllFastDates() {
    bindFastDateInputById("examDate");
    bindFastDateInputById("birthDate");
  }

  initAllFastDates();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllFastDates);
  }

  // รองรับปุ่มที่กำหนด data-action หรือมีคำว่า บันทึก / เพิ่มแถว / พิมพ์ / ดาวน์โหลดCSV โดยไม่กระทบ onclick เดิม
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, [role='button']");
    if (!btn) return;
    if (btn.getAttribute("onclick")) return;

    const action = (btn.dataset.action || "").trim();
    if (action === "addRow" && typeof addRow === "function") {
      e.preventDefault();
      addRow();
      return;
    }
    if (action === "openPrintPage" && typeof openPrintPage === "function") {
      e.preventDefault();
      openPrintPage();
      return;
    }
    if (action === "downloadCSV" && typeof downloadCSV === "function") {
      e.preventDefault();
      downloadCSV();
      return;
    }
    if (action === "clearAll" && typeof clearAll === "function") {
      e.preventDefault();
      clearAll();
      return;
    }
    if (action === "manualRefreshFromCloud" && typeof manualRefreshFromCloud === "function") {
      e.preventDefault();
      manualRefreshFromCloud();
      return;
    }
    if (action === "copyAllRowsQueue" && typeof copyAllRowsQueue === "function") {
      e.preventDefault();
      copyAllRowsQueue(btn);
    }
  });
})();