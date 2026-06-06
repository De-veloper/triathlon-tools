#!/usr/bin/env python3
"""Generate iOS App Store screenshots for all required sizes."""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

ASSETS = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = ASSETS

NAVY_DARK  = (11, 24, 56)
NAVY_LIGHT = (27, 58, 120)
ACCENT     = (59, 130, 246)
WHITE      = (255, 255, 255)
LIGHT_BLUE = (186, 210, 255)

# (filename, headline line1, headline line2)
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

# iPad pairs: (left_screen_index, right_screen_index, headline1, headline2)
IPAD_PAIRS = [
    (0, 1, "All your triathlon tools", "in one place."),
    (2, 3, "Train smarter,", "race faster."),
    (4, 2, "Built for", "serious triathletes."),
    (3, 4, "Every tool you need", "to go faster."),
    (1, 0, "Pack smart.", "Race confident."),
]

# portrait sizes: (tag, W, H, layout)
#   layout = "phone"  → single phone centered (iPhone)
#   layout = "ipad"   → two phones side by side
SIZES = [
    # iPhone 6.5"
    ("6.5in",  1242, 2688, "phone"),
    # iPhone 6.7"
    ("6.7in",  1284, 2778, "phone"),
    # iPhone 6.9" variants
    ("6.9in_a", 1260, 2736, "phone"),
    ("6.9in_b", 1320, 2868, "phone"),
    ("6.9in_c", 1290, 2796, "phone"),
    # iPad Pro 11"
    ("ipad11",  2064, 2752, "ipad"),
    # iPad Pro 12.9"
    ("ipad129", 2048, 2732, "ipad"),
]


