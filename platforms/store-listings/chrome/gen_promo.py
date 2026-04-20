"""Generate Chrome Web Store promo tiles — no alpha, 24-bit RGB."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))

BG       = (15, 15, 30)
PANEL    = (22, 22, 45)
TEAL     = (0, 212, 170)
TEAL_DIM = (0, 140, 110)
GREEN    = (80, 200, 120)
WHITE    = (240, 240, 250)
GRAY     = (130, 130, 160)
DARK     = (40, 40, 70)

def sans(size):
    for p in ["C:/Windows/Fonts/segoeui.ttf","C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def mono(size):
    for p in ["C:/Windows/Fonts/consola.ttf","C:/Windows/Fonts/cour.ttf","C:/Windows/Fonts/lucon.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def rr(d, xy, r, fill, outline=None, w=1):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=w)

# ── SMALL TILE 440×280 ────────────────────────────────────────────────────────
def small_tile():
    W, H = 440, 280
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Subtle grid lines
    for x in range(0, W, 44):
        d.line([(x,0),(x,H)], fill=(25,25,48), width=1)
    for y in range(0, H, 28):
        d.line([(0,y),(W,y)], fill=(25,25,48), width=1)

    # Glow circle behind logo
    for r in range(60, 0, -4):
        alpha = int(r * 0.6)
        d.ellipse([W//2-r, 32-r//3, W//2+r, 32+r//3*2], fill=(0, max(0,alpha), max(0,alpha-30)))

    # Logo dot
    d.ellipse([W//2-14, 28, W//2+14, 56], fill=TEAL)
    d.ellipse([W//2-7, 35, W//2+7, 49], fill=BG)

    # Title
    title = "EnigmAgent"
    tw = int(d.textlength(title, font=sans(32)))
    d.text(((W-tw)//2, 66), title, fill=WHITE, font=sans(32))

    # Subtitle
    sub = "Local AI Secret Vault"
    sw = int(d.textlength(sub, font=sans(14)))
    d.text(((W-sw)//2, 106), sub, fill=GRAY, font=sans(14))

    # Placeholder pill
    pill = '{{OPENAI_KEY}}'
    pw = int(d.textlength(pill, font=mono(16)))
    rr(d, [(W-pw)//2-14, 132, (W+pw)//2+14, 162], 8, (15,40,35), TEAL_DIM, 1)
    d.text(((W-pw)//2, 136), pill, fill=TEAL, font=mono(16))

    # Arrow + resolved
    cx = W//2
    d.polygon([(cx-6,168),(cx+6,168),(cx,178)], fill=GREEN)
    resolved = '"sk-proj-••••••••"'
    rw = int(d.textlength(resolved, font=mono(14)))
    rr(d, [(W-rw)//2-12, 184, (W+rw)//2+12, 208], 6, (20,50,35), GREEN, 1)
    d.text(((W-rw)//2, 187), resolved, fill=GREEN, font=mono(14))

    # Bottom tag
    rr(d, [0, H-36, W, H], 0, (10,10,22))
    tag = "AES-256-GCM  •  Zero Cloud  •  Open Source"
    tw2 = int(d.textlength(tag, font=sans(12)))
    d.text(((W-tw2)//2, H-26), tag, fill=DARK, font=sans(12))

    path = os.path.join(OUT, "promo-small-440x280.png")
    img.save(path, format="PNG")
    print(f"Saved: {path}")

# ── MARQUEE TILE 1400×560 ─────────────────────────────────────────────────────
def marquee_tile():
    W, H = 1400, 560
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Grid
    for x in range(0, W, 70):
        d.line([(x,0),(x,H)], fill=(20,20,40), width=1)
    for y in range(0, H, 56):
        d.line([(0,y),(W,y)], fill=(20,20,40), width=1)

    # ── Left: branding ───────────────────────────────────────────────────
    LW = 520
    d.ellipse([60, 80, 100, 120], fill=TEAL)
    d.ellipse([72, 92, 88, 108], fill=BG)

    d.text((114, 72), "EnigmAgent", fill=WHITE, font=sans(52))
    d.text((114, 134), "Local AI Secret Vault", fill=GRAY, font=sans(22))

    d.rectangle([60, 170, LW, 172], fill=TEAL_DIM)

    features = [
        "🔒  AES-256-GCM encryption",
        "🏠  100% local — zero cloud",
        "⚡  {{PLACEHOLDER}} resolution",
        "🔗  40+ AI framework integrations",
        "📖  Open source — MIT license",
    ]
    for i, f in enumerate(features):
        d.text((60, 190 + i*46), f, fill=WHITE if i%2==0 else GRAY, font=sans(19))

    d.rectangle([60, H-80, LW, H-78], fill=DARK)
    d.text((60, H-68), "enigmagent.com", fill=TEAL_DIM, font=sans(16))

    # ── Center: vertical divider ──────────────────────────────────────────
    d.rectangle([LW+30, 60, LW+31, H-60], fill=DARK)

    # ── Right: flow diagram ───────────────────────────────────────────────
    RX = LW + 70
    RW = W - RX - 40

    d.text((RX, 52), "How it works", fill=GRAY, font=sans(18))
    d.rectangle([RX, 76, W-40, 77], fill=DARK)

    # Step boxes
    steps = [
        (TEAL,  "1", "Store secrets in vault",    "add GITHUB_TOKEN @github.com ghp_..."),
        (GREEN, "2", "Reference as placeholder",  'api_key = "{{GITHUB_TOKEN}}"'),
        (TEAL,  "3", "EnigmAgent resolves it",    "vault → injects real value at runtime"),
        (GREEN, "4", "LLM never sees real value",  "✓ Secure  ✓ Auditable  ✓ Local"),
    ]
    for i, (col, num, title, sub) in enumerate(steps):
        y = 95 + i * 110
        rr(d, [RX, y, W-40, y+90], 10, PANEL, DARK, 1)
        # number circle
        d.ellipse([RX+14, y+22, RX+50, y+58], fill=col)
        nw = int(d.textlength(num, font=sans(22)))
        d.text((RX+14+(36-nw)//2, y+26), num, fill=BG, font=sans(22))
        d.text((RX+64, y+14), title, fill=WHITE, font=sans(18))
        rr(d, [RX+64, y+40, W-56, y+72], 6, (25,25,52))
        d.text((RX+76, y+47), sub, fill=col, font=mono(14))

    path = os.path.join(OUT, "promo-marquee-1400x560.png")
    img.save(path, format="PNG")
    print(f"Saved: {path}")

if __name__ == "__main__":
    small_tile()
    marquee_tile()
    print("Done.")
