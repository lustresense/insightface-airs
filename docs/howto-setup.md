# 🔥 web-face — Face Recognition Web App

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