def load_font(size, bold=False):
    candidates = [
        f"/System/Library/Fonts/SFProDisplay-{'Bold' if bold else 'Regular'}.otf",
        f"/System/Library/Fonts/Supplemental/Arial.ttf",
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
        t = (y / H) * 0.6
        r = int(NAVY_DARK[0] + (NAVY_LIGHT[0] - NAVY_DARK[0]) * t)
        g = int(NAVY_DARK[1] + (NAVY_LIGHT[1] - NAVY_DARK[1]) * t)
        b = int(NAVY_DARK[2] + (NAVY_LIGHT[2] - NAVY_DARK[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def draw_caption(canvas, W, cap_h, line1, line2, font_scale=1.0):
    draw = ImageDraw.Draw(canvas)
    font_large = load_font(int(W * 0.068 * font_scale), bold=True)
    font_small = load_font(int(W * 0.068 * font_scale), bold=True)

    bb1 = draw.textbbox((0, 0), line1, font=font_large)
    bb2 = draw.textbbox((0, 0), line2, font=font_small)
    lh1 = bb1[3] - bb1[1]
    lh2 = bb2[3] - bb2[1]
    gap = int(W * 0.01)
    total_h = lh1 + gap + lh2
    text_y = (cap_h - total_h) // 2

    draw.text(((W - (bb1[2] - bb1[0])) // 2, text_y),
              line1, font=font_large, fill=WHITE)
    draw.text(((W - (bb2[2] - bb2[0])) // 2, text_y + lh1 + gap),
              line2, font=font_small, fill=ACCENT)

    # Accent dot
    dot_r = max(6, int(W * 0.007))
    dot_y = text_y - dot_r * 3
    if dot_y > dot_r:
        draw.ellipse([W // 2 - dot_r, dot_y - dot_r,
                      W // 2 + dot_r, dot_y + dot_r], fill=ACCENT)


def add_shadow(canvas, x, y, w, h, radius=40, blur=30, alpha=130):
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = int(canvas.width * 0.008)
    sd.rounded_rectangle([x + off, y + off, x + w + off, y + h + off],
                          radius=radius, fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base = canvas.convert("RGBA")
    base.alpha_composite(shadow)
    return base.convert("RGB")


def paste_phone(canvas, src_path, dest_x, dest_y, pw, ph, radius=44):
    src = Image.open(src_path).convert("RGB")
    # Crop source to match target aspect ratio
    target_ar = pw / ph
    src_ar = src.width / src.height
    if src_ar > target_ar:
        new_w = int(src.height * target_ar)
        src = src.crop(((src.width - new_w) // 2, 0, (src.width + new_w) // 2, src.height))
    else:
        new_h = int(src.width / target_ar)
        src = src.crop((0, 0, src.width, min(new_h, src.height)))

    phone = src.resize((pw, ph), Image.LANCZOS)

    canvas = add_shadow(canvas, dest_x, dest_y, pw, ph,
                        radius=radius, blur=int(pw * 0.04), alpha=130)

    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=radius, fill=255)
    phone_rgba = phone.convert("RGBA")
    phone_rgba.putalpha(mask)
    canvas.paste(phone_rgba, (dest_x, dest_y), phone_rgba)

    bd = ImageDraw.Draw(canvas)
    bd.rounded_rectangle([dest_x, dest_y, dest_x + pw, dest_y + ph],
                          radius=radius, outline=(255, 255, 255, 50), width=2)
    return canvas


def make_phone_screenshot(src_path, line1, line2, W, H, tag, index):
    canvas = make_gradient(W, H)

    cap_h = int(H * 0.145)
    h_pad = int(W * 0.055)
    pw = W - h_pad * 2
    ph = int(pw * 2622 / 1206)
    avail_h = H - cap_h - int(H * 0.02)
    if ph > avail_h:
        ph = avail_h
        pw = int(ph * 1206 / 2622)
        h_pad = (W - pw) // 2

    shot_x = h_pad
    shot_y = cap_h

    draw_caption(canvas, W, cap_h, line1, line2)
    canvas = paste_phone(canvas, src_path, shot_x, shot_y, pw, ph,
                         radius=int(pw * 0.04))

    out = os.path.join(OUT_DIR, f"store_{tag}_{index+1:02d}.png")
    canvas.save(out, "PNG", optimize=True)
    print(f"  {os.path.basename(out)}  ({W}x{H})")


def make_ipad_screenshot(left_path, right_path, line1, line2, W, H, tag, index):
    canvas = make_gradient(W, H)

    cap_h = int(H * 0.135)
    h_pad = int(W * 0.03)
    gap = int(W * 0.02)
    pw = (W - h_pad * 2 - gap) // 2
    ph = int(pw * 2622 / 1206)
    avail_h = H - cap_h - int(H * 0.02)
    if ph > avail_h:
        ph = avail_h
        pw = int(ph * 1206 / 2622)

    total_w = pw * 2 + gap
    start_x = (W - total_w) // 2
    start_y = cap_h + (avail_h - ph) // 2

    draw_caption(canvas, W, cap_h, line1, line2, font_scale=0.85)
    canvas = paste_phone(canvas, left_path,  start_x,          start_y, pw, ph,
                         radius=int(pw * 0.04))
    canvas = paste_phone(canvas, right_path, start_x + pw + gap, start_y, pw, ph,
                         radius=int(pw * 0.04))

    out = os.path.join(OUT_DIR, f"store_{tag}_{index+1:02d}.png")
    canvas.save(out, "PNG", optimize=True)
    print(f"  {os.path.basename(out)}  ({W}x{H})")


print("Generating all iOS App Store screenshots...\n")

for tag, W, H, layout in SIZES:
    print(f"{tag}  ({W}x{H})  [{layout}]")
    if layout == "phone":
        for i, (fname, l1, l2) in enumerate(SCREENS):
            make_phone_screenshot(
                os.path.join(ASSETS, fname), l1, l2, W, H, tag, i)
    else:
        for i, (li, ri, l1, l2) in enumerate(IPAD_PAIRS):
            make_ipad_screenshot(
                os.path.join(ASSETS, SCREENS[li][0]),
                os.path.join(ASSETS, SCREENS[ri][0]),
                l1, l2, W, H, tag, i)
    print()

print("Done.")
