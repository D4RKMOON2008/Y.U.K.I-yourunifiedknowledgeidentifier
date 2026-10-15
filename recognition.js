/* ════════════════════════════════════════════════════════════
   RECONOCIMIENTO FACIAL — real con face-api.js + FaceEngine
   ════════════════════════════════════════════════════════════ */

function startRecognition() {
  startCamera('rec-video', 'btn-rec-start', 'btn-rec-stop');
  YukiState.recRunning = true;
  FaceEngine.init().then(ok => {
    if (!ok) toast('Modelos faciales no disponibles — revisa tu conexión');
  });
  YukiState.recInterval = setInterval(doRecognize, 1500);
}

function stopRecognition() {
  stopCamera('rec-video', 'btn-rec-start', 'btn-rec-stop');
  clearInterval(YukiState.recInterval);
  YukiState.recRunning = false;
  const nameEl = document.getElementById('rec-name');
  if (nameEl) nameEl.textContent = '—';
  const meta = document.getElementById('rec-meta');
  if (meta) meta.innerHTML = '';
  const badge = document.getElementById('rec-badge');
  if (badge) badge.innerHTML = '';
  const fill = document.getElementById('conf-fill');
  if (fill) fill.style.width = '0%';
  const confVal = document.getElementById('conf-val');
  if (confVal) confVal.textContent = '—';
  const cvs = document.getElementById('rec-canvas');
  if (cvs) {
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
  }
}

async function doRecognize() {
  if (!YukiState.recRunning) return;

  const cvs = document.getElementById('rec-canvas');
  const vid = document.getElementById('rec-video');
  if (!cvs || !vid || !vid.videoWidth) return;

  cvs.width = vid.videoWidth;
  cvs.height = vid.videoHeight;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const descriptor = await FaceEngine.getDescriptor(vid);
  const faces = await FaceEngine.detectFaces(vid);

  faces.forEach((f) => {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.width, f.height);
  });

  let name = '—';
  let curso = '—';
  let color = '#F1EFE8';
  let known = false;
  let conf = 99;

  if (descriptor && FaceEngine.labeledCount() > 0) {
    const result = FaceEngine.match(descriptor);
    known = result.ok;
    name = result.name;
    conf = result.conf;
    if (known) {
      const idx = YUKI_PERSONAS.indexOf(name.toLowerCase());
      curso = YUKI_CURSOS[Math.abs(idx) % YUKI_CURSOS.length] || '—';
      color = PERSON_COLORS[Math.abs(idx) % PERSON_COLORS.length];
      if (faces[0]) {
        const f = faces[0];
        ctx.fillStyle = '#10b981';
        ctx.font = '14px monospace';
        ctx.fillText(name + ' (' + conf + ')', f.x, f.y - 8);
      }
    } else if (faces[0]) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      const f = faces[0];
      ctx.strokeRect(f.x, f.y, f.width, f.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px monospace';
      ctx.fillText('Desconocido', f.x, f.y - 8);
    }
  } else if (!descriptor) {
    name = 'Sin rostro';
  } else {
    name = 'Sin plantillas';
  }

  const hora = new Date().toLocaleTimeString();
  document.getElementById('rec-name').textContent = name;
  document.getElementById('rec-meta').innerHTML =
    '<span>Curso: <b>' + escapeHtml(curso) + '</b></span><span>Hora: <b>' + hora + '</b></span>';
  document.getElementById('rec-badge').innerHTML = known
    ? '<span class="recog-badge badge-ok"><i class="fas fa-check"></i> RECONOCIDO</span>'
    : '<span class="recog-badge badge-unknown"><i class="fas fa-times"></i> NO REGISTRADO</span>';

  const pct = known ? Math.max(10, 100 - conf) : Math.min(100, conf);
  const fill = document.getElementById('conf-fill');
  fill.style.width = pct + '%';
  fill.style.background = known ? 'var(--green)' : 'var(--red)';
  document.getElementById('conf-val').textContent = conf;

  if (known) {
    const lastKey = '_lastRec_' + name;
    const now = Date.now();
    if (!window[lastKey] || now - window[lastKey] > 4000) {
      window[lastKey] = now;
      addLogEntry('rec-log', name, hora, true, color);
      addAttendanceEntry(name, curso, conf, true);
      YukiState.today++;
      YukiDB.persistToday();
      const todayEl = document.getElementById('m-today');
      if (todayEl) todayEl.textContent = YukiState.today;
      addLogEntry('log-list', name, hora, true, color);
      if (YukiState.settings && YukiState.settings.notifications !== false) {
        toast('Asistencia: ' + name);
      }
    }
  }
}
