# debug_lbph.py
import cv2, os
from app import app import detect_largest_face, DATA_DIR

IMG = "face_good.jpg"  # ganti nama kalau beda
img = cv2.imread(IMG)
if img is None:
    print("Gagal load", IMG); raise SystemExit(1)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
roi, rect = detect_largest_face(gray)
out = img.copy()
if rect:
    x,y,w,h = rect
    cv2.rectangle(out, (x,y), (x+w, y+h), (0,255,0), 2)
    cv2.putText(out, "DETECTED", (x, max(0,y-6)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)
else:
    cv2.putText(out, "NO FACE", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,255), 2)

out_path = "debug_lbph_out.jpg"
cv2.imwrite(out_path, out)
print("Wrote", out_path)
