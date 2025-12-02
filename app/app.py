"""
Face Detection and Recognition Web Application
Menggunakan InsightFace (RetinaFace + ArcFace) untuk akurasi tinggi.
Fallback ke LBPH jika InsightFace tidak tersedia.
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime

import cv2
import numpy as np
from flask import (
    Flask, render_template, request, jsonify,
    redirect, url_for, flash, session
)
from werkzeug.security import generate_password_hash, check_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====== PATH CONFIG ======
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "database_wajah")
MODEL_DIR = os.path.join(BASE_DIR, "model")
DB_PATH = os.path.join(BASE_DIR, "database.db")
MODEL_PATH = os.path.join(MODEL_DIR, "Trainer.yml")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# ====== FLASK APP ======
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, "templates"),
            static_folder=os.path.join(BASE_DIR, "static"))
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

# ====== FACE ENGINE SELECTION ======
# Force InsightFace only (LBPH removed)
FACE_ENGINE = "insightface"
try:
    import face_engine
    # face_engine.initialize() is called automatically on import
    logger.info("Using InsightFace engine for face recognition")
except Exception as e:
    logger.error(f"InsightFace not available: {e}")
    raise RuntimeError("InsightFace is required for this application")

# ====== ADMIN CREDENTIALS ======
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
_default_plain = os.environ.get("ADMIN_PASSWORD_PLAIN", "Cakra@123")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", generate_password_hash(_default_plain))

def login_required(view_func):
    def wrapper(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("admin_login"))
        return view_func(*args, **kwargs)
    wrapper.__name__ = view_func.__name__
    return wrapper

# ====== OpenCV SETUP (for LBPH fallback) ======
def get_cascade_path(fname="haarcascade_frontalface_default.xml"):
    try:
        return os.path.join(cv2.data.haarcascades, fname)
    except Exception:
        return fname

CASCADE_FILE_MAIN = get_cascade_path("haarcascade_frontalface_default.xml")
CASCADE_FILE_ALT2 = get_cascade_path("haarcascade_frontalface_alt2.xml")

# No LBPH fallback - InsightFace only

# ====== DB ======
def db_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def db_init():
    with db_connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                nik INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                dob TEXT NOT NULL,     -- bebas format dari form (YYYY-MM-DD / DD-MM-YYYY)
                address TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        # queue table agar admin dashboard tidak error
        conn.execute("""
            CREATE TABLE IF NOT EXISTS queues(
                poli_name TEXT PRIMARY KEY,
                next_number INTEGER NOT NULL
            )
        """)
        c = conn.execute("SELECT COUNT(*) AS c FROM queues").fetchone()
        if c["c"] == 0:
            for poli in ["Poli Umum", "Poli Gigi", "IGD"]:
                conn.execute("INSERT INTO queues(poli_name, next_number) VALUES(?, ?)", (poli, 0))
        conn.commit()
db_init()

# ====== UTIL ======
def parse_date_flexible(dob_str: str):
    if not dob_str:
        return None
    dob_str = dob_str.strip()
    formats = [
        "%Y-%m-%d", "%d-%m-%Y",
        "%Y/%m/%d", "%d/%m/%Y",
        "%Y.%m.%d", "%d.%m.%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dob_str, fmt)
        except Exception:
            continue
    return None

def calculate_age(dob_str: str) -> str:
    try:
        dt = parse_date_flexible(dob_str)
        if not dt:
            return "N/A"
        today = datetime.now()
        age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
        return f"{age} Tahun"
    except Exception:
        return "N/A"

def bytes_to_bgr(image_bytes: bytes):
    np_data = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(np_data, cv2.IMREAD_COLOR)

# ====== ROUTES (pages tetap) ======
@app.get("/")
def index():
    return render_template("user.html", active_page="home")

@app.get("/user/register")
def user_register():
    return render_template("user.html", active_page="daftar")

@app.get("/user/recognize")
def user_recognize():
    return render_template("user.html", active_page="verif")

@app.get("/admin/login")
def admin_login():
    return render_template("admin_login.html")

@app.post("/admin/login")
def admin_login_post():
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
        session["admin_logged_in"] = True
        session["admin_name"] = username
        return redirect(url_for("admin_dashboard"))
    flash("Username atau password salah.", "danger")
    return redirect(url_for("admin_login"))

@app.get("/admin/logout")
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))

@app.get("/admin")
@login_required
def admin_dashboard():
    with db_connect() as conn:
        rows = conn.execute("SELECT nik, name, dob, address, created_at FROM patients ORDER BY created_at DESC").fetchall()
        queues = conn.execute("SELECT poli_name, next_number FROM queues").fetchall()
    
    # Get data counts from embeddings
    try:
        data_count = face_engine.get_embedding_count()
    except Exception:
        data_count = 0

    # Get engine status
    engine_info = {
        'name': FACE_ENGINE.upper(),
        'model_loaded': False
    }

    if FACE_ENGINE == "insightface":
        try:
            status = face_engine.get_engine_status()
            engine_info['embeddings_count'] = status.get('total_embeddings', 0)
            engine_info['model_loaded'] = status.get('insightface_available', False)
        except Exception:
            pass

    return render_template(
        "admin_dashboard.html",
        patients=rows,
        model_loaded=engine_info['model_loaded'],
        model_name=engine_info['name'],
        foto_count=data_count,
        total_patients=len(rows),
        queues=queues,
        admin_name=session.get("admin_name", "Admin"),
        face_engine=FACE_ENGINE
    )

# ====== API: ENGINE STATUS ======
@app.get("/api/engine/status")
def api_engine_status():
    """Get face recognition engine status"""
    status = {
        'engine': FACE_ENGINE,
        'model_loaded': True  # Always loaded for InsightFace
    }

    try:
        status.update(face_engine.get_engine_status())
    except Exception as e:
        status['error'] = str(e)

    return jsonify(ok=True, status=status)

# ====== API: PATIENTS (READ) untuk tabel admin ======
@app.get("/api/patients")
def api_patients():
    with db_connect() as conn:
        rows = conn.execute("""
            SELECT nik, name, dob, address, created_at
            FROM patients
            ORDER BY created_at DESC
        """).fetchall()
    out = []
    for r in rows:
        out.append({
            "nik": r["nik"],
            "name": r["name"],
            "dob": r["dob"],
            "address": r["address"],
            "created_at": r["created_at"],
            "age": calculate_age(r["dob"])
        })
    return jsonify(ok=True, patients=out)

@app.get("/api/patient/<int:nik>")
def api_patient_detail(nik: int):
    with db_connect() as conn:
        r = conn.execute("""
            SELECT nik, name, dob, address, created_at
            FROM patients WHERE nik = ?
        """, (nik,)).fetchone()
    if not r:
        return jsonify(ok=False, msg="Pasien tidak ditemukan."), 404
    return jsonify(ok=True, patient={
        "nik": r["nik"],
        "name": r["name"],
        "dob": r["dob"],
        "address": r["address"],
        "created_at": r["created_at"],
        "age": calculate_age(r["dob"])
    })

# ====== API: REGISTER ======
@app.post("/api/register")
def api_register():
    """
    Register a new patient with face data.
    Uses InsightFace for high-accuracy face embedding when available.
    """
    nik_str = request.form.get("nik", "").strip()
    name = (request.form.get("nama") or request.form.get("name") or "").strip()
    dob = (request.form.get("ttl") or request.form.get("dob") or "").strip()
    address = (request.form.get("alamat") or request.form.get("address") or "").strip()

    files = request.files.getlist("files[]")
    if not files:
        files = request.files.getlist("frames[]")

    if not (nik_str and name and dob and address):
        return jsonify(ok=False, msg="Semua field wajib diisi."), 400
    try:
        nik = int(nik_str)
    except ValueError:
        return jsonify(ok=False, msg="NIK harus angka."), 400
    if not files:
        return jsonify(ok=False, msg="Tidak ada gambar dari webcam."), 400

    now_iso = datetime.now().isoformat(timespec="seconds")
    with db_connect() as conn:
        conn.execute("""
            INSERT INTO patients(nik, name, dob, address, created_at)
            VALUES(?, ?, ?, ?, ?)
            ON CONFLICT(nik) DO UPDATE SET name=excluded.name, dob=excluded.dob, address=excluded.address
        """, (nik, name, dob, address, now_iso))
        conn.commit()

    # Convert uploaded files to BGR images
    frames = []
    for f in files:
        try:
            img = bytes_to_bgr(f.read())
            if img is not None:
                frames.append(img)
        except Exception as e:
            logger.warning(f"Failed to process frame: {e}")

    if not frames:
        with db_connect() as conn:
            conn.execute("DELETE FROM patients WHERE nik = ?", (nik,))
            conn.commit()
        return jsonify(ok=False, msg="Tidak ada frame yang valid."), 400

    # Use InsightFace engine only
    try:
        enrolled, msg = face_engine.enroll_multiple_frames(frames, nik, min_embeddings=5)
        if enrolled > 0:
            logger.info(f"[REGISTER] InsightFace success for NIK {nik}: {enrolled} embeddings")
            return jsonify(ok=True, msg=f"Registrasi OK. {enrolled} embedding berhasil disimpan.")
        else:
            with db_connect() as conn:
                conn.execute("DELETE FROM patients WHERE nik = ?", (nik,))
                conn.commit()
            logger.warning(f"[REGISTER] InsightFace failed for NIK {nik}: {msg}")
            return jsonify(ok=False, msg="Registrasi gagal: Tidak dapat membuat embedding wajah."), 400
    except Exception as e:
        with db_connect() as conn:
            conn.execute("DELETE FROM patients WHERE nik = ?", (nik,))
            conn.commit()
        logger.error(f"[REGISTER] InsightFace error: {e}")
        return jsonify(ok=False, msg="Error pada engine face recognition."), 500


# ====== API: RECOGNIZE ======
@app.post("/api/recognize")
def api_recognize():
    """
    Recognize a face from uploaded frames.
    Uses InsightFace for high-accuracy recognition when available.
    Supports fast_mode parameter for auto-detection flow.
    """
    files = request.files.getlist("files[]")
    if not files:
        files = request.files.getlist("frames[]")

    if not files:
        return jsonify(ok=False, msg="Tidak ada gambar yang dikirim."), 400

    # Check if fast_mode is enabled (for auto-detection)
    fast_mode = request.form.get("fast_mode", "false").lower() == "true"

    # Convert uploaded files to BGR images
    frames = []
    for f in files:
        try:
            img = bytes_to_bgr(f.read())
            if img is not None:
                frames.append(img)
        except Exception:
            pass

    if not frames:
        return jsonify(ok=True, found=False, msg="Tidak ada frame yang valid.")

    # Use InsightFace engine only
    try:
        result = face_engine.recognize_face_multi_frame(frames, fast_mode=fast_mode)
        if result is not None:
            nik = result['nik']
            with db_connect() as conn:
                row = conn.execute(
                    "SELECT nik, name, dob, address FROM patients WHERE nik = ?",
                    (nik,)
                ).fetchone()

            if row:
                age = calculate_age(row["dob"])
                confidence = result.get('confidence', int(result['similarity'] * 100))

                logger.info(f"[RECOGNIZE] InsightFace success: NIK={nik}, sim={result['similarity']:.3f}, fast_mode={fast_mode}")
                return jsonify(
                    ok=True, found=True,
                    nik=row["nik"], name=row["name"], dob=row["dob"], address=row["address"],
                    age=age, confidence=confidence,
                    engine="insightface",
                    similarity=result['similarity']
                )
            else:
                logger.warning(f"[RECOGNIZE] InsightFace matched NIK {nik} but not found in patients DB")
                return jsonify(ok=True, found=False, msg="Wajah dikenali tetapi data pasien tidak ditemukan.")
        else:
            return jsonify(ok=True, found=False, msg="Wajah tidak dikenali.")
    except Exception as e:
        logger.error(f"[RECOGNIZE] InsightFace error: {e}")
        return jsonify(ok=False, msg="Error pada engine face recognition."), 500

# ====== API: QUEUE (untuk sinkron Admin <-> User, tidak diubah) ======
@app.post("/api/queue/assign")
def api_queue_assign():
    data = request.json if request.is_json else {}
    poli = (data.get("poli") or "").strip()
    if poli not in ["Poli Umum", "Poli Gigi", "IGD"]:
        return jsonify(ok=False, msg="Poli tidak valid."), 400
    with db_connect() as conn:
        row = conn.execute("SELECT next_number FROM queues WHERE poli_name=?", (poli,)).fetchone()
        if not row:
            return jsonify(ok=False, msg="Poli tidak ditemukan."), 404
        last_number = row["next_number"]
        nomor = last_number + 1  # nomor baru untuk user
        conn.execute("UPDATE queues SET next_number=? WHERE poli_name=?", (nomor, poli))
        conn.commit()
    return jsonify(ok=True, poli=poli, nomor=nomor)

@app.post("/api/queue/set")
@login_required
def api_queue_set():
    data = request.json if request.is_json else {}
    poli = (data.get("poli") or "").strip()
    nomor = data.get("nomor")
    if poli not in ["Poli Umum", "Poli Gigi", "IGD"]:
        return jsonify(ok=False, msg="Poli tidak valid."), 400
    try:
        n = int(nomor)
        if n < 0: raise ValueError
    except ValueError:
        return jsonify(ok=False, msg="Nomor harus >= 0."), 400
    with db_connect() as conn:
        conn.execute("UPDATE queues SET next_number=? WHERE poli_name=?", (n, poli))
        conn.commit()
    return jsonify(ok=True, msg=f"Nomor terakhir {poli} di-set ke {n}.")

# ====== RETRAIN FUNCTION ======
def retrain_after_change():
    """Retrain model after changes (placeholder - InsightFace doesn't need retraining)"""
    try:
        # For InsightFace, we don't need to retrain like LBPH
        # Just reload embeddings to ensure consistency
        face_engine.load_all_embeddings()
        return True, "Model berhasil di-reload"
    except Exception as e:
        logger.error(f"Retrain failed: {e}")
        return False, str(e)

# ====== ADMIN: RETRAIN / DELETE (tidak diubah) ======
@app.post("/admin/retrain")
@login_required
def admin_retrain():
    ok, msg = retrain_after_change()
    flash(("Retrain sukses." if ok else f"Retrain gagal: {msg}"), "success" if ok else "danger")
    return redirect(url_for("admin_dashboard"))

@app.post("/admin/patient/<int:nik>/delete")
@login_required
def admin_delete_patient(nik: int):
    """Delete patient and their face data"""
    with db_connect() as conn:
        conn.execute("DELETE FROM patients WHERE nik = ?", (nik,))
        conn.commit()
    
    # Delete embeddings (InsightFace only)
    try:
        deleted_emb = face_engine.delete_embeddings_for_nik(nik)
        logger.info(f"Deleted {deleted_emb} embeddings for NIK {nik}")
        flash(f"Hapus NIK {nik}: {deleted_emb} embedding dihapus.", "success")
    except Exception as e:
        logger.warning(f"Failed to delete embeddings: {e}")
        flash(f"Hapus NIK {nik}: Gagal menghapus embedding.", "danger")
    return redirect(url_for("admin_dashboard"))

@app.post("/admin/patient/update")
@login_required
def admin_update_patient():
    """Update patient information"""
    try:
        old_nik_str = request.form.get("old_nik", "").strip()
        nik_str = request.form.get("nik", "").strip()
        dob = request.form.get("dob", "").strip()
        address = request.form.get("address", "").strip()

        if not all([old_nik_str, nik_str, dob, address]):
            return jsonify(ok=False, msg="Semua field wajib diisi."), 400

        old_nik = int(old_nik_str)
        nik = int(nik_str)

        with db_connect() as conn:
            if nik != old_nik and conn.execute("SELECT 1 FROM patients WHERE nik = ?", (nik,)).fetchone():
                return jsonify(ok=False, msg=f"NIK {nik} sudah terdaftar untuk pasien lain."), 409

            conn.execute("""
                UPDATE patients SET nik=?, dob=?, address=? WHERE nik=?
            """, (nik, dob, address, old_nik))
            conn.commit()

        if nik != old_nik:
            # Update embeddings (InsightFace only)
            try:
                updated_emb = face_engine.update_nik_in_embeddings(old_nik, nik)
                logger.info(f"Updated {updated_emb} embeddings from NIK {old_nik} to {nik}")
                msg_rename = f"{updated_emb} embedding di-update."
            except Exception as e:
                logger.warning(f"Failed to update embeddings: {e}")
                return jsonify(ok=False, msg="Data diupdate tapi gagal update embedding."), 500
        else:
            msg_rename = "NIK tidak berubah."

        return jsonify(ok=True, msg=f"Data pasien NIK {old_nik} berhasil diupdate. {msg_rename}")

    except ValueError:
        return jsonify(ok=False, msg="NIK harus berupa angka."), 400
    except Exception as e:
        logger.error(f"Error update patient: {e}")
        return jsonify(ok=False, msg=f"Terjadi error di server: {e}"), 500

    # ... (kode sebelumnya tetap sama)

# ====== API BARU: CHECK FACE (Untuk Auto-Trigger) ======
@app.post("/api/check_face")
def api_check_face():
    """
    API ringan untuk mengecek apakah ada wajah di frame.
    Digunakan untuk auto-trigger di frontend.
    Uses OpenCV Haar Cascade for fast detection of closest face.
    """
    file = request.files.get("frame")
    if not file:
        return jsonify(ok=False, found=False)

    try:
        # Baca gambar
        img = bytes_to_bgr(file.read())
        # Use OpenCV for fast detection
        found = face_engine.detect_closest_face_opencv(img)
        return jsonify(ok=True, found=found)
    except Exception as e:
        logger.warning(f"Check face error: {e}")
        return jsonify(ok=False, found=False)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
