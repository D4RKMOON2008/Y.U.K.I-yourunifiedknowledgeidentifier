/* ════════════════════════════════════════════════════════════
   REGISTRO DE ASISTENCIA — Backend local (YukiDB)
   ════════════════════════════════════════════════════════════ */

function addAttendanceEntry(name, curso, conf, ok) {
  const now = new Date();
  YukiState.attendance.unshift({
    id: YukiState.nextAttendanceId++,
    name,
    curso,
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString(),
    conf,
    ok,
  });
  YukiDB.persistAttendance();
}

function renderTable(filter = '') {
  const body = document.getElementById('att-body');
  if (!body) return;
  const rows = YukiState.attendance.filter(r =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase())
  );
  body.innerHTML = rows.map(r => {
    const idx = YUKI_PERSONAS.indexOf(r.name.toLowerCase());
    const bg = idx >= 0 ? PERSON_COLORS[idx % PERSON_COLORS.length] : '#F1EFE8';
    const tc = idx >= 0 ? PERSON_TC[idx % PERSON_TC.length] : '#5F5E5A';
    const init = escapeHtml(r.name.slice(0, 2).toUpperCase());
    const badge = r.ok
      ? '<span class="chip chip-green">RECONOCIDO</span>'
      : '<span class="chip chip-red">NO REGISTRADO</span>';
    return `<tr>
      <td class="td-mono">${String(r.id).padStart(3, '0')}</td>
      <td><div class="att-name-cell"><div class="att-av" style="background:${bg};color:${tc}">${init}</div>${escapeHtml(r.name)}</div></td>
      <td class="td-mono">${escapeHtml(r.curso || '—')}</td>
      <td class="td-mono">${escapeHtml(r.date)}</td>
      <td class="td-mono">${escapeHtml(r.time)}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

function filterTable() {
  const input = document.getElementById('att-search-input');
  renderTable(input ? input.value : '');
}

function addFakeEntry() {
  const people = YukiState.dataset.length
    ? YukiState.dataset.map(p => p.name)
    : YUKI_PERSONAS;
  const idx = Math.floor(Math.random() * people.length);
  const conf = Math.floor(Math.random() * 50) + 10;
  addAttendanceEntry(people[idx], YUKI_CURSOS[idx % YUKI_CURSOS.length], conf, true);
  renderTable(document.getElementById('att-search-input')?.value || '');
  toast('Registro agregado y guardado');
}

function exportCSV() {
  const rows = [
    ['ID', 'Nombre', 'Curso', 'Fecha', 'Hora', 'Estado'],
    ...YukiState.attendance.map(r => [r.id, r.name, r.curso || '', r.date, r.time, r.ok ? 'RECONOCIDO' : 'NO REGISTRADO']),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'asistencia.csv';
  a.click();
  toast('CSV descargado');
}

function exportExcel() {
  const rows = YukiState.attendance.map(r =>
    `<tr><td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.curso || '')}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.time)}</td><td>${r.ok ? 'RECONOCIDO' : 'NO REGISTRADO'}</td></tr>`
  ).join('');
  const table = `<table border="1"><tr><th>ID</th><th>Nombre</th><th>Curso</th><th>Fecha</th><th>Hora</th><th>Estado</th></tr>${rows}</table>`;
  const blob = new Blob(['\ufeff', table], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'asistencia.xls';
  a.click();
  toast('Excel descargado');
}

function downloadPDF() {
  const printArea = document.getElementById('print-area');
  const rows = YukiState.attendance.map(r =>
    `<tr><td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.curso || '')}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.time)}</td><td>${r.ok ? 'RECONOCIDO' : 'NO REGISTRADO'}</td></tr>`
  ).join('');
  printArea.innerHTML = `
    <h2>Registro de Asistencia — Y.U.K.I</h2>
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse">
      <tr><th>ID</th><th>Nombre</th><th>Curso</th><th>Fecha</th><th>Hora</th><th>Estado</th></tr>
      ${rows}
    </table>`;
  window.print();
}
