// User front-end: Auto Scan + Auto Reset flow.
(() => {
  // --- DOM Elements ---
  const pageHome = document.getElementById('page-home');
  const pageRegistrasi = document.getElementById('page-registrasi');
  const pagePoli = document.getElementById('page-poli');
  const pagePoliGateway = document.getElementById('page-poli-gateway');

  const navHome = document.getElementById('nav-home');
  const navRegistrasi = document.getElementById('nav-registrasi');
  const navPoli = document.getElementById('nav-poli');
  const btnHomeRegistrasi = document.getElementById('btn-home-registrasi');
  const btnHomeKePoli = document.getElementById('btn-home-ke-poli');

  // Registrasi
  const formRegistrasi = document.getElementById('form-registrasi');
  const inputNik = document.getElementById('reg-nik');
  const inputNama = document.getElementById('reg-nama');
  const inputDob = document.getElementById('reg-ttl');
  const inputAlamat = document.getElementById('reg-alamat');
  const videoReg = document.getElementById('video-reg');
  const statusReg = document.getElementById('status-reg');
  const countReg = document.getElementById('count-reg');

  // Registration countdown elements
  let regCountdownInterval = null;
  let regCountdownValue = 3;

  // Verifikasi & Auto Scan UI
  const videoVerif = document.getElementById('video-verif');
  const btnScan = document.getElementById('btn-scan');
  const btnNikFallback = document.getElementById('btn-nik-fallback');
  const verifResult = document.getElementById('verif-result');
  const verifData = document.getElementById('verif-data');
  const verifNikBox = document.getElementById('verif-nik');
  const fallbackNik = document.getElementById('fallback-nik');
  const btnCariNik = document.getElementById('btn-cari-nik');
  const statusVerif = document.getElementById('status-verif');
  const btnLanjutForm = document.getElementById('btn-lanjut-form');
  const btnDetailData = document.getElementById('btn-detail-data');

  // Auto Scan Overlay Elements
  const overlayAuto = document.getElementById('auto-scan-overlay');
  const textCountdown = document.getElementById('auto-scan-countdown');
  const circleProgress = document.getElementById('auto-scan-circle');
  const focusBox = document.getElementById('verif-focus-box');
  const nextScanText = document.getElementById('next-scan-text'); // Text timer 10s

  // Poli gateway
  const formPoliGateway = document.getElementById('form-poli-gateway');
  const gwNama = document.getElementById('gw-nama');
  const gwUmur = document.getElementById('gw-umur');
  const gwAlamat = document.getElementById('gw-alamat');
  const gwPoli = document.getElementById('gw-poli');

  // Modals
  const modalAlert = document.getElementById('modal-alert');
  const alertMessage = document.getElementById('alert-message');
  const btnAlertOk = document.getElementById('btn-modal-alert-ok');

  const modalLoading = document.getElementById('modal-loading');
  const loadingText = document.getElementById('loading-text');
  const progressInner = document.getElementById('progress-inner');

  const modalAntrian = document.getElementById('modal-antrian');
  const antrianPoli = document.getElementById('antrian-poli');
  const antrianNomor = document.getElementById('antrian-nomor');
  const btnAntrianTutup = document.getElementById('btn-modal-antrian-tutup');

  const modalRegisSuccess = document.getElementById('modal-regis-success');
  const btnModalRegisTutup = document.getElementById('btn-modal-regis-tutup');
  const btnModalLanjutPoli = document.getElementById('btn-modal-lanjut-poli');

  const modalVerifDetail = document.getElementById('modal-verif-detail');
  const btnModalVerifTutup = document.getElementById('btn-modal-verif-tutup');
  const btnModalVerifCloseX = document.getElementById('btn-modal-verif-close-x');
  const btnModalVerifLanjut = document.getElementById('btn-modal-verif-lanjut');
  const detailPasienContent = document.getElementById('detail-pasien-content');

  // --- STATE ---
  let activePatient = null;
  let streamReg = null;
  let streamVerif = null;

  // Auto Scan State
  let autoCheckInterval = null;
  let nextScanTimer = null; // Timer untuk 10 detik reset
  let isScanning = false; // True jika sedang proses capture/verifikasi
  let faceDetectedTime = 0; // Waktu (ms) wajah terdeteksi terus menerus
  const CHECK_INTERVAL = 300; // Cek wajah setiap 300ms (lebih cepat)
  const REQUIRED_TIME = 1200; // Butuh 1.2 detik (1200ms) untuk trigger - lebih cepat
  const CIRCLE_FULL = 226; // Dasharray SVG (sesuai r=36 di HTML baru)

  // --- NAVIGATION ---
  function showPage(id) {
    // Stop semua timer jika pindah halaman
    stopAutoCheck();
    stopNextScanCountdown();

    [pageHome, pageRegistrasi, pagePoli, pagePoliGateway].forEach((p) => p.classList.add('hidden'));
    document.querySelectorAll('.nav-button').forEach((b) => b.classList.remove('active'));

    if (id === 'page-home') {
      pageHome.classList.remove('hidden');
    }
    if (id === 'page-registrasi') {
      pageRegistrasi.classList.remove('hidden');
      navRegistrasi.classList.add('active');
      ensureCamera('reg');
    }
    if (id === 'page-poli') {
      pagePoli.classList.remove('hidden');
      navPoli.classList.add('active');
      ensureCamera('verif').then(() => {
        // Mulai Auto Check setelah kamera siap
        startAutoCheck();
      });
      resetVerif();
    }
    if (id === 'page-poli-gateway') {
      pagePoliGateway.classList.remove('hidden');
      navPoli.classList.add('active');
    }
  }

  function resetVerif() {
    verifResult.classList.add('hidden');
    verifNikBox.classList.add('hidden');
    statusVerif.textContent = 'Menunggu wajah...';
    verifData.innerHTML = '';
    isScanning = false;
    stopNextScanCountdown(); // Pastikan timer 10s mati
    resetCountdownUI();
    // Restart auto check
    startAutoCheck();
  }

  // --- AUTO SCAN LOGIC (Capture & Countdown 3s) ---
  function startAutoCheck() {
    if (autoCheckInterval) clearInterval(autoCheckInterval);
    faceDetectedTime = 0;

    autoCheckInterval = setInterval(async () => {
      // Syarat: Halaman Poli aktif, Stream ada, Tidak sedang scanning, Modal loading tidak muncul, Hasil tidak muncul
      if (pagePoli.classList.contains('hidden')) return;
      if (!streamVerif || videoVerif.paused || videoVerif.ended) return;
      if (isScanning) return;
      if (!modalLoading.classList.contains('hidden')) return;
      if (!verifResult.classList.contains('hidden')) return;

      // 1. Ambil 1 frame kecil (fast)
      const frameBlob = await captureSingleFrame(videoVerif, 0.5);
      if (!frameBlob) return;

      // 2. Kirim ke API Check Face
      const fd = new FormData();
      fd.append('frame', frameBlob, 'check.jpg');

      try {
        const r = await fetch('/api/check_face', { method: 'POST', body: fd });
        const d = await r.json();

        if (d.ok && d.found) {
          // Wajah DITEMUKAN
          faceDetectedTime += CHECK_INTERVAL;
          statusVerif.textContent = `Wajah terdeteksi... ${Math.ceil((REQUIRED_TIME - faceDetectedTime) / 1000)}s`;
          updateCountdownUI(faceDetectedTime, REQUIRED_TIME);

          if (faceDetectedTime >= REQUIRED_TIME) {
            triggerAutoScan();
          }
        } else {
          // Wajah HILANG
          faceDetectedTime = 0;
          statusVerif.textContent = 'Menunggu wajah...';
          resetCountdownUI();
        }
      } catch (err) {
        // Silent fail
      }
    }, CHECK_INTERVAL);
  }

  function stopAutoCheck() {
    if (autoCheckInterval) {
      clearInterval(autoCheckInterval);
      autoCheckInterval = null;
    }
    resetCountdownUI();
  }

  function updateCountdownUI(current, total) {
    overlayAuto.classList.remove('hidden');
    focusBox.classList.remove('border-red-600');
    focusBox.classList.add('border-primary-500'); // Hijau

    // Hitung detik mundur (3, 2, 1)
    const remaining = Math.ceil((total - current) / 1000);
    textCountdown.textContent = remaining > 0 ? remaining : 'Scan';

    // Update lingkaran progress
    const percentage = Math.min(current / total, 1);
    const offset = CIRCLE_FULL - percentage * CIRCLE_FULL;
    circleProgress.style.strokeDashoffset = offset;
  }

  function resetCountdownUI() {
    overlayAuto.classList.add('hidden');
    focusBox.classList.add('border-red-600');
    focusBox.classList.remove('border-primary-500');
    textCountdown.textContent = '3';
    circleProgress.style.strokeDashoffset = CIRCLE_FULL;
  }

  function triggerAutoScan() {
    isScanning = true;
    stopAutoCheck();
    // Call auto scan directly instead of clicking manual button
    performAutoScan();
  }

  // Auto scan function (triggered by face detection)
  async function performAutoScan() {
    await ensureCamera('verif');
    if (!streamVerif) {
      isScanning = false;
      startAutoCheck();
      return;
    }

    statusVerif.textContent = 'Memverifikasi...';
    showLoading('Verifikasi Otomatis: mengambil foto...');
    const scanStartTime = Date.now();

    // Capture 20 frames for accuracy, but with minimal gap (25ms) for speed
    const frames = await captureFrames(videoVerif, 20, 25, null, 'Verifikasi', 0.8);
    updateProgress(20, 20, 'Memproses');

    const fd = new FormData();
    frames.forEach((b, i) => fd.append('frames[]', b, `scan_${i}.jpg`));
    // Enable fast_mode for auto-detection flow (uses optimized recognition)
    fd.append('fast_mode', 'true');

    try {
      const r = await fetch('/api/recognize', { method: 'POST', body: fd });
      const d = await r.json();
      hideLoading();
      const scanDuration = (Date.now() - scanStartTime) / 1000;

      if (!d.ok) {
        showAlert(d.msg || 'Verifikasi gagal');
        statusVerif.textContent = 'Gagal';
        isScanning = false;
        startAutoCheck();
        return;
      }

      if (!d.found) {
        statusVerif.textContent = 'Tidak dikenali';
        showAlert(d.msg || 'Wajah tidak dikenali.');
        activePatient = null;
        verifResult.classList.add('hidden');
        isScanning = false;
        startAutoCheck();
        return;
      }

      // SUKSES
      statusVerif.textContent = 'Berhasil';
      activePatient = { nik: d.nik, name: d.name, address: d.address, dob: d.dob, age: d.age, confidence: d.confidence };
      verifData.innerHTML = `
        <p><strong>NIK:</strong> <span class="font-mono">${d.nik}</span></p>
        <p><strong>Nama:</strong> ${d.name}</p>
        <p><strong>Tanggal:</strong> ${d.dob}</p>
        <p><strong>Umur:</strong> ${d.age}</p>
        <p><strong>Alamat:</strong> ${d.address}</p>
        <p><strong>Tingkat Kecocokan:</strong> ${d.confidence}%</p>
      `;
      // Add scan duration below
      const durationEl = document.createElement('p');
      durationEl.innerHTML = `<strong>Di-scan selama:</strong> ${scanDuration.toFixed(2)} detik`;
      verifData.appendChild(durationEl);
      verifResult.classList.remove('hidden');

      // --- MULAI COUNTDOWN 10 DETIK UNTUK RESET OTOMATIS ---
      startNextScanCountdown();
    } catch (err) {
      hideLoading();
      showAlert('Error jaringan: ' + err.message);
      statusVerif.textContent = 'Error';
      isScanning = false;
      startAutoCheck();
    }
  }

  // --- NEXT SCAN COUNTDOWN (10s Logic) ---
  function startNextScanCountdown() {
    stopNextScanCountdown();
    let seconds = 10;

    const updateText = () => {
      if (nextScanText) {
        nextScanText.textContent = `Verifikasi selanjutnya dalam ${seconds} detik...`;
      }
    };
    updateText();

    nextScanTimer = setInterval(() => {
      seconds--;
      updateText();

      if (seconds <= 0) {
        stopNextScanCountdown();
        resetVerif(); // RESET TOTAL -> Loop ulang
      }
    }, 1000);
  }

  function stopNextScanCountdown() {
    if (nextScanTimer) {
      clearInterval(nextScanTimer);
      nextScanTimer = null;
    }
  }

  function captureSingleFrame(videoEl, quality = 0.5) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const scale = 200 / videoEl.videoWidth;
      canvas.width = 200;
      canvas.height = videoEl.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  function startRegCountdown(callback) {
    regCountdownValue = 3;
    statusReg.textContent = `Persiapan... ${regCountdownValue}`;
    countReg.textContent = regCountdownValue;

    regCountdownInterval = setInterval(() => {
      regCountdownValue--;
      statusReg.textContent = `Persiapan... ${regCountdownValue}`;
      countReg.textContent = regCountdownValue;

      if (regCountdownValue <= 0) {
        clearInterval(regCountdownInterval);
        regCountdownInterval = null;
        statusReg.textContent = 'Mengambil foto...';
        callback();
      }
    }, 1000);
  }

  // --- COMMON HELPERS ---
  function showAlert(msg) {
    alertMessage.textContent = msg;
    modalAlert.classList.remove('hidden');
  }
  function hideAlert() {
    modalAlert.classList.add('hidden');
  }
  function showLoading(text) {
    loadingText.textContent = text;
    progressInner.style.width = '0%';
    modalLoading.classList.remove('hidden');
  }
  function hideLoading() {
    modalLoading.classList.add('hidden');
  }
  function updateProgress(c, t, label) {
    const pct = Math.round((c / t) * 100);
    progressInner.style.width = pct + '%';
    loadingText.textContent = `${label} ${c}/${t} (${pct}%)`;
  }
  function openAntrian(poli, nomor) {
    antrianPoli.textContent = `Poli: ${poli}`;
    antrianNomor.textContent = nomor;
    modalAntrian.classList.remove('hidden');
  }
  function closeAntrian() {
    modalAntrian.classList.add('hidden');
  }
  function computeAge(dob) {
    try {
      const d = new Date(dob);
      if (isNaN(d.getTime())) return '–';
      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
      return `${age} Tahun`;
    } catch (_) {
      return '–';
    }
  }

  // --- WEBCAM ---
  async function initWebcam(videoEl, cameraIndex = 0) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');
      const targetDevice = videoDevices[cameraIndex] || videoDevices[0];
      if (!targetDevice) {
        showAlert('Tidak ada kamera terdeteksi.');
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: targetDevice.deviceId } },
        audio: false,
      });
      videoEl.srcObject = stream;
      return stream;
    } catch (e) {
      showAlert('Gagal akses webcam: ' + e.message);
      return null;
    }
  }

  async function ensureCamera(mode) {
    const CAMERA_INDEX_REG = 0;
    const CAMERA_INDEX_VERIF = 0;

    if (mode === 'reg' && !streamReg) {
      streamReg = await initWebcam(videoReg, CAMERA_INDEX_REG);
    }
    if (mode === 'verif' && !streamVerif) {
      streamVerif = await initWebcam(videoVerif, CAMERA_INDEX_VERIF);
    }
  }

  function captureFrames(videoEl, total = 20, gap = 120, counterEl = null, label = 'Frame', quality = 0.85) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames = [];
      let taken = 0;
      const grab = () => {
        if (!videoEl.videoWidth) return requestAnimationFrame(grab);
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0);
        canvas.toBlob(
          (b) => {
            frames.push(b);
            taken++;
            if (counterEl) counterEl.textContent = taken;
            updateProgress(taken, total, label);
            if (taken >= total) resolve(frames);
            else setTimeout(grab, gap);
          },
          'image/jpeg',
          quality
        );
      };
      grab();
    });
  }

  // --- EVENT LISTENERS ---

  // 1. Registrasi
  formRegistrasi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nikVal = inputNik.value.trim();
    if (!/^\d{16}$/.test(nikVal)) {
      showAlert('NIK harus 16 digit angka.');
      return;
    }
    await ensureCamera('reg');
    if (!streamReg) return;

    // Start countdown instead of immediate capture
    showLoading('Menunggu...');
    startRegCountdown(async () => {
      loadingText.textContent = 'Mengambil foto...';
      // Capture frames quickly after countdown
      const frames = await captureFrames(videoReg, 20, 25, null, 'Foto', 0.85);
      updateProgress(20, 20, 'Mengirim');
      statusReg.textContent = 'Mengirim...';

      const fd = new FormData();
      fd.append('nik', nikVal);
      fd.append('name', inputNama.value.trim());
      fd.append('dob', inputDob.value);
      fd.append('address', inputAlamat.value.trim());
      frames.forEach((b, i) => fd.append('frames[]', b, `frame_${i}.jpg`));
      try {
        const r = await fetch('/api/register', { method: 'POST', body: fd });
        const d = await r.json();
        hideLoading();
        if (!d.ok) {
          showAlert(d.msg || 'Registrasi gagal');
          statusReg.textContent = 'Gagal';
          return;
        }
        statusReg.textContent = 'Berhasil';
        activePatient = { nik: nikVal, name: inputNama.value.trim(), address: inputAlamat.value.trim(), dob: inputDob.value };
        formRegistrasi.reset();
        modalRegisSuccess.classList.remove('hidden');
      } catch (err) {
        hideLoading();
        showAlert('Error jaringan: ' + err.message);
        statusReg.textContent = 'Error';
      }
    });
  });

  // Modal event listeners for registration
  btnModalRegisTutup.addEventListener('click', () => {
    modalRegisSuccess.classList.add('hidden');
    showPage('page-home');
  });
  btnModalLanjutPoli.addEventListener('click', () => {
    modalRegisSuccess.classList.add('hidden');
    if (activePatient) {
      gwNama.textContent = activePatient.name;
      gwUmur.textContent = computeAge(activePatient.dob);
      gwAlamat.textContent = activePatient.address;
      showPage('page-poli-gateway');
    } else showAlert('Data pasien tidak tersedia.');
  });

  // 2. Verifikasi (Logic Tombol Scan) - Manual Mode (uses InsightFace directly)
  btnScan.addEventListener('click', async () => {
    isScanning = true;
    resetCountdownUI();
    stopNextScanCountdown(); // Pastikan tidak ada timer reset berjalan
    stopAutoCheck(); // Stop auto-detection when manual mode is used

    await ensureCamera('verif');
    if (!streamVerif) {
      isScanning = false;
      startAutoCheck();
      return;
    }

    statusVerif.textContent = 'Memverifikasi...';
    showLoading('Verifikasi Manual: mengambil foto...');
    const scanStartTime = Date.now();

    // Capture 20 frames for accuracy, but with minimal gap (25ms) for speed
    const frames = await captureFrames(videoVerif, 20, 25, null, 'Verifikasi', 0.8);
    updateProgress(20, 20, 'Memproses');

    const fd = new FormData();
    frames.forEach((b, i) => fd.append('frames[]', b, `scan_${i}.jpg`));
    // Disable fast_mode for manual verification (uses InsightFace directly, no OpenCV pre-check)
    fd.append('fast_mode', 'false');

    try {
      const r = await fetch('/api/recognize', { method: 'POST', body: fd });
      const d = await r.json();
      hideLoading();
      const scanDuration = (Date.now() - scanStartTime) / 1000;

      if (!d.ok) {
        showAlert(d.msg || 'Verifikasi gagal');
        statusVerif.textContent = 'Gagal';
        isScanning = false;
        startAutoCheck();
        return;
      }

      if (!d.found) {
        statusVerif.textContent = 'Tidak dikenali';
        showAlert(d.msg || 'Wajah tidak dikenali.');
        activePatient = null;
        verifResult.classList.add('hidden');
        isScanning = false;
        startAutoCheck();
        return;
      }

      // SUKSES
      statusVerif.textContent = 'Berhasil';
      activePatient = { nik: d.nik, name: d.name, address: d.address, dob: d.dob, age: d.age, confidence: d.confidence };
      verifData.innerHTML = `
        <p><strong>NIK:</strong> <span class="font-mono">${d.nik}</span></p>
        <p><strong>Nama:</strong> ${d.name}</p>
        <p><strong>Tanggal:</strong> ${d.dob}</p>
        <p><strong>Umur:</strong> ${d.age}</p>
        <p><strong>Alamat:</strong> ${d.address}</p>
        <p><strong>Tingkat Kecocokan:</strong> ${d.confidence}%</p>
      `;
      // Add scan duration below
      const durationEl = document.createElement('p');
      durationEl.innerHTML = `<strong>Di-scan selama:</strong> ${scanDuration.toFixed(2)} detik`;
      verifData.appendChild(durationEl);
      verifResult.classList.remove('hidden');

      // --- MULAI COUNTDOWN 10 DETIK UNTUK RESET OTOMATIS ---
      startNextScanCountdown();
    } catch (err) {
      hideLoading();
      showAlert('Error jaringan: ' + err.message);
      statusVerif.textContent = 'Error';
      isScanning = false;
      startAutoCheck();
    }
  });

  // Tombol Detail Data -> Lanjut (Stop Timer)
  btnDetailData.addEventListener('click', () => {
    stopNextScanCountdown(); // Stop timer agar user bisa baca data
  });

  btnModalVerifLanjut.addEventListener('click', () => {
    modalVerifDetail.classList.add('hidden');
    stopNextScanCountdown(); // Stop timer karena user sudah pilih lanjut
    if (!activePatient) {
      showAlert('Data pasien tidak tersedia.');
      return;
    }
    gwNama.textContent = activePatient.name;
    gwUmur.textContent = activePatient.age || computeAge(activePatient.dob) || '–';
    gwAlamat.textContent = activePatient.address;
    showPage('page-poli-gateway');
  });

  // Manual NIK
  btnNikFallback.addEventListener('click', () => {
    stopAutoCheck();
    stopNextScanCountdown();
    verifNikBox.classList.remove('hidden');
    verifResult.classList.add('hidden');
  });

  btnCariNik.addEventListener('click', async () => {
    const nik = fallbackNik.value.trim();
    if (!/^\d{16}$/.test(nik)) {
      showAlert('Masukkan NIK 16 digit.');
      return;
    }
    showLoading('Cari pasien...');
    try {
      const r = await fetch(`/api/patient/${nik}`);
      const d = await r.json();
      hideLoading();
      if (!d.ok) {
        showAlert(d.msg || 'NIK tidak ditemukan.');
        return;
      }
      activePatient = { nik: d.patient.nik, name: d.patient.name, address: d.patient.address, dob: d.patient.dob, age: d.patient.age };
      verifData.innerHTML = `
        <p><strong>NIK:</strong> <span class="font-mono">${activePatient.nik}</span></p>
        <p><strong>Nama:</strong> ${activePatient.name}</p>
        <p><strong>Umur:</strong> ${activePatient.age || computeAge(activePatient.dob) || '–'}</p>
        <p><strong>Alamat:</strong> ${activePatient.address}</p>
      `;
      verifResult.classList.remove('hidden');
      showAlert('Data pasien ditemukan.');
      // Tidak pakai timer otomatis di manual, karena user mungkin butuh waktu
    } catch (err) {
      hideLoading();
      showAlert('Error: ' + err.message);
    }
  });

  // Form Poli -> Lanjut (Stop Timer)
  btnLanjutForm.addEventListener('click', () => {
    stopNextScanCountdown();
    if (!activePatient) return;
    gwNama.textContent = activePatient.name;
    gwUmur.textContent = activePatient.age || computeAge(activePatient.dob) || '–';
    gwAlamat.textContent = activePatient.address;
    showPage('page-poli-gateway');
  });

  // Form Poli Submit
  formPoliGateway.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activePatient) {
      showAlert('Data pasien tidak tersedia.');
      return;
    }
    const poli = gwPoli.value;
    if (!poli) {
      showAlert('Pilih poli.');
      return;
    }
    showLoading('Mengambil nomor antrian...');
    try {
      const r = await fetch('/api/queue/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poli }) });
      const d = await r.json();
      hideLoading();
      if (!d.ok) {
        showAlert(d.msg || 'Gagal ambil nomor.');
        return;
      }
      openAntrian(d.poli, d.nomor);
      e.target.reset();
      activePatient = null;
    } catch (err) {
      hideLoading();
      showAlert('Error jaringan: ' + err.message);
    }
  });

  // Nav hooks
  navHome.addEventListener('click', () => showPage('page-home'));
  navRegistrasi.addEventListener('click', () => showPage('page-registrasi'));
  navPoli.addEventListener('click', () => showPage('page-poli'));
  btnHomeRegistrasi.addEventListener('click', () => showPage('page-registrasi'));
  btnHomeKePoli.addEventListener('click', () => showPage('page-poli'));

  btnAlertOk.addEventListener('click', hideLoading);
  btnAlertOk.addEventListener('click', () => modalAlert.classList.add('hidden'));
  btnAntrianTutup.addEventListener('click', () => {
    closeAntrian();
    showPage('page-home');
  });

  // Init
  showPage('page-home');
})();
