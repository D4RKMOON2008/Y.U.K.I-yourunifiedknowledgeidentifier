/* ════════════════════════════════════════════════════════════
   CONFIGURACIÓN GLOBAL + BACKEND LOCAL (localStorage)
   Persistencia de usuarios, personas, asistencia, modelo y ajustes.
   ════════════════════════════════════════════════════════════ */

const YUKI_PERSONAS = ['roman', 'andrea', 'carlos', 'sofia', 'laura', 'miguel'];
const YUKI_CURSOS = ['Sistemas 10-A', 'Sistemas 11-B', 'Contabilidad 10-A', 'Electrónica 11-A'];
const PERSON_COLORS = ['#E6F1FB', '#E1F5EE', '#EEEDFE', '#EAF3DE', '#FBEAF0', '#FAEEDA'];
const PERSON_TC = ['#185FA5', '#0F6E56', '#534AB7', '#3B6D11', '#993556', '#854F0B'];

// Umbral de confianza (se puede cambiar desde Configuración)
let YUKI_CONFIDENCE_THRESHOLD = 70;

const YUKI_SYSTEM_STATUS = [
  { label: 'Cámara', ok: true },
  { label: 'Detector Facial', ok: true },
  { label: 'Modelo ONYX', ok: true },
  { label: 'OCR', ok: true },
  { label: 'Base de Datos', ok: true },
  { label: 'Servidor', ok: true },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const YukiVoice = { lang: 'es-ES' };

// Estado en memoria (se hidrata desde localStorage al iniciar sesión)
const YukiState = {
  streams: {},
  today: 0,
  detecting: false,
  detectInterval: null,
  recRunning: false,
  recInterval: null,
  capRunning: false,
  capInterval: null,
  capCount: 0,
  ocrRunning: false,
  ocrInterval: null,
  dataset: [],
  attendance: [],
  nextAttendanceId: 1,
  model: { images: 0, lastUpdate: null, name: 'ONYX' },
  settings: {
    confidence: 70,
    voiceLang: 'es-ES',
    notifications: true,
  },
};

/* ═══════════════ BACKEND LOCAL (localStorage) ═══════════════ */
const YukiDB = {
  KEYS: {
    users: 'yuki_users_v1',
    dataset: 'yuki_dataset_v1',
    attendance: 'yuki_attendance_v1',
    model: 'yuki_model_v1',
    settings: 'yuki_settings_v1',
    today: 'yuki_today_v1',
  },

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('YukiDB: no se pudo guardar', key, e);
    }
  },

  /* —— Usuarios (login / registro) —— */
  loadUsers() {
    return this._get(this.KEYS.users, []);
  },
  saveUsers(users) {
    this._set(this.KEYS.users, users);
  },

  /* —— Dataset (Gestión de Personas) —— */
  loadDataset() {
    return this._get(this.KEYS.dataset, []);
  },
  saveDataset(list) {
    this._set(this.KEYS.dataset, list);
  },

  /* —— Asistencia —— */
  loadAttendance() {
    return this._get(this.KEYS.attendance, []);
  },
  saveAttendance(list) {
    this._set(this.KEYS.attendance, list);
  },

  /* —— Modelo IA —— */
  loadModel() {
    return this._get(this.KEYS.model, { images: 0, lastUpdate: null });
  },
  saveModel(model) {
    this._set(this.KEYS.model, model);
  },

  /* —— Ajustes —— */
  loadSettings() {
    return this._get(this.KEYS.settings, {
      confidence: 70,
      voiceLang: 'es-ES',
      notifications: true,
    });
  },
  saveSettings(s) {
    this._set(this.KEYS.settings, s);
  },

  /* —— Contador del día —— */
  loadToday() {
    const data = this._get(this.KEYS.today, { date: '', count: 0 });
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) return 0;
    return data.count || 0;
  },
  saveToday(count) {
    const today = new Date().toISOString().slice(0, 10);
    this._set(this.KEYS.today, { date: today, count });
  },

  /* —— Carga todo al entrar a la app —— */
  hydrateState() {
    YukiState.dataset = this.loadDataset();
    YukiState.attendance = this.loadAttendance();
    YukiState.model = this.loadModel();
    YukiState.settings = this.loadSettings();
    YukiState.today = this.loadToday();

    YUKI_CONFIDENCE_THRESHOLD = YukiState.settings.confidence || 70;
    YukiVoice.lang = YukiState.settings.voiceLang || 'es-ES';

    // nextAttendanceId a partir del máximo existente
    const maxId = YukiState.attendance.reduce((m, r) => Math.max(m, r.id || 0), 0);
    YukiState.nextAttendanceId = maxId + 1;

    // Sincronizar lista de nombres conocidos con el dataset
    YukiState.dataset.forEach(p => {
      const n = (p.name || '').toLowerCase();
      if (n && !YUKI_PERSONAS.includes(n)) YUKI_PERSONAS.push(n);
    });
  },

  /* —— Persistencia rápida de lo que más cambia —— */
  persistDataset() {
    this.saveDataset(YukiState.dataset);
  },
  persistAttendance() {
    this.saveAttendance(YukiState.attendance);
  },
  persistModel() {
    this.saveModel(YukiState.model);
  },
  persistToday() {
    this.saveToday(YukiState.today);
  },
  persistSettings() {
    this.saveSettings(YukiState.settings);
  },
};

/**
 * Reinicia solo el estado en memoria de la sesión (cámaras, flags).
 * Los datos persistentes (dataset, asistencia, modelo, usuarios) se mantienen.
 */
function resetYukiState() {
  // Detener cámaras / intervalos
  Object.keys(YukiState.streams || {}).forEach(id => {
    try {
      const s = YukiState.streams[id];
      if (s && s.getTracks) s.getTracks().forEach(t => t.stop());
    } catch (_) {}
  });
  YukiState.streams = {};
  YukiState.detecting = false;
  YukiState.detectInterval = null;
  YukiState.recRunning = false;
  YukiState.recInterval = null;
  YukiState.capRunning = false;
  YukiState.capInterval = null;
  YukiState.capCount = 0;
  YukiState.ocrRunning = false;
  YukiState.ocrInterval = null;
  // No borramos dataset / attendance / model / today: son persistentes
}
