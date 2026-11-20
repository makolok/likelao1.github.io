const STORAGE_KEY = "lao_driving_exam_rows_v2";
const CLOUD_URL_STORAGE_KEY = "lao_driving_exam_cloud_url_v1";
const DEFAULT_CLOUD_SYNC_URL = "https://likelao1-96736.firebaseio.com/";
const DEFAULT_SCHOOL_NAME = "ຮຮ.ສອນຂັບລົດບ້ານສາມັກຄີ";
const DEFAULT_NATIONALITY = "ລາວ";

let studentRows = [];
let activeIdx = 0;
let currentSearchKeyword = "";

function normalizeFirebaseEndpoint(rawUrl) {
  const clean = String(rawUrl || "").trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith(".json")) return clean;
  return `${clean}/driving_exam_students.json`;
}

function normalizeRowsPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (typeof payload === "object") {
    return Object.values(payload).filter((item) => item && typeof item === "object");
  }
  return [];
}

function splitBirthDateParts(birthDateStr) {
  const raw = String(birthDateStr || "").trim();
  if (!raw) return { day: "", month: "", year: "" };
  const parts = raw.split(/[\/\-.]+/).map((s) => s.trim()).filter(Boolean);
  return {
    day: parts[0] || "",
    month: parts[1] || "",
    year: parts[2] || ""
  };
}

function cleanNationalityForForm(nat) {
  const s = String(nat || "").trim();
  if (!s) return DEFAULT_NATIONALITY;
  return s.split("/")[0].trim() || DEFAULT_NATIONALITY;
}

function getTodayFormattedDDMMYYYY() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function setFieldText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function getSelectedIndexFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const idxParam = params.get("index");
  if (idxParam !== null && !Number.isNaN(Number(idxParam))) {
    return Number(idxParam);
  }
  const codeParam = (params.get("code") || "").trim().toUpperCase();
  if (codeParam) {
    const found = studentRows.findIndex(
      (r) => String(r.studentCode || "").trim().toUpperCase() === codeParam
    );
    if (found >= 0) return found;
  }
  return 0;
}

function matchesSearchKeyword(r, keyword) {
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
    r.licenseType
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  return hay.includes(q);
}

function populateStudentDropdown(preferredIdx = null) {
  const sel = document.getElementById("studentSelect");
  if (!sel) return;
  sel.innerHTML = "";

  if (!studentRows.length) {
    const opt = document.createElement("option");
    opt.value = "-1";
    opt.textContent = "-- ຍັງບໍ່ມີຂໍ້ມູນນັກຮຽນ --";
    sel.appendChild(opt);
    return;
  }

  const matchedIndices = [];
  studentRows.forEach((r, i) => {
    if (matchesSearchKeyword(r, currentSearchKeyword)) {
      matchedIndices.push(i);
    }
  });

  if (!matchedIndices.length) {
    const opt = document.createElement("option");
    opt.value = "-1";
    opt.textContent = "-- ບໍ່ພົບລາຍຊື່ທີ່ຄົ້ນຫາ --";
    sel.appendChild(opt);
    return;
  }

  matchedIndices.forEach((realIdx) => {
    const r = studentRows[realIdx];
    const opt = document.createElement("option");
    opt.value = String(realIdx);
    const code = r.studentCode ? `[${r.studentCode}] ` : "";
    const name = r.laoName || r.enName || "ບໍ່ມີຊື່";
    const phone = r.phone ? ` (${r.phone})` : "";
    opt.textContent = `${realIdx + 1}. ${code}${name}${phone}`;
    sel.appendChild(opt);
  });

  const targetIdx =
    typeof preferredIdx === "number" && matchedIndices.includes(preferredIdx)
      ? preferredIdx
      : matchedIndices[0];
  sel.value = String(targetIdx);
}

function onSearchStudentInput() {
  const inp = document.getElementById("studentSearchInput");
  currentSearchKeyword = inp ? inp.value : "";
  populateStudentDropdown(activeIdx);

  const sel = document.getElementById("studentSelect");
  if (sel && Number(sel.value) >= 0) {
    renderPetition(Number(sel.value));
  }
}

function renderPetition(idx) {
  const posLabel = document.getElementById("studentPositionLabel");
  if (!studentRows.length) {
    if (posLabel) posLabel.textContent = "0 / 0";
    setFieldText("fExamDate", getTodayFormattedDDMMYYYY());
    return;
  }

  const safeIdx = Math.max(0, Math.min(idx, studentRows.length - 1));
  activeIdx = safeIdx;
  const r = studentRows[safeIdx];

  const sel = document.getElementById("studentSelect");
  if (sel && sel.value !== String(safeIdx)) {
    const hasOption = Array.from(sel.options).some((o) => o.value === String(safeIdx));
    if (!hasOption) {
      currentSearchKeyword = "";
      const searchInp = document.getElementById("studentSearchInput");
      if (searchInp) searchInp.value = "";
      populateStudentDropdown(safeIdx);
    }
    sel.value = String(safeIdx);
  }
  if (posLabel) posLabel.textContent = `${safeIdx + 1} / ${studentRows.length}`;

  const bParts = splitBirthDateParts(r.birthDate);
  const natClean = cleanNationalityForForm(r.nationality);

  setFieldText("fStudentCode", r.studentCode || "");
  setFieldText("fLaoName", r.laoName || "");
  setFieldText("fBirthDay", bParts.day);
  setFieldText("fBirthMonth", bParts.month);
  setFieldText("fBirthYear", bParts.year);

  setFieldText("fEnName", r.enName || "");

  setFieldText("fBirthVillage", r.birthVillage || "");
  setFieldText("fBirthDistrict", r.district || "");
  setFieldText("fBirthProvince", r.province || "");

  setFieldText("fFamilyBook", "");
  setFieldText("fFamilyDate", "");
  setFieldText("fIssuedBy", "");

  setFieldText("fNationality", natClean);
  setFieldText("fOccupation", r.occupation || "");
  setFieldText("fWorkplace", "");
  setFieldText("fPhone", r.phone || "");

  setFieldText("fLicenseType", r.licenseType || "");
  setFieldText("fExamDate", getTodayFormattedDDMMYYYY());
  setFieldText("fSignName", r.laoName || r.enName || "");
}

function onSelectStudentChange() {
  const sel = document.getElementById("studentSelect");
  if (!sel) return;
  const idx = Number(sel.value);
  if (!Number.isNaN(idx) && idx >= 0) {
    renderPetition(idx);
  }
}

function stepStudent(delta) {
  if (!studentRows.length) return;
  renderPetition(activeIdx + delta);
}

async function loadStudentRows() {
  const localRaw = localStorage.getItem(STORAGE_KEY);
  if (localRaw) {
    try {
      studentRows = normalizeRowsPayload(JSON.parse(localRaw));
    } catch (_) {
      studentRows = [];
    }
  }

  const cloudUrl = (localStorage.getItem(CLOUD_URL_STORAGE_KEY) || DEFAULT_CLOUD_SYNC_URL || "").trim();
  const endpoint = normalizeFirebaseEndpoint(cloudUrl);
  if (endpoint) {
    try {
      const res = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const remoteData = normalizeRowsPayload(await res.json());
        if (remoteData.length > 0) {
          studentRows = remoteData;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(studentRows));
        }
      }
    } catch (_) {
      // ใช้ข้อมูลจาก localStorage ต่อได้หากออฟไลน์
    }
  }

  const startIdx = getSelectedIndexFromUrl();
  populateStudentDropdown(startIdx);
  renderPetition(startIdx);
}

loadStudentRows();