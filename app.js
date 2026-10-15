/* ════════════════════════════════════════════════════════════
   APP — ORQUESTADOR PRINCIPAL
   Este es el único archivo que conoce "todas las piezas": decide
   qué pantalla se muestra, maneja el login y arranca el estado
   inicial de la aplicación. El resto de módulos (camera, detector,
   recognition, dataset, model, ocr, attendance, accessibility) no
   dependen de este archivo; app.js sí depende de todos ellos, por
   eso se carga al final en index.html.
   ════════════════════════════════════════════════════════════ */

/* ── NAVEGACIÓN ENTRE PANTALLAS (landing / login / app) ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('active');
  // Accesibilidad: mover el foco a la nueva pantalla para que un lector
  // de pantalla anuncie el cambio de contexto (login, app, etc.).
  el.setAttribute('tabindex', '-1');
  el.focus();
}

/* ── NAVEGACIÓN ENTRE SECCIONES DEL SIDEBAR ── */
const SECTION_TITLES = {
  inicio: 'Inicio',
  camara: 'Cámara en Vivo',
  reconocer: 'Reconocimiento Facial',
  dataset: 'Gestión de Personas',
  entrenar: 'Modelo ONYX',
  ocr: 'OCR Inteligente',
  asistencia: 'Registro de Asistencia',
  accesibilidad: 'Accesibilidad',
  configuracion: 'Configuración',
};

function showSection(name, navEl) {
  document.querySelectorAll('.section-body').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  sec.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (navEl) navEl.classList.add('active');
  document.getElementById('page-title').textContent = SECTION_TITLES[name] || name;

  // Accesibilidad: mover el foco a la sección recién mostrada, para que
  // un lector de pantalla anuncie que cambiamos de contenido.
  sec.setAttribute('tabindex', '-1');
  sec.focus();

  if (name === 'asistencia') renderTable();
  if (name === 'dataset') renderDataset();
  if (name === 'entrenar') refreshModelStats();
  if (name === 'inicio') renderSystemStatus();
}

/** Usado por los botones de "Acciones rápidas" del panel de Inicio. */
function goToSection(name) {
  const navBtn = document.querySelector(`.nav-item[data-section="${name}"]`);
  showSection(name, navBtn);
}

/* ── LOGIN: SELECCIÓN DE MÉTODO (usuario/contraseña, rostro, accesibilidad) ── */
function switchLoginMethod(method) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.method === method));
  document.querySelectorAll('.login-method').forEach(m => m.classList.toggle('active', m.id === 'login-method-' + method));

  // Al salir del método de rostro, apagamos su cámara si estaba abierta.
  if (method !== 'face') stopCamera('face-login-video', null, null);
  if (method === 'face') updateFaceLoginButtons();
}

/* ── AUTH / USUARIOS (YukiDB) ── */
function loadUsers() {
  return YukiDB.loadUsers();
}

function saveUsers(users) {
  YukiDB.saveUsers(users);
}

