# WEB-FACE - Sistem Deteksi dan Pengenalan Wajah Akurat

Aplikasi web Flask untuk registrasi dan verifikasi wajah pasien rumah sakit. Menggunakan **InsightFace (RetinaFace + ArcFace)** untuk deteksi dan pengenalan wajah dengan akurasi tinggi.

## 🚀 Fitur Utama

- **Deteksi Wajah Akurat**: RetinaFace untuk deteksi real-time
- **Pengenalan Wajah Modern**: ArcFace embedding (512 dimensi)
- **Multi-Frame Voting**: Meningkatkan akurasi dengan analisis multiple frame
- **Face Alignment**: Normalisasi posisi wajah untuk hasil optimal
- **Auto-Fallback**: Otomatis ke LBPH jika InsightFace tidak tersedia

## 📁 Struktur Direktori

```
WEB-FACE/
├── app.py                    # Aplikasi Flask utama
├── face_engine.py            # Engine deteksi dan pengenalan wajah
├── requirements.txt          # Dependensi Python
├── database.db               # Database SQLite (auto-generated)
├── model/
│   ├── embeddings.db         # Database embedding (InsightFace)
│   └── buffalo_l/            # Model InsightFace (auto-download)
├── templates/
│   ├── user.html
│   ├── admin_login.html
│   └── admin_dashboard.html
├── static/js/
│   ├── user.js
│   └── admin.js
├── README.md                 # Dokumentasi singkat
└── README_INSIGHTFACE.md     # Dokumentasi lengkap InsightFace
```

## 🛠️ Instalasi Cepat

Proyek ini adalah implementasi face recognition berbasis **InsightFace**, **ONNXRuntime**, dan **Flask**.  
Dokumen ini menjelaskan cara setup environment, install dependency, hingga tes pertama agar aplikasi berjalan mulus.

---

## 🚀 1. Persiapan Awal

Pastikan software berikut sudah terpasang di sistem lo:

- **Python 3** → cek: `py --version`
- **Git** (opsional kalau folder sudah ada)
- **Visual Studio Code**
- **Visual C++ Redistributable**  
  > Biasanya sudah ada — kalau nanti muncul error OpenCV tentang DLL hilang, tinggal install dari Microsoft.

### 📁 Clone repository (kalau belum)
```sh
git clone https://github.com/lustresense/web-face.git
cd web-face
```

Kalau foldernya sudah ada → cukup `cd` ke dalamnya.

---

## 🧪 2. Setup Virtual Environment

Buka **PowerShell** di dalam folder proyek.

### Buat environment:
```sh
py -3 -m venv .venv
```

### Aktifkan:
```sh
.venv\Scripts\Activate
```

Kalau berhasil, prompt PowerShell lo bakal berubah jadi:
```
(.venv) PS C:\...
```

---

## 📦 3. Update `requirements.txt` (opsional)

> Lewati bagian ini kalau file lo sudah sama.

Jalankan di PowerShell untuk mengganti isi file:

```sh
Set-Content -Path requirements.txt -Value @'
Flask>=2.3,<3
numpy>=1.23,<2
Pillow>=9.5
opencv-contrib-python>=4.8,<5
scikit-learn>=1.3,<1.6
onnxruntime>=1.16,<1.20
insightface>=0.7.0,<0.8
'@
```

---

## 🧠 4. Update `face_engine.py` (opsional)
Kalau lo belum pakai versi terbaru, update isi file.

Mau request ulang file versi lengkapnya?  
Tinggal bilang: **"ulang full face_engine.py"**

---

## 📥 5. Install Dependencies

### Upgrade pip:
```sh
python -m pip install --upgrade pip setuptools wheel
```

### Install dependency proyek:
```sh
pip install --prefer-binary -r requirements.txt
```

- Warning kuning = aman  
- Error merah = harus diperbaiki

---

## 🧪 6. Tes InsightFace

### Cek apakah InsightFace sudah terinstall:
```sh
python -c "from insightface.app import FaceAnalysis; print('OK')"
```

Kalau keluar `OK`, lanjut.

### Tes engine dan auto-download model InsightFace:
```sh
python -c "import face_engine; print(face_engine.get_engine_status())"
```

Output ideal:
```python
{'insightface_available': True, ...}
```

---

## ❌ Troubleshooting InsightFace

Kalau output menunjukkan:
```
'insightface_available': False
```

Kemungkinan penyebab:
- Internet mati saat download model
- Versi onnxruntime / insightface tidak cocok

### Solusi cepat:
```sh
pip uninstall -y insightface onnxruntime
pip install --prefer-binary onnxruntime==1.18.0 insightface==0.7.3
```

Lalu ulangi tes InsightFace.

---

## 🎉 7. Selesai

Kalau semua langkah di atas sudah beres, aplikasi udah siap dipakai.  
Happy hacking & selamat menikmati face recognition yang ngebut!

---

## 🔗 Akses Aplikasi

- **User**: http://127.0.0.1:5000/
- **Admin**: http://127.0.0.1:5000/admin/login
  - Username: `admin`
  - Password: `Cakra@123`

## 📊 Arsitektur Pipeline

```
Input Webcam → Deteksi (RetinaFace) → Alignment → 
Extract Embedding (ArcFace) → Normalize (L2) → 
Compare (Cosine Similarity) → Multi-Frame Voting → Output
```

## ⚙️ Konfigurasi

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `USE_INSIGHTFACE` | `1` | Set ke `0` untuk gunakan LBPH |
| `RECOGNITION_THRESHOLD` | `0.4` | Threshold similarity (0-1) |
| `DETECTION_THRESHOLD` | `0.5` | Threshold deteksi wajah |

## 📚 Dokumentasi Lengkap

Lihat **[README_INSIGHTFACE.md](README_INSIGHTFACE.md)** untuk:
- Setup detail
- Arsitektur sistem
- Tips meningkatkan akurasi
- API Reference
- Troubleshooting

## 🧪 Testing

```bash
python test_basic.py
python test_recognition_workflow.py
```

## 📝 Changelog

### v3.0.0 (Current)
- InsightFace only (LBPH dihapus)
- Face alignment dengan 5-point landmarks
- SQLite embedding storage
- Multi-frame voting dengan early stop
- Fokus pada akurasi maksimal

### v2.0.0 (Legacy)
- Migrasi ke InsightFace (RetinaFace + ArcFace)
- Face alignment dengan 5-point landmarks
- SQLite embedding storage
- Multi-frame voting dengan early stop
- Auto-fallback ke LBPH

### v1.0.0 (Legacy)
- Haar Cascade + LBPH

## 📄 Lisensi

Internal / Sesuai kebutuhan proyek.# FaceRec_Regist
# FaceRec_Regist
