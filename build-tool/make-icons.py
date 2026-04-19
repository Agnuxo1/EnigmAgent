"""
Generate EnigmAgent extension icons at 16, 48, 128 px.

The design: a rounded-square dark tile (matching the vault UI background)
with a bright green stylized padlock. Rendered at 1024 px and downscaled for
quality, so the 16 px icon is crisp even though hand-drawing at that size
would blur.

Run from D:\\PROJECTS\\EnigmAgent\\build-tool:
    python make-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# EnigmAgent palette.
BG = (23, 26, 33, 255)        # --bg-2
ACCENT = (123, 211, 137, 255) # --accent (green)
SHADOW = (10, 13, 18, 255)

MASTER = 1024  # render big, downscale small


def rounded_rect(draw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def render_master() -> Image.Image:
    img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Tile.
    pad = MASTER // 32
    r = MASTER // 7
    rounded_rect(d, (pad, pad, MASTER - pad, MASTER - pad), r, BG)

    # Subtle inner highlight (1 px top bevel).
    rounded_rect(
        d,
        (pad + 8, pad + 8, MASTER - pad - 8, MASTER - pad - 8),
        r - 6,
        (31, 35, 44, 255),
    )

    # Padlock geometry.
    cx, cy = MASTER // 2, MASTER // 2 + 60
    body_w, body_h = int(MASTER * 0.50), int(MASTER * 0.36)
    body_top = cy - body_h // 2
    body = (cx - body_w // 2, body_top, cx + body_w // 2, cy + body_h // 2)
    rounded_rect(d, body, MASTER // 22, ACCENT)

    # Shackle: draw with ImageDraw.arc + two straight segments using a thick stroke.
    # The shackle is a U: two vertical legs + a semicircle on top.
    stroke = int(body_w * 0.14)
    sh_w = int(body_w * 0.62)
    sh_top_y = body_top - int(body_h * 0.95)
    sh_bot_y = body_top + int(stroke * 0.6)   # ends sunk a touch into the body for a clean join
    sh_left_x = cx - sh_w // 2
    sh_right_x = cx + sh_w // 2
    arc_radius = sh_w // 2
    arc_cx = cx
    arc_cy = sh_top_y + arc_radius  # center of the top semicircle

    # Top semicircle (180°..360° = upper half).
    d.arc(
        (arc_cx - arc_radius, arc_cy - arc_radius,
         arc_cx + arc_radius, arc_cy + arc_radius),
        start=180, end=360,
        fill=ACCENT, width=stroke,
    )
    # Two vertical legs.
    d.line(
        [(sh_left_x, arc_cy), (sh_left_x, sh_bot_y)],
        fill=ACCENT, width=stroke,
    )
    d.line(
        [(sh_right_x, arc_cy), (sh_right_x, sh_bot_y)],
        fill=ACCENT, width=stroke,
    )
    # Round the bottom ends of the legs so they don't look chopped.
    half = stroke // 2
    d.ellipse(
        (sh_left_x - half, sh_bot_y - half, sh_left_x + half, sh_bot_y + half),
        fill=ACCENT,
    )
    d.ellipse(
        (sh_right_x - half, sh_bot_y - half, sh_right_x + half, sh_bot_y + half),
        fill=ACCENT,
    )

    # Keyhole on the body.
    kh_r = int(body_h * 0.13)
    d.ellipse(
        (cx - kh_r, cy - kh_r - int(body_h * 0.04),
         cx + kh_r, cy + kh_r - int(body_h * 0.04)),
        fill=SHADOW,
    )
    # Small tail below keyhole.
    d.rectangle(
        (cx - kh_r // 2, cy - int(body_h * 0.04),
         cx + kh_r // 2, cy + int(body_h * 0.22)),
        fill=SHADOW,
    )

    return img


def main():
    master = render_master()
    for size in (128, 48, 16):
        out = OUT / f"icon-{size}.png"
        scaled = master.resize((size, size), Image.LANCZOS)
        scaled.save(out, format="PNG", optimize=True)
        print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
