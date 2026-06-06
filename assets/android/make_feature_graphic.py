#!/usr/bin/env python3
"""Generate 1024x500 Google Play feature graphic for Triathlon Tools."""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

W, H = 1024, 500
NAVY_DARK = (11, 24, 56)
NAVY_MID  = (18, 38, 85)
NAVY_LIGHT = (27, 58, 120)
ACCENT    = (59, 130, 246)   # blue-500
WHITE     = (255, 255, 255)
LIGHT_BLUE = (186, 210, 255)

ASSETS = os.path.dirname(__file__) + "/.."

# ── Canvas with gradient ─────────────────────────────────────────────────────
canvas = Image.new("RGB", (W, H), NAVY_DARK)
grad = ImageDraw.Draw(canvas)
for x in range(W):
    t = x / W
    r = int(NAVY_DARK[0] + (NAVY_LIGHT[0] - NAVY_DARK[0]) * t)
    g = int(NAVY_DARK[1] + (NAVY_LIGHT[1] - NAVY_DARK[1]) * t)
    b = int(NAVY_DARK[2] + (NAVY_LIGHT[2] - NAVY_DARK[2]) * t)
    grad.line([(x, 0), (x, H)], fill=(r, g, b))

# ── Subtle decorative circles ────────────────────────────────────────────────
deco = ImageDraw.Draw(canvas)
for cx, cy, r, alpha in [
    (80, 450, 220, 15),
    (350, -60, 180, 10),
    (900, 520, 200, 12),
]:
    circ = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(circ)
    cd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, alpha))
    canvas.paste(Image.new("RGB", (W, H), (0, 0, 0)), mask=circ.split()[3])
    canvas = canvas.convert("RGB")
    # re-draw circles as semi-transparent overlay
for cx, cy, r, col in [
    (75, 445, 200, (255, 255, 255, 12)),
    (340, -50, 170, (255, 255, 255, 8)),
    (920, 510, 190, (59, 130, 246, 18)),
]:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=2)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")

# ── App icon (left side) ─────────────────────────────────────────────────────
ICON_SIZE = 110
icon_raw = Image.open(f"{ASSETS}/icon-1024.png").convert("RGBA")
icon = icon_raw.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)

# Rounded mask for icon
mask = Image.new("L", (ICON_SIZE, ICON_SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, ICON_SIZE - 1, ICON_SIZE - 1], radius=22, fill=255)
icon.putalpha(mask)

icon_x, icon_y = 52, 140
canvas.paste(icon, (icon_x, icon_y), icon)

# ── Text ─────────────────────────────────────────────────────────────────────
draw = ImageDraw.Draw(canvas)

def load_font(size, bold=False):
    candidates = [
        f"/System/Library/Fonts/{'SFProDisplay-Bold' if bold else 'SFProDisplay-Regular'}.otf",
        f"/System/Library/Fonts/Supplemental/{'Arial Bold' if bold else 'Arial'}.ttf",
        f"/System/Library/Fonts/{'Helvetica' if not bold else 'Helvetica'}.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

font_title = load_font(38, bold=True)
font_sub   = load_font(17)
font_tag   = load_font(14)

text_x = icon_x + ICON_SIZE + 18
title_y = icon_y + 10
draw.text((text_x, title_y),      "Triathlon",   font=font_title, fill=WHITE)
draw.text((text_x, title_y + 48), "Tools",       font=font_title, fill=ACCENT)

sub_y = title_y + 106
draw.text((text_x, sub_y), "Calculators & utilities", font=font_sub, fill=LIGHT_BLUE)
draw.text((text_x, sub_y + 24), "for training and racing.", font=font_sub, fill=LIGHT_BLUE)

# Feature bullets
features = ["Pace Calculator", "Power Zones", "Race Planner", "Tire Pressure", "Gear Ratio"]
bullet_x = icon_x
bullet_y = icon_y + ICON_SIZE + 22
for i, feat in enumerate(features):
    col = i % 2
    row = i // 2
    bx = bullet_x + col * 170
    by = bullet_y + row * 26
    draw.text((bx, by), f"• {feat}", font=font_tag, fill=LIGHT_BLUE)

# ── Phone screenshots (right side) ──────────────────────────────────────────
PHONE_H = 410
PHONE_W = int(PHONE_H * 1080 / 2400)  # ≈ 184 px
GAP = 18
PHONE_RADIUS = 14

screenshots = [
    f"{ASSETS}/android/Screenshot_1780716111.png",   # checklist
    f"{ASSETS}/android/Screenshot_1780716140.png",   # pace calc
]

# Total phones width
total_phones_w = PHONE_W * 2 + GAP
right_area_start = 440
right_area_w = W - right_area_start
phones_left = right_area_start + (right_area_w - total_phones_w) // 2
phones_top = (H - PHONE_H) // 2 - 10   # slightly above center

def place_phone(src_path, dest_x, dest_y):
    shot = Image.open(src_path).convert("RGBA")
    # Show top crop (most interesting part)
    crop_h = int(shot.width * PHONE_H / PHONE_W)
    cropped = shot.crop((0, 0, shot.width, min(crop_h, shot.height)))
    phone = cropped.resize((PHONE_W, PHONE_H), Image.LANCZOS)

    # Drop shadow
    shadow_offset = 8
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [dest_x + shadow_offset, dest_y + shadow_offset,
         dest_x + PHONE_W + shadow_offset, dest_y + PHONE_H + shadow_offset],
        radius=PHONE_RADIUS, fill=(0, 0, 0, 90)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.paste(Image.new("RGB", (W, H)), mask=shadow.split()[3])

    # Rounded mask
    rounded_mask = Image.new("L", (PHONE_W, PHONE_H), 0)
    ImageDraw.Draw(rounded_mask).rounded_rectangle(
        [0, 0, PHONE_W - 1, PHONE_H - 1], radius=PHONE_RADIUS, fill=255
    )
    phone.putalpha(rounded_mask)
    canvas.paste(phone, (dest_x, dest_y), phone)

    # Subtle border
    bd = ImageDraw.Draw(canvas)
    bd.rounded_rectangle(
        [dest_x, dest_y, dest_x + PHONE_W, dest_y + PHONE_H],
        radius=PHONE_RADIUS, outline=(255, 255, 255, 40), width=1
    )

place_phone(screenshots[0], phones_left,            phones_top)
place_phone(screenshots[1], phones_left + PHONE_W + GAP, phones_top)

# ── Divider line ─────────────────────────────────────────────────────────────
div = ImageDraw.Draw(canvas)
div.line([(right_area_start - 30, 60), (right_area_start - 30, H - 60)],
         fill=(255, 255, 255, 30), width=1)

# ── Save ─────────────────────────────────────────────────────────────────────
out_path = os.path.join(os.path.dirname(__file__), "feature_graphic_1024x500.png")
canvas.save(out_path, "PNG", optimize=True)
print(f"Saved: {out_path}")
print(f"Size: {canvas.size}")
