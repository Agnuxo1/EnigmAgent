"""Generate Chrome Web Store screenshots for EnigmAgent (1280x800)."""
from PIL import Image, ImageDraw, ImageFont
import os, sys

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 800

# ── Colours ──────────────────────────────────────────────────────────────────
BG       = (15, 15, 30)       # very dark navy
PANEL    = (22, 22, 45)       # slightly lighter panel
BORDER   = (40, 40, 80)       # subtle border
TEAL     = (0, 212, 170)      # accent
TEAL_DIM = (0, 140, 110)
GREEN    = (80, 200, 120)
WHITE    = (240, 240, 250)
GRAY     = (130, 130, 160)
DARK_TXT = (80, 80, 110)
RED      = (220, 80, 80)

def font(size, bold=False):
    """Try to load a monospace font, fall back to default."""
    candidates = [
        "C:/Windows/Fonts/consola.ttf",   # Consolas
        "C:/Windows/Fonts/cour.ttf",       # Courier New
        "C:/Windows/Fonts/lucon.ttf",      # Lucida Console
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def sans(size):
    candidates = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill,
                            outline=outline, width=width)

# ═══════════════════════════════════════════════════════════════════════════
# SCREENSHOT 1 — Vault Chat Interface
# ═══════════════════════════════════════════════════════════════════════════
def screenshot1():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # ── Top bar ──────────────────────────────────────────────────────────
    d.rectangle([0, 0, W, 52], fill=PANEL)
    d.rectangle([0, 52, W, 53], fill=BORDER)
    # Logo dot
    d.ellipse([20, 16, 36, 32], fill=TEAL)
    d.text((44, 14), "EnigmAgent", fill=WHITE, font=sans(20))
    d.text((44, 34), "Local AI Secret Vault", fill=GRAY, font=sans(12))
    # Status badge
    rounded_rect(d, [W-160, 14, W-20, 38], 10, (20, 60, 40))
    d.ellipse([W-148, 22, W-136, 34], fill=GREEN)
    d.text((W-130, 22), "Vault Unlocked", fill=GREEN, font=sans(13))

    # ── Left panel — chat ─────────────────────────────────────────────────
    PW = 680
    d.rectangle([0, 53, PW, H], fill=PANEL)
    d.rectangle([PW, 53, PW+1, H], fill=BORDER)

    d.text((24, 76), "Vault Chat", fill=WHITE, font=sans(16))
    d.text((24, 100), "Type commands to manage your secrets", fill=GRAY, font=sans(12))
    d.rectangle([24, 118, PW-24, 119], fill=BORDER)

    # Chat messages
    msgs = [
        (140,  True,  "add OPENAI_KEY @openai.com sk-proj-..."),
        (200,  False, "✓  Stored  OPENAI_KEY  bound to  openai.com"),
        (260,  True,  "add GITHUB_TOKEN @github.com ghp_abc123"),
        (320,  False, "✓  Stored  GITHUB_TOKEN  bound to  github.com"),
        (380,  True,  "add ANTHROPIC_KEY @anthropic.com sk-ant-..."),
        (440,  False, "✓  Stored  ANTHROPIC_KEY  bound to  anthropic.com"),
        (500,  True,  "list"),
        (560,  False, "3 secrets stored  •  vault encrypted with AES-256-GCM"),
    ]
    for y, is_user, text in msgs:
        if is_user:
            rounded_rect(d, [24, y, PW-24, y+36], 8, (30, 30, 60))
            d.text((36, y+9), "> " + text, fill=TEAL, font=font(13))
        else:
            d.text((36, y+9), text, fill=GREEN, font=font(13))

    # Input bar
    rounded_rect(d, [24, H-64, PW-24, H-20], 10, (25, 25, 50), BORDER, 1)
    d.text((40, H-50), "Type a command…", fill=DARK_TXT, font=font(14))
    rounded_rect(d, [PW-80, H-60, PW-28, H-24], 8, TEAL)
    d.text((PW-66, H-52), "Enter", fill=BG, font=sans(13))

    # ── Right panel — secret list ─────────────────────────────────────────
    RX = PW + 20
    d.text((RX, 76), "Stored Secrets", fill=WHITE, font=sans(16))
    d.text((RX, 100), "Names & domains only — values never shown", fill=GRAY, font=sans(12))
    d.rectangle([RX, 118, W-20, 119], fill=BORDER)

    secrets = [
        ("OPENAI_KEY",     "openai.com",     TEAL),
        ("GITHUB_TOKEN",   "github.com",     TEAL),
        ("ANTHROPIC_KEY",  "anthropic.com",  TEAL),
        ("PYPI_TOKEN",     "pypi.org",       TEAL),
        ("AWS_SECRET",     "aws.amazon.com", TEAL),
    ]
    for i, (name, domain, col) in enumerate(secrets):
        y = 134 + i * 64
        rounded_rect(d, [RX, y, W-20, y+52], 8, (22, 22, 48), BORDER, 1)
        # lock icon circle
        d.ellipse([RX+14, y+14, RX+36, y+36], fill=(20, 60, 40))
        d.text((RX+20, y+16), "🔒", fill=GREEN, font=sans(14))
        d.text((RX+48, y+8),  name,   fill=WHITE, font=font(14))
        d.text((RX+48, y+26), "@" + domain, fill=GRAY, font=font(12))
        # placeholder pill
        pl = "{{" + name + "}}"
        tw = d.textlength(pl, font=font(11))
        rounded_rect(d, [W-20-int(tw)-20, y+14, W-20, y+38], 8, (15, 40, 35))
        d.text((W-20-int(tw)-10, y+18), pl, fill=TEAL_DIM, font=font(11))

    # ── Bottom tagline ────────────────────────────────────────────────────
    d.rectangle([0, H-18, W, H], fill=(10, 10, 22))
    tag = "AES-256-GCM encryption  •  Argon2id key derivation  •  Zero cloud  •  Zero telemetry"
    d.text((W//2 - d.textlength(tag, font=sans(11))//2, H-15), tag, fill=DARK_TXT, font=sans(11))

    path = os.path.join(OUT, "screenshot-1-vault-chat.png")
    img.save(path)
    print(f"Saved: {path}")
    return path

# ═══════════════════════════════════════════════════════════════════════════
# SCREENSHOT 2 — Placeholder Resolution / AI Integration
# ═══════════════════════════════════════════════════════════════════════════
def screenshot2():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # ── Top bar ──────────────────────────────────────────────────────────
    d.rectangle([0, 0, W, 52], fill=PANEL)
    d.rectangle([0, 52, W, 53], fill=BORDER)
    d.ellipse([20, 16, 36, 32], fill=TEAL)
    d.text((44, 14), "EnigmAgent", fill=WHITE, font=sans(20))
    d.text((44, 34), "{{PLACEHOLDER}} Resolution", fill=GRAY, font=sans(12))

    # ── Title area ────────────────────────────────────────────────────────
    d.text((W//2 - 260, 72), "Your secrets stay local.", fill=WHITE, font=sans(28))
    d.text((W//2 - 310, 106), "AI agents use  {{PLACEHOLDERS}}  —  never the real values.", fill=GRAY, font=sans(15))
    d.rectangle([40, 134, W-40, 135], fill=BORDER)

    # ── Flow diagram ──────────────────────────────────────────────────────
    # Box 1: AI Agent code
    BX, BY, BW, BH = 60, 160, 320, 200
    rounded_rect(d, [BX, BY, BX+BW, BY+BH], 12, (22, 22, 48), BORDER, 1)
    d.text((BX+14, BY+12), "AI Agent / Prompt", fill=GRAY, font=sans(12))
    d.rectangle([BX+10, BY+30, BX+BW-10, BY+31], fill=BORDER)
    code_lines = [
        ("import ", WHITE, "openai", TEAL, "", WHITE),
    ]
    d.text((BX+14, BY+42), "# Your agent code", fill=DARK_TXT, font=font(12))
    d.text((BX+14, BY+62), "api_key = ", fill=WHITE, font=font(13))
    rounded_rect(d, [BX+104, BY+58, BX+260, BY+80], 4, (15, 40, 35))
    d.text((BX+110, BY+60), '"{{OPENAI_KEY}}"', fill=TEAL, font=font(13))
    d.text((BX+14, BY+90), "client = OpenAI(", fill=WHITE, font=font(13))
    d.text((BX+14, BY+108), "  api_key=api_key", fill=GRAY, font=font(13))
    d.text((BX+14, BY+126), ")", fill=WHITE, font=font(13))
    d.text((BX+14, BY+154), "# {{ANTHROPIC_KEY}}", fill=DARK_TXT, font=font(12))
    d.text((BX+14, BY+172), "# {{GITHUB_TOKEN}}", fill=DARK_TXT, font=font(12))

    # Arrow 1
    AX = BX + BW + 10
    for i in range(3):
        d.rectangle([AX + i*14, BY+95, AX+i*14+10, BY+105], fill=TEAL)
    d.polygon([AX+46, BY+88, AX+62, BY+100, AX+46, BY+112], fill=TEAL)
    d.text((AX+6, BY+112), "resolves", fill=TEAL, font=sans(11))

    # Box 2: EnigmAgent vault
    VX = AX + 72
    rounded_rect(d, [VX, BY, VX+200, BY+BH], 12, (15, 35, 30), TEAL_DIM, 1)
    d.text((VX+14, BY+12), "EnigmAgent Vault", fill=TEAL, font=sans(13))
    d.rectangle([VX+10, BY+30, VX+190, BY+31], fill=TEAL_DIM)
    vault_items = ["OPENAI_KEY", "ANTHROPIC_KEY", "GITHUB_TOKEN", "PYPI_TOKEN", "AWS_SECRET"]
    for i, item in enumerate(vault_items):
        y = BY + 46 + i * 30
        d.ellipse([VX+14, y+4, VX+24, y+14], fill=GREEN)
        d.text((VX+32, y), item, fill=WHITE, font=font(12))
        d.text((VX+32, y+14), "••••••••••••", fill=GRAY, font=font(10))

    # Arrow 2
    AX2 = VX + 200 + 10
    for i in range(3):
        d.rectangle([AX2 + i*14, BY+95, AX2+i*14+10, BY+105], fill=TEAL)
    d.polygon([AX2+46, BY+88, AX2+62, BY+100, AX2+46, BY+112], fill=TEAL)
    d.text((AX2+2, BY+112), "injects at", fill=TEAL, font=sans(11))
    d.text((AX2+4, BY+125), "runtime", fill=TEAL, font=sans(11))

    # Box 3: Runtime
    RX3 = AX2 + 72
    rounded_rect(d, [RX3, BY, RX3+240, BY+BH], 12, (22, 22, 48), BORDER, 1)
    d.text((RX3+14, BY+12), "Runtime Execution", fill=GRAY, font=sans(12))
    d.rectangle([RX3+10, BY+30, RX3+230, BY+31], fill=BORDER)
    d.text((RX3+14, BY+46), "api_key = ", fill=WHITE, font=font(13))
    d.text((RX3+104, BY+46), '"sk-proj-abc…"', fill=GREEN, font=font(13))
    d.text((RX3+14, BY+80), "✓ Key resolved", fill=GREEN, font=sans(12))
    d.text((RX3+14, BY+100), "✓ LLM never sees it", fill=GREEN, font=sans(12))
    d.text((RX3+14, BY+120), "✓ No logs, no cloud", fill=GREEN, font=sans(12))
    d.text((RX3+14, BY+155), "🔒 AES-256-GCM", fill=TEAL, font=sans(12))
    d.text((RX3+14, BY+175), "🔑 Argon2id KDF", fill=TEAL, font=sans(12))

    # ── Integration logos row ─────────────────────────────────────────────
    d.rectangle([40, 390, W-40, 391], fill=BORDER)
    d.text((W//2 - 160, 400), "Integrates with 40+ AI frameworks", fill=GRAY, font=sans(14))

    frameworks = ["LangChain", "CrewAI", "AutoGen", "LlamaIndex", "n8n", "OpenAI SDK", "Anthropic SDK"]
    fw_x = 60
    for fw in frameworks:
        tw = int(d.textlength(fw, font=sans(13)))
        rounded_rect(d, [fw_x, 428, fw_x+tw+20, 456], 8, (25, 25, 52), BORDER, 1)
        d.text((fw_x+10, 432), fw, fill=WHITE, font=sans(13))
        fw_x += tw + 34

    # ── Bottom features row ───────────────────────────────────────────────
    features = [
        ("🔒", "AES-256-GCM\nEncryption"),
        ("🏠", "100% Local\nZero Cloud"),
        ("⚡", "Instant\nResolution"),
        ("🔑", "Domain\nBinding"),
        ("📦", "Open\nSource"),
    ]
    d.rectangle([0, 490, W, 491], fill=BORDER)
    fw = W // len(features)
    for i, (icon, label) in enumerate(features):
        cx = i * fw + fw // 2
        rounded_rect(d, [i*fw+20, 500, (i+1)*fw-20, H-20], 12, (22, 22, 48))
        d.text((cx - 12, 524), icon, fill=TEAL, font=sans(28))
        lines = label.split("\n")
        d.text((cx - int(d.textlength(lines[0], font=sans(13)))//2, 562), lines[0], fill=WHITE, font=sans(13))
        d.text((cx - int(d.textlength(lines[1], font=sans(12)))//2, 580), lines[1], fill=GRAY, font=sans(12))

    path = os.path.join(OUT, "screenshot-2-integration.png")
    img.save(path)
    print(f"Saved: {path}")
    return path

if __name__ == "__main__":
    p1 = screenshot1()
    p2 = screenshot2()
    print("Done.")
