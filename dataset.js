/* ════════════════════════════════════════════════════════════
   GESTIÓN DE PERSONAS — captura ilimitada de personas, hasta 100 fotos
   ════════════════════════════════════════════════════════════ */

const CAP_MAX = 100; // fotos por sesión de captura
const MAX_TEMPLATES = 25; // descriptors faciales por persona (balance precisión/espacio)
let dsEditingId = null;

function renderDataset() {
  const grid = document.getElementById('ds-grid');
  if (!grid) return;
  const people = YukiState.dataset;
  grid.innerHTML = people.map((p, i) => {
    const safeName = escapeHtml(p.name);
    const templates = (FaceEngine.labeled[p.name] || []).length;
    return `
    <div class="person-card">
      <div class="person-top">
        <div class="person-initials" style="background:${PERSON_COLORS[i % PERSON_COLORS.length]};color:${PERSON_TC[i % PERSON_TC.length]}">${escapeHtml(p.name.slice(0, 2).toUpperCase())}</div>
        <div class="photo-count"><i class="fas fa-images"></i> ${p.photos || 0} fotos · ${templates} plantillas</div>
      </div>
      <div class="person-bottom">
        <div class="person-name">${safeName}</div>
        <div class="person-id">USR-${String(i + 1).padStart(3, '0')} · registrado el ${escapeHtml(p.date || '—')}</div>
        <div class="person-footer"><span class="chip chip-green">activo</span></div>
        <div class="person-actions">
          <button class="icon-btn" title="Actualizar información" aria-label="Actualizar información de ${safeName}" onclick="editPerson(${i})"><i class="fas fa-edit"></i></button>
          <button class="icon-btn" title="Capturar más fotografías" aria-label="Capturar más fotografías de ${safeName}" onclick="focusCaptureFor(${i})"><i class="fas fa-camera"></i></button>
          <button class="icon-btn danger" title="Eliminar estudiante" aria-label="Eliminar a ${safeName}" onclick="deletePerson(${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('') +
    `<div class="add-card" role="button" tabindex="0" onclick="document.getElementById('ds-name').focus();document.getElementById('ds-name').value='';" onkeydown="if(event.key==='Enter')this.click()"><i class="fas fa-user-plus"></i><span>nueva persona (ilimitado)</span></div>`;
}

function focusCaptureFor(index) {
  const p = YukiState.dataset[index];
  if (!p) return;
  document.getElementById('ds-name').value = p.name;
  document.getElementById('ds-name').focus();
  toast('Captura más fotos de "' + p.name + '" (hasta 100 por sesión)');
}

function editPerson(index) {
  const p = YukiState.dataset[index];
  if (!p) return;
  dsEditingId = index;
  document.getElementById('ds-name').value = p.name;
  document.getElementById('ds-name').focus();
  toast('Editando a "' + p.name + '" — cambia el nombre y presiona "Guardar cambios"');
  const btn = document.getElementById('btn-save-person');
  if (btn) btn.style.display = 'inline-flex';
}

function savePersonEdit() {
  const name = document.getElementById('ds-name').value.trim();
  if (dsEditingId === null || !name) return;
  const oldName = YukiState.dataset[dsEditingId].name;
  YukiState.dataset[dsEditingId].name = name;

  if (oldName !== name && FaceEngine.labeled[oldName]) {
    FaceEngine.labeled[name] = FaceEngine.labeled[oldName];
    delete FaceEngine.labeled[oldName];
    FaceEngine._saveDescriptors();
  }

  YukiState.attendance.forEach(r => {
    if (r.name === oldName) r.name = name;
  });

  YukiDB.persistDataset();
  YukiDB.persistAttendance();
  renderDataset();
  toast('Información actualizada y guardada');
  cancelPersonEdit();
}

function cancelPersonEdit() {
  dsEditingId = null;
  const nameEl = document.getElementById('ds-name');
  if (nameEl) nameEl.value = '';
  const btn = document.getElementById('btn-save-person');
  if (btn) btn.style.display = 'none';
}

function deletePerson(index) {
  const p = YukiState.dataset[index];
  if (!p) return;
  if (!confirm('¿Eliminar a "' + p.name + '" del sistema?')) return;
  FaceEngine.removePerson(p.name);
  YukiState.dataset.splice(index, 1);
  YukiState.model.images = YukiState.dataset.reduce((sum, x) => sum + (x.photos || 0), 0);
  YukiDB.persistDataset();
  YukiDB.persistModel();
  renderDataset();
  refreshModelStats();
  toast('Persona eliminada');
}

async function startCapture() {
  const name = document.getElementById('ds-name').value.trim();
  if (!name) {
    toast('Escribe el nombre primero');
    return;
  }
  const consent = document.getElementById('ds-consent');
  if (consent && !consent.checked) {
    toast('Debes aceptar el tratamiento de datos biométricos');
    consent.focus();
    return;
  }

  await FaceEngine.init();
  const okCam = await startCamera('cap-video', null, null);
  if (!okCam && !YukiState.streams['cap-video']) {
    toast('No se pudo abrir la cámara');
    return;
  }

  YukiState.capRunning = true;
  YukiState.capCount = 0;
  const btnStop = document.getElementById('btn-cap-stop');
  if (btnStop) btnStop.disabled = false;
  document.getElementById('cap-counter').textContent = '0 / ' + CAP_MAX + ' fotos capturadas';
  document.getElementById('cap-progress').style.width = '0%';
  toast('Capturando hasta ' + CAP_MAX + ' fotos. Mueve un poco la cabeza para mejores plantillas.');

  // canvas overlay para feedback visual
  const vid = document.getElementById('cap-video');
  const cvs = document.getElementById('cap-canvas');

  YukiState.capInterval = setInterval(async () => {
    if (!YukiState.capRunning) {
      clearInterval(YukiState.capInterval);
      return;
    }
    if (!vid || !vid.videoWidth) return;

    // dibujar frame en canvas de captura
    if (cvs) {
      cvs.width = vid.videoWidth;
      cvs.height = vid.videoHeight;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(vid, 0, 0);
      const faces = await FaceEngine.detectFaces(vid);
      faces.forEach(f => {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(f.x, f.y, f.width, f.height);
      });
    }

    const desc = await FaceEngine.getDescriptor(vid);
    // Contamos foto siempre que haya frame; plantilla solo si hay descriptor
    YukiState.capCount++;
    if (desc) {
      // limitar templates por persona
      const key = name.trim();
      if (!FaceEngine.labeled[key]) FaceEngine.labeled[key] = [];
      if (FaceEngine.labeled[key].length >= MAX_TEMPLATES) {
        FaceEngine.labeled[key].shift();
      }
      FaceEngine.labeled[key].push(desc);
      FaceEngine._saveDescriptors();
    }

    document.getElementById('cap-counter').textContent =
      YukiState.capCount + ' / ' + CAP_MAX + ' fotos capturadas';
    document.getElementById('cap-progress').style.width =
      (YukiState.capCount / CAP_MAX * 100) + '%';

    if (YukiState.capCount >= CAP_MAX) {
      finishCapture(name);
    }
  }, 180); // ~5-6 fotos/seg → ~20s para 100
}

function finishCapture(name) {
  clearInterval(YukiState.capInterval);
  YukiState.capRunning = false;
  stopCamera('cap-video', null, 'btn-cap-stop');
  const btnStop = document.getElementById('btn-cap-stop');
  if (btnStop) btnStop.disabled = true;

  const now = new Date().toLocaleDateString();
  const existing = YukiState.dataset.find(p => p.name.toLowerCase() === name.toLowerCase());
  const templates = (FaceEngine.labeled[name] || []).length;
  if (existing) {
    existing.photos = (existing.photos || 0) + YukiState.capCount;
  } else {
    YukiState.dataset.push({ name, photos: YukiState.capCount, date: now });
    const low = name.toLowerCase();
    if (!YUKI_PERSONAS.includes(low)) YUKI_PERSONAS.push(low);
  }

  YukiState.model.images = YukiState.dataset.reduce((sum, p) => sum + (p.photos || 0), 0);
  YukiState.model.lastUpdate = new Date().toLocaleString();
  YukiState.model.name = 'ONYX';
  YukiDB.persistDataset();
  YukiDB.persistModel();
  renderDataset();
  refreshModelStats();
  toast('✓ ' + YukiState.capCount + ' fotos de "' + name + '" (' + templates + ' plantillas ONYX)');
  document.getElementById('ds-name').value = '';
}

function stopCapture() {
  if (!YukiState.capRunning) return;
  const name = document.getElementById('ds-name').value.trim();
  if (YukiState.capCount > 0 && name) {
    finishCapture(name);
  } else {
    clearInterval(YukiState.capInterval);
    YukiState.capRunning = false;
    stopCamera('cap-video', null, 'btn-cap-stop');
    const btnStop = document.getElementById('btn-cap-stop');
    if (btnStop) btnStop.disabled = true;
    toast('Captura detenida');
  }
}
