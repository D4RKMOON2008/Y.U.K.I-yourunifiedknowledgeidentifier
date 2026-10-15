/* ════════════════════════════════════════════════════════════
   DETECTOR FACIAL — real con face-api.js
   ════════════════════════════════════════════════════════════ */

const DETECT_COLORS = ['#3B8BD4', '#10b981', '#f59e0b', '#ef4444', '#a78bfa'];

function toggleDetect() {
  YukiState.detecting = !YukiState.detecting;
  const btn = document.getElementById('btn-detect-toggle');

  if (YukiState.detecting) {
    btn.innerHTML = '<i class="fas fa-crosshairs"></i> Detección: ON';
    btn.classList.add('active-cam');
    FaceEngine.init().then(ok => {
      if (!ok) toast('No se pudieron cargar los modelos de detección');
    });
    YukiState.detectInterval = setInterval(runFaceDetect, 600);
  } else {
    btn.innerHTML = '<i class="fas fa-crosshairs"></i> Detección: OFF';
    btn.classList.remove('active-cam');
    clearInterval(YukiState.detectInterval);
    const cvs = document.getElementById('cam-canvas');
    if (cvs) {
      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, cvs.width, cvs.height);
    }
    const cnt = document.getElementById('face-count-txt');
    if (cnt) cnt.textContent = 'Rostros: 0';
  }
}

async function runFaceDetect() {
  const vid = document.getElementById('cam-video');
  const cvs = document.getElementById('cam-canvas');
  if (!vid || !cvs || !YukiState.streams['cam-video']) {
    clearInterval(YukiState.detectInterval);
    YukiState.detecting = false;
    return;
  }
  if (!vid.videoWidth) return;

  cvs.width = vid.videoWidth;
  cvs.height = vid.videoHeight;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const faces = await FaceEngine.detectFaces(vid);
  const cnt = document.getElementById('face-count-txt');
  if (cnt) cnt.textContent = 'Rostros: ' + faces.length;

  faces.forEach((f, i) => {
    ctx.strokeStyle = DETECT_COLORS[i % DETECT_COLORS.length];
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.width, f.height);
    ctx.font = '12px monospace';
    ctx.fillStyle = DETECT_COLORS[i % DETECT_COLORS.length];
    ctx.fillText('rostro #' + (i + 1), f.x + 2, f.y - 6);
  });
}
