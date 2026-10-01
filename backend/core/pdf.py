import io
import os
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor


def _qr_image(data: str):
    qr = qrcode.QRCode(version=1, box_size=10, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0369A1", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def build_letter_pdf(letter: dict, verify_url: str, region_path: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    primary = HexColor("#0369A1")

    # header band
    c.setFillColor(primary)
    c.rect(0, h - 28 * mm, w, 28 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(20 * mm, h - 15 * mm, "RAKATIN")
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, h - 21 * mm, "Warga Terhubung, Lingkungan Maju")
    c.drawRightString(w - 20 * mm, h - 15 * mm, region_path or "")

    # title
    c.setFillColor(HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(w / 2, h - 45 * mm, letter.get("letter_type_name", "SURAT").upper())
    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, h - 52 * mm, f"Nomor: {letter.get('doc_number', '-')}")
    c.setStrokeColor(primary)
    c.setLineWidth(1)
    c.line(20 * mm, h - 56 * mm, w - 20 * mm, h - 56 * mm)

    # body
    c.setFont("Helvetica", 11)
    y = h - 70 * mm
    lines = [
        "Yang bertanda tangan di bawah ini, pengurus wilayah menerangkan bahwa:",
        "",
        f"Nama        : {letter.get('requester_name', '-')}",
    ]
    for k, v in (letter.get("data") or {}).items():
        lines.append(f"{k.capitalize():<12}: {v}")
    lines += [
        "",
        "adalah benar warga di wilayah kami dan surat ini diterbitkan untuk",
        "keperluan sebagaimana tercantum di atas.",
        "",
        "Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.",
    ]
    for ln in lines:
        c.drawString(25 * mm, y, ln)
        y -= 7 * mm

    # approval trail
    y -= 4 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(25 * mm, y, "Riwayat Persetujuan:")
    c.setFont("Helvetica", 9)
    for s in letter.get("steps", []):
        y -= 6 * mm
        c.drawString(28 * mm, y, f"- {s.get('role')}: {s.get('status')} ({(s.get('at') or '')[:10]})")

    # QR verification
    qr_buf = _qr_image(verify_url)
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(qr_buf), w - 55 * mm, 25 * mm, 35 * mm, 35 * mm)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#64748B"))
    c.drawCentredString(w - 37.5 * mm, 22 * mm, "Pindai untuk verifikasi")

    # footer
    c.setFont("Helvetica", 7)
    c.drawString(20 * mm, 12 * mm, "Dokumen ini diterbitkan secara elektronik melalui Rakatin dan sah tanpa tanda tangan basah.")
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
