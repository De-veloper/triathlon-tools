#!/usr/bin/env python3
"""Generate iOS App Store screenshots at 1242x2688 and 1284x2778."""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

ASSETS = os.path.dirname(os.path.abspath(__file__))
ICON_PATH = os.path.join(ASSETS, "..", "icon-1024.png")
OUT_DIR = ASSETS

NAVY_DARK  = (11, 24, 56)
NAVY_LIGHT = (27, 58, 120)
ACCENT     = (59, 130, 246)
WHITE      = (255, 255, 255)
LIGHT_BLUE = (186, 210, 255)
CAPTION_BG = (18, 38, 90)

SCREENS = [
    ("Simulator Screenshot - iPhone 17 - 2026-06-05 at 19.31.24.png",
     "All your triathlon tools", "in one place."),
    ("Simulator Screenshot - iPhone 17 - 2026-06-05 at 19.31.29.png",
     "Never forget your", "race day gear."),
    ("Simulator Screenshot - iPhone 17 - 2026-06-05 at 19.32.00.png",
     "Calculate your", "perfect pace."),
    ("Simulator Screenshot - iPhone 17 - 2026-06-05 at 19.32.21.png",
     "Train smarter with", "power zones."),
    ("Simulator Screenshot - iPhone 17 - 2026-06-05 at 19.32.12.png",
     "Chase your", "Kona dream."),
]

SIZES = [
    ("6.5in", 1242, 2688),
    ("6.7in", 1284, 2778),
]

def load_font(size, bold=False):
    candidates = [
        f"/System/Library/Fonts/SFProDisplay-{'Bold' if bold else 'Regular'}.otf",
        f"/System/Library/Fonts/Supplemental/Arial{'%20Bold' if bold else ''}.ttf",
        f"/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_gradient(W, H):
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(NAVY_DARK[0] + (NAVY_LIGHT[0] - NAVY_DARK[0]) * t * 0.6)
        g = int(NAVY_DARK[1] + (NAVY_LIGHT[1] - NAVY_DARK[1]) * t * 0.6)
        b = int(NAVY_DARK[2] + (NAVY_LIGHT[2] - NAVY_DARK[2]) * t * 0.6)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def add_shadow(canvas, x, y, w, h, radius=40, blur=30, alpha=120):
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = 18
    sd.rounded_rectangle([x + off, y + off, x + w + off, y + h + off],
                          radius=radius, fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base = canvas.convert("RGBA")
    base.alpha_composite(shadow)
    return base.convert("RGB")


def rounded_paste(canvas, img, x, y, radius=40):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    img_rgba = img.convert("RGBA")
    img_rgba.putalpha(mask)
    canvas.paste(img_rgba, (x, y), img_rgba)


def make_screenshot(src_path, line1, line2, W, H, size_tag, index):
    canvas = make_gradient(W, H)

    # Caption area height (~14% of canvas)
    cap_h = int(H * 0.145)
    pad = int(W * 0.07)  # side padding for screenshot

    # Screenshot dimensions
    shot_w = W - pad * 2
    src = Image.open(src_path).convert("RGB")
    shot_h = int(shot_w * src.height / src.width)
    # If screenshot taller than remaining space, crop it
    avail_h = H - cap_h - int(H * 0.01)
    if shot_h > avail_h:
        # Crop source proportionally
        crop_src_h = int(src.width * avail_h / shot_w)
        src = src.crop((0, 0, src.width, min(crop_src_h, src.height)))
        shot_h = avail_h

    shot = src.resize((shot_w, shot_h), Image.LANCZOS)
    shot_x = pad
    shot_y = cap_h

    # Drop shadow
    canvas = add_shadow(canvas, shot_x, shot_y, shot_w, shot_h,
                        radius=44, blur=35, alpha=140)

    # Paste screenshot with rounded corners
    rounded_paste(canvas, shot, shot_x, shot_y, radius=44)

    # Subtle border on screenshot
    bd = ImageDraw.Draw(canvas)
    bd.rounded_rectangle([shot_x, shot_y, shot_x + shot_w, shot_y + shot_h],
                          radius=44, outline=(255, 255, 255, 60), width=2)

    # Caption area
    draw = ImageDraw.Draw(canvas)

    font_large = load_font(int(W * 0.078), bold=True)
    font_small = load_font(int(W * 0.078), bold=True)

    # Two-line headline centered in caption area
    line1_bb = draw.textbbox((0, 0), line1, font=font_large)
    line2_bb = draw.textbbox((0, 0), line2, font=font_small)
    lh1 = line1_bb[3] - line1_bb[1]
    lh2 = line2_bb[3] - line2_bb[1]
    gap = int(W * 0.012)
    total_text_h = lh1 + gap + lh2
    text_y = (cap_h - total_text_h) // 2

    line1_w = line1_bb[2] - line1_bb[0]
    line2_w = line2_bb[2] - line2_bb[0]

    draw.text(((W - line1_w) // 2, text_y), line1,
              font=font_large, fill=WHITE)
    draw.text(((W - line2_w) // 2, text_y + lh1 + gap), line2,
              font=font_small, fill=ACCENT)

    # Accent dot separator above text
    dot_r = int(W * 0.008)
    dot_y = text_y - dot_r * 3
    dot_x = W // 2
    if dot_y > 0:
        draw.ellipse([dot_x - dot_r, dot_y - dot_r,
                      dot_x + dot_r, dot_y + dot_r], fill=ACCENT)

    out_name = f"store_{size_tag}_{index+1:02d}.png"
    out_path = os.path.join(OUT_DIR, out_name)
    canvas.save(out_path, "PNG", optimize=True)
    print(f"  Saved: {out_name}  ({W}x{H})")
    return out_path


print("Generating iOS App Store screenshots...")
for size_tag, W, H in SIZES:
    print(f"\n{size_tag}  ({W}x{H})")
    for i, (fname, l1, l2) in enumerate(SCREENS):
        src = os.path.join(ASSETS, fname)
        make_screenshot(src, l1, l2, W, H, size_tag, i)

print("\nDone.")