function findUserByEmail(email) {
  return loadUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

function findFaceUsers() {
  return loadUsers().filter(u => u.hasFace);
}

/* ── REGISTRO CON CORREO / CONTRASEÑA ── */
function doRegister() {
  const name = (document.getElementById('r-name').value || '').trim();
  const email = (document.getElementById('r-email').value || '').trim();
  const pass = document.getElementById('r-pass').value || '';
  const pass2 = document.getElementById('r-pass2').value || '';
  const err = document.getElementById('r-err');

  if (!name || !email || !pass) {
    err.textContent = 'Completa todos los campos.';
    err.style.display = 'block';
    return;
  }
  if (pass.length < 4) {
    err.textContent = 'La contraseña debe tener al menos 4 caracteres.';
    err.style.display = 'block';
    return;
  }
  if (pass !== pass2) {
    err.textContent = 'Las contraseñas no coinciden.';
    err.style.display = 'block';
    return;
  }
  if (findUserByEmail(email)) {
    err.textContent = 'Ya existe una cuenta con ese correo.';
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  const users = loadUsers();
  users.push({
    id: Date.now().toString(36),
    name,
    email,
    password: pass,
    hasFace: false,
    faceData: null,
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);

  // Agregar también al dataset de personas si no existe
  const low = name.toLowerCase();
  if (!YUKI_PERSONAS.includes(low)) YUKI_PERSONAS.push(low);
  if (!YukiState.dataset.find(p => p.name.toLowerCase() === low)) {
    YukiState.dataset.push({ name, photos: 0, date: new Date().toLocaleDateString() });
    YukiDB.persistDataset();
  }

  toast('Cuenta creada. Ya puedes iniciar sesión.');
  document.getElementById('r-name').value = '';
  document.getElementById('r-email').value = '';
  document.getElementById('r-pass').value = '';
  document.getElementById('r-pass2').value = '';
  showScreen('s-login');
  document.getElementById('l-email').value = email;
}

/* ── LOGIN: USUARIO Y CONTRASEÑA ── */
function doLogin() {
  const e = (document.getElementById('l-email').value || '').trim();
  const p = document.getElementById('l-pass').value || '';
  const err = document.getElementById('l-err');

  if (!e || !p) {
    err.textContent = 'Ingresa tu correo y contraseña.';
    err.style.display = 'block';
    return;
  }

  const user = findUserByEmail(e);
  if (!user || user.password !== p) {
    // Compatibilidad demo: si no hay usuarios registrados, permite entrar con cualquier dato
    if (loadUsers().length === 0) {
      err.style.display = 'none';
      enterApp(e.split('@')[0] || 'usuario');
      return;
    }
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  enterApp(user.name);
}

function updateFaceLoginButtons() {
  const ok = document.getElementById('face-login-consent').checked;
  const btnLogin = document.getElementById('btn-face-login-start');
  const btnReg = document.getElementById('btn-face-register');
  if (btnLogin) btnLogin.disabled = !ok;
  if (btnReg) btnReg.disabled = !ok;
}

/* ── LOGIN: RECONOCIMIENTO FACIAL ── */
async function startFaceLogin() {
  await FaceEngine.init();
  if (FaceEngine.labeledCount() === 0 && !findFaceUsers().length) {
    toast('No hay rostros registrados. Usa "Crear nuevo usuario con rostro".');
    return;
  }

  await startCamera('face-login-video', 'btn-face-login-start', null);
  toast('Mira a la cámara para verificar tu rostro...');

  let tries = 0;
  const tryMatch = async () => {
    tries++;
    const vid = document.getElementById('face-login-video');
    const desc = await FaceEngine.getDescriptor(vid);
    if (desc) {
      const result = FaceEngine.match(desc);
      if (result.ok) {
        stopCamera('face-login-video', 'btn-face-login-start', null);
        toast('Rostro reconocido: ' + result.name);
        enterApp(result.name);
        return;
      }
    }
    if (tries < 8) {
      setTimeout(tryMatch, 700);
    } else {
      stopCamera('face-login-video', 'btn-face-login-start', null);
      toast('No se reconoció el rostro. Regístralo primero o inténtalo de nuevo.');
    }
  };
  setTimeout(tryMatch, 900);
}

/* ── REGISTRO DE NUEVO USUARIO SOLO CON ROSTRO ── */
async function startFaceRegister() {
  const name = prompt('Nombre completo para el nuevo usuario con rostro:');
  if (!name || !name.trim()) {
    toast('Debes indicar un nombre.');
    return;
  }
  const cleanName = name.trim();

  await FaceEngine.init();
  await startCamera('face-login-video', 'btn-face-register', null);
  toast('Capturando rostro de ' + cleanName + '... mira a la cámara');

  let captured = 0;
  const need = 4;
  const captureLoop = async () => {
    const vid = document.getElementById('face-login-video');
    const desc = await FaceEngine.getDescriptor(vid);
    if (desc) {
      FaceEngine.addDescriptor(cleanName, desc);
      captured++;
      toast('Plantilla ' + captured + '/' + need);
    }
    if (captured >= need) {
      stopCamera('face-login-video', 'btn-face-register', null);

      const users = loadUsers();
      const id = Date.now().toString(36);
      users.push({
        id,
        name: cleanName,
        email: id + '@rostro.yuki',
        password: '',
        hasFace: true,
        faceData: null,
        createdAt: new Date().toISOString(),
      });
      saveUsers(users);

      const low = cleanName.toLowerCase();
      if (!YUKI_PERSONAS.includes(low)) YUKI_PERSONAS.push(low);
      if (!YukiState.dataset.find(p => p.name.toLowerCase() === low)) {
        YukiState.dataset.push({ name: cleanName, photos: need, date: new Date().toLocaleDateString() });
        YukiState.model.images = YukiState.dataset.reduce((s, p) => s + (p.photos || 0), 0);
        YukiDB.persistDataset();
        YukiDB.persistModel();
      }

      toast('Usuario con rostro creado: ' + cleanName + '. Ya puedes iniciar solo con tu cara.');
    } else {
      setTimeout(captureLoop, 600);
    }
  };
  setTimeout(captureLoop, 800);
}

/** Acciones comunes a cualquier método de login exitoso. */
function enterApp(username) {
  showScreen('s-app');
  initApp();
  toast('Bienvenido, ' + username);
}

function doLogout() {
  stopAllCams();
  resetYukiState();
  showScreen('s-login');
  document.getElementById('l-email').value = '';
  document.getElementById('l-pass').value = '';
  document.body.classList.remove('access-mode');
}

/* ── RELOJ DEL SISTEMA ── */
function updateClock() {
  const now = new Date();
  const t = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(x => String(x).padStart(2, '0')).join(':');
  const clockEl = document.getElementById('sys-clock');
  if (clockEl) clockEl.textContent = t;
  const c2 = document.getElementById('cam-clock2');
  if (c2) c2.textContent = t;
}
setInterval(updateClock, 1000);
updateClock();

/* ── ESTADO DEL SISTEMA (panel de Inicio) ── */
// Aquí conectar Base de Datos / Servidor: sustituir YUKI_SYSTEM_STATUS
// (definido en config.js) por una verificación real de cada servicio.
function renderSystemStatus() {
  const el = document.getElementById('system-status-list');
  if (!el) return;
  el.innerHTML = YUKI_SYSTEM_STATUS.map(s => `
    <div class="status-row">
      <span><span class="status-dot ${s.ok ? 'ok' : 'off'}"></span>${s.label}</span>
      <span class="chip ${s.ok ? 'chip-green' : 'chip-red'}">${s.ok ? 'operativo' : 'inactivo'}</span>
    </div>`).join('');
}

/* ── LOG COMPARTIDO (Inicio + Reconocimiento) ── */
function addLogEntry(containerId, name, time, ok, color) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const idx = YUKI_PERSONAS.indexOf(name);
  const tc = idx >= 0 ? PERSON_TC[idx] : '#5F5E5A';
  const safeName = escapeHtml(name);
  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML = `<div class="log-avatar" style="background:${color || '#E6F1FB'};color:${tc}">${escapeHtml(name.slice(0, 2).toUpperCase())}</div>
    <div class="log-info"><div class="log-name">${safeName}</div><div class="log-time">${escapeHtml(time)}</div></div>
    ${ok ? '<span class="chip chip-green">OK</span>' : '<span class="chip chip-red">—</span>'}`;
  container.insertBefore(row, container.firstChild);
  while (container.children.length > 8) container.removeChild(container.lastChild);
}

/* ── TOAST ── */
function toast(msg) {
  const el = document.getElementById('toast-el');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── CONFIGURACIÓN (persistente) ── */
function setConfidenceThreshold(val) {
  const n = parseInt(val, 10) || 70;
  YUKI_CONFIDENCE_THRESHOLD = n;
  if (YukiState.settings) {
    YukiState.settings.confidence = n;
    YukiDB.persistSettings();
  }
  toast('Umbral de confianza guardado: <' + n);
}

function setNotifications(on) {
  if (YukiState.settings) {
    YukiState.settings.notifications = !!on;
    YukiDB.persistSettings();
  }
  toast(on ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
}

/* ── INICIALIZACIÓN DE LA APP (al entrar por cualquier método de login) ── */
function initApp() {
  // Cargar todo desde el backend local
  YukiDB.hydrateState();
  renderSystemStatus();

  // Si es la primera vez (no hay datos), sembrar demo una sola vez
  if (YukiState.dataset.length === 0) {
    YUKI_PERSONAS.forEach((n, i) => {
      YukiState.dataset.push({ name: n, photos: 20 + i * 2, date: '2025-06-01' });
    });
    YukiState.model.images = YukiState.dataset.reduce((sum, p) => sum + p.photos, 0);
    YukiState.model.lastUpdate = '2025-06-01, 08:00 a. m.';
    YukiDB.persistDataset();
    YukiDB.persistModel();
  }
  if (YukiState.attendance.length === 0) {
    const seed = [
      ['roman', 0, 22], ['andrea', 1, 35], ['carlos', 2, 18], ['sofia', 3, 12],
    ];
    seed.forEach(([name, idx, conf]) => {
      // No usamos addAttendanceEntry aquí para no incrementar IDs raros al sembrar
      const now = new Date();
      YukiState.attendance.push({
        id: YukiState.nextAttendanceId++,
        name,
        curso: YUKI_CURSOS[idx % YUKI_CURSOS.length],
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString(),
        conf,
        ok: true,
      });
    });
    YukiState.today = seed.length;
    YukiDB.persistAttendance();
    YukiDB.persistToday();
  }

  // Últimos registros en el panel de inicio (solo visual, no se re-persisten)
  const logList = document.getElementById('log-list');
  if (logList) logList.innerHTML = '';
  const recent = YukiState.attendance.slice(0, 4);
  recent.forEach((r, i) => {
    const idx = YUKI_PERSONAS.indexOf(r.name.toLowerCase());
    addLogEntry('log-list', r.name, r.time, r.ok, PERSON_COLORS[idx >= 0 ? idx : 0]);
  });

  // Métricas
  const todayEl = document.getElementById('m-today');
  if (todayEl) todayEl.textContent = YukiState.today;
  const regEl = document.querySelector('#sec-inicio .metric-val.cyan');
  if (regEl) regEl.textContent = String(YukiState.dataset.length);

  // Aplicar ajustes guardados a la UI
  const voiceSel = document.getElementById('voice-lang-select');
  if (voiceSel) voiceSel.value = YukiState.settings.voiceLang || 'es-ES';
  const confSel = document.getElementById('cfg-confidence');
  if (confSel) confSel.value = String(YukiState.settings.confidence || 70);
  const notifCb = document.getElementById('cfg-notifications');
  if (notifCb) notifCb.checked = YukiState.settings.notifications !== false;

  renderDataset();
  renderTable();
  refreshModelStats();
}
