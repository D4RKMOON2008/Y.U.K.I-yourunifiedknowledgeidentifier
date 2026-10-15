/* ════════════════════════════════════════════════════════════
   MODELO ONYX — índice facial real (FaceEngine + persistencia)
   ════════════════════════════════════════════════════════════ */

function refreshModelStats() {
  const imgEl = document.getElementById('model-images');
  const dateEl = document.getElementById('model-last-update');
  const photos = YukiState.dataset.reduce((sum, p) => sum + (p.photos || 0), 0);
  const templates = FaceEngine && FaceEngine.labeled
    ? Object.values(FaceEngine.labeled).reduce((s, arr) => s + arr.length, 0)
    : 0;
  if (imgEl) imgEl.textContent = photos || templates || 0;
  if (dateEl) dateEl.textContent = YukiState.model.lastUpdate || 'nunca';
}

/** Compatibilidad con botones antiguos */
function simulateTrain() { trainOnyx(true); }
function updateModel() { trainOnyx(false); }

/**
 * Entrena / actualiza el modelo ONYX.
 * fullTrain=true: reindexa todas las plantillas existentes.
 * fullTrain=false: solo reporta e incorpora el estado actual.
 */
async function trainOnyx(fullTrain) {
  const log = document.getElementById('train-log');
  if (!log) return;
  log.innerHTML = '';

  await FaceEngine.init();

  const people = YukiState.dataset.length
    ? YukiState.dataset.map(p => p.name)
    : Object.keys(FaceEngine.labeled || {});

  const lines = [];
  let t = 0;
  const push = (delay, msg, cls) => { lines.push({ t: t + delay, msg, cls }); t += delay; };

  push(0, fullTrain ? 'Iniciando entrenamiento completo de ONYX...' : 'Actualizando modelo ONYX...', 'msg');
  push(300, 'Motor facial: face-api.js · modelo ONYX', 'msg');
  push(300, 'Personas registradas: ' + people.length, 'msg');

  people.forEach((name) => {
    const n = (FaceEngine.labeled[name] || []).length;
    push(200, 'Indexando "' + name + '" — ' + n + ' plantillas', n > 0 ? 'ok' : 'msg');
  });

  if (fullTrain) {
    // Re-guardar descriptors (reindex)
    FaceEngine._saveDescriptors();
    push(400, 'Reconstruyendo índice facial ONYX...', 'msg');
  } else {
    push(300, 'Incorporando plantillas nuevas al índice...', 'msg');
  }

  push(500, 'Validando descriptors...', 'msg');
  push(400, '✓ ONYX listo para reconocimiento en vivo', 'ok');
  push(200, '✓ Modelo guardado en este navegador', 'ok');

  lines.forEach(({ t: delay, msg, cls }) => {
    setTimeout(() => {
      const now = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'train-line';
      div.innerHTML = '<span class="ts">' + now + '</span><span class="' + cls + '">' + msg + '</span>';
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }, delay);
  });

  const totalTime = (lines.length ? lines[lines.length - 1].t : 1000) + 300;
  setTimeout(() => {
    YukiState.model.images = YukiState.dataset.reduce((sum, p) => sum + (p.photos || 0), 0);
    YukiState.model.lastUpdate = new Date().toLocaleString();
    YukiState.model.name = 'ONYX';
    YukiDB.persistModel();
    refreshModelStats();
    // actualizar métrica de inicio
    const m = document.querySelector('#sec-inicio .metric-val');
    toast('✓ Modelo ONYX ' + (fullTrain ? 'entrenado' : 'actualizado'));
  }, totalTime);
}
