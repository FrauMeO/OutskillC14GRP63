# Regenerates every app icon and launch image from the brand icon (needs Python 3 and Pillow).
#   python3 docs/mobile/generate-icons.py "$(pwd)"
# Source: Brand System 2026 / byp-and-miah-v0 / 01-logos / byp-app-icon-1024.png (path below).
# @capacitor/assets was not used: its last release (3.0.5) is from March 2024.
import glob, sys
from PIL import Image, ImageDraw

SRC = "/Users/olmstedhome/My Drive/Brand System 2026/_work-in-progress/byp-and-miah-v0/01-logos/byp-app-icon-1024.png"
ROOT = sys.argv[1]
im = Image.open(SRC).convert("RGB")
bg = im.getpixel((20, 20))  # the spruce background of the icon, #1E3B37

# iOS app icon: 1024, no alpha
im.save(f"{ROOT}/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")


def splash(w, h, frac=0.30):
    c = Image.new("RGB", (w, h), bg)
    s = int(min(w, h) * frac)
    c.paste(im.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2))
    return c


for f in glob.glob(f"{ROOT}/ios/App/App/Assets.xcassets/Splash.imageset/*.png"):
    splash(2732, 2732).save(f)
for f in glob.glob(f"{ROOT}/android/app/src/main/res/drawable*/splash.png"):
    w, h = Image.open(f).size
    splash(w, h).save(f)

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fg = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for d, s in sizes.items():
    base = f"{ROOT}/android/app/src/main/res/mipmap-{d}"
    sq = im.resize((s, s), Image.LANCZOS)
    sq.save(f"{base}/ic_launcher.png")
    mask = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    r = sq.convert("RGBA")
    r.putalpha(mask.resize((s, s), Image.LANCZOS))
    r.save(f"{base}/ic_launcher_round.png")
    F = fg[d]  # adaptive icon: art kept inside the central 60% so no phone shape crops it
    canvas = Image.new("RGB", (F, F), bg)
    inner = int(F * 0.60)
    canvas.paste(im.resize((inner, inner), Image.LANCZOS), ((F - inner) // 2, (F - inner) // 2))
    canvas.save(f"{base}/ic_launcher_foreground.png")

open(f"{ROOT}/android/app/src/main/res/values/ic_launcher_background.xml", "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % bg
)
