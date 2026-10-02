"""Generates the SparkCircles logo proposal SVGs from hand-built geometry.
Every shape below is constructed by hand (arcs, lines, cubic sparks); no font outlines.
"""
import math, os

OUT = "/Users/yizhuzong/code/Agnes-Lain/SparkCircles/docs/design/brand"

# Design system v1.3 tokens
INK, INK2, INK3 = "#1A1A1A", "#4A4A4A", "#6E6E6E"
SHELL, SURFACE = "#F8F7F4", "#FFFFFF"
LAV = dict(light="#EDE9FD", base="#C5B8F5", dark="#6B5BC4")
GRN = dict(light="#E6F7DD", base="#A5E07F", dark="#2F7A1F")
SKY = dict(light="#E3F3FD", base="#8FD3F7", dark="#1F6FA8")
PNK = dict(light="#FFEEF5", base="#FFB6D3", dark="#B03A78")
YEL = dict(light="#FFF6CC", base="#FFD93D", dark="#8F5E00")

def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s

def spark(cx, cy, r):
    """Four-point spark: concave star built from four cubic curves."""
    a, b = 0.1 * r, 0.2 * r
    return (f"M{f(cx)},{f(cy-r)} "
            f"C{f(cx+a)},{f(cy-b)} {f(cx+b)},{f(cy-a)} {f(cx+r)},{f(cy)} "
            f"C{f(cx+b)},{f(cy+a)} {f(cx+a)},{f(cy+b)} {f(cx)},{f(cy+r)} "
            f"C{f(cx-a)},{f(cy+b)} {f(cx-b)},{f(cy+a)} {f(cx-r)},{f(cy)} "
            f"C{f(cx-b)},{f(cy-a)} {f(cx-a)},{f(cy-b)} {f(cx)},{f(cy-r)}Z")

def circle_path(cx, cy, r):
    return (f"M{f(cx-r)},{f(cy)} A{f(r)},{f(r)} 0 1 1 {f(cx+r)},{f(cy)} "
            f"A{f(r)},{f(r)} 0 1 1 {f(cx-r)},{f(cy)}Z")

def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)

# ---------------------------------------------------------------- wordmarks
# Lowercase monoline: baseline 40, x-height 20, ascender 8, descender 50.
def lower_strokes():
    s = lambda x: (f"M{f(x+12)},22.8 C{f(x+10.3)},20.7 {f(x+7.6)},19.8 {f(x+5.4)},20.1 "
                   f"C{f(x+2.2)},20.5 {f(x+0.6)},22.6 {f(x+0.9)},25 "
                   f"C{f(x+1.3)},28.3 {f(x+5)},28.9 {f(x+7.6)},29.7 "
                   f"C{f(x+10.6)},30.6 {f(x+12.6)},32 {f(x+12.5)},35 "
                   f"C{f(x+12.4)},38.4 {f(x+9.4)},40.2 {f(x+6.2)},40.1 "
                   f"C{f(x+3.6)},40 {f(x+1.4)},38.8 {f(x)},36.8")
    ring = lambda cx: f"M{f(cx-10)},30 A10,10 0 1 1 {f(cx+10)},30 A10,10 0 1 1 {f(cx-10)},30"
    c = lambda cx: f"M{f(cx+8.66)},25 A10,10 0 1 0 {f(cx+8.66)},35"
    r = lambda x: f"M{f(x)},40 V20 M{f(x)},30 A10,10 0 0 1 {f(x+10)},20"
    return " ".join([
        s(2),                                   # s
        f"M21,20 V50 " + ring(31),              # p
        ring(57) + " M67,20 V40",               # a
        r(73),                                  # r
        "M87,8 V40 M99,20 L87,32 M91.5,28 L99.5,40",  # k
        c(115),                                 # c
        "M130,20 V40",                          # i (dot added separately)
        r(136),                                 # r
        c(160),                                 # c
        "M175,8 V40",                           # l
        "M181,30 H201 A10,10 0 1 0 199.66,35",  # e
        s(206),                                 # s
    ])

LOWER_VB = (0, 4, 222, 50)      # x, y, w, h
LOWER_MID = 30                  # optical middle (x-height centre)

def lower_wordmark(ink, sw, dot, dot_color):
    body = f'<path d="{lower_strokes()}" fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
    if dot == "spark":
        body += f'<path d="{spark(130, 11, 5.5)}" fill="{dot_color}"/>'
    else:
        body += f'<circle cx="130" cy="11.5" r="{f(sw*0.62)}" fill="{dot_color}"/>'
    return body

# Uppercase monoline, tracked: baseline 40, cap height 8.
def upper_strokes():
    S = lambda x: (f"M{f(x+18)},13.5 C{f(x+16)},9.5 {f(x+12.5)},8 {f(x+9.5)},8 "
                   f"C{f(x+4.5)},8 {f(x+1.5)},11 {f(x+1.5)},15.5 "
                   f"C{f(x+1.5)},20.5 {f(x+6)},22 {f(x+10)},23.2 "
                   f"C{f(x+15)},24.7 {f(x+19)},26.5 {f(x+19)},32 "
                   f"C{f(x+19)},37 {f(x+15)},40 {f(x+10)},40 "
                   f"C{f(x+6)},40 {f(x+2.5)},38.3 {f(x+0.5)},35")
    P = lambda x: f"M{f(x)},40 V8 H{f(x+8)} A8,8 0 0 1 {f(x+8)},24 H{f(x)}"
    A = lambda x: f"M{f(x)},40 L{f(x+11)},8 L{f(x+22)},40 M{f(x+4.6)},27 H{f(x+17.4)}"
    R = lambda x: P(x) + f" M{f(x+8)},24 L{f(x+16)},40"
    K = lambda x: f"M{f(x)},8 V40 M{f(x+16)},8 L{f(x)},26 M{f(x+5.5)},20 L{f(x+17)},40"
    C = lambda x: f"M{f(x+28.26)},13.72 A16,16 0 1 0 {f(x+28.26)},34.28"
    I = lambda x: f"M{f(x)},8 V40"
    L = lambda x: f"M{f(x)},8 V40 H{f(x+15)}"
    E = lambda x: f"M{f(x+15)},8 H{f(x)} V40 H{f(x+15)} M{f(x)},24 H{f(x+12)}"
    return " ".join([S(2), P(29), A(53), R(83), K(107), C(131), I(167), R(175),
                     C(199), L(235), E(258), S(281)])

UPPER_VB = (0, 5, 303, 38)
UPPER_MID = 24

def upper_wordmark(ink, sw):
    return f'<path d="{upper_strokes()}" fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'

# ---------------------------------------------------------------- symbols (96 x 96 box)
def mark_circle(c):
    """Direction 1: five family circles around a spark."""
    cols = c["dots"]
    out = []
    for i, deg in enumerate([-90, -18, 54, 126, 198]):
        x, y = polar(48, 48, 30, deg)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="9" fill="{cols[i]}"/>')
    out.append(f'<path d="{spark(48, 48, 14)}" fill="{c["spark"]}"/>')
    return "".join(out)

def mark_ring(c):
    """Direction 2: one monoline circle, a spark escaping through its opening."""
    x1, y1 = polar(48, 48, 30, -20)
    x2, y2 = polar(48, 48, 30, -70)
    sx, sy = polar(48, 48, 30, -45)
    return (f'<path d="M{f(x1)},{f(y1)} A30,30 0 1 1 {f(x2)},{f(y2)}" fill="none" stroke="{c["ring"]}" stroke-width="7" stroke-linecap="round"/>'
            f'<path d="{spark(sx, sy, 12)}" fill="{c["spark"]}"/>')

UNI_HEAD = (46, 58, 26)
def unicorn_parts():
    cx, cy, r = UNI_HEAD
    horn = "M53.43,33.27 L70,8 L64.57,37.73Z"
    m1a, m1b = polar(cx, cy, 33, 190), polar(cx, cy, 33, 262)
    m2a, m2b = polar(cx, cy, 41, 202), polar(cx, cy, 41, 248)
    mane1 = f"M{f(m1a[0])},{f(m1a[1])} A33,33 0 0 1 {f(m1b[0])},{f(m1b[1])}"
    mane2 = f"M{f(m2a[0])},{f(m2a[1])} A41,41 0 0 1 {f(m2b[0])},{f(m2b[1])}"
    return horn, mane1, mane2

def mark_unicorn(c, mono=False):
    """Direction 3: the Sober Unicorn, a round head whose horn is a spark of energy."""
    cx, cy, r = UNI_HEAD
    horn, mane1, mane2 = unicorn_parts()
    out = [f'<path d="{horn}" fill="{c["horn"]}" stroke="{c["horn"]}" stroke-width="3" stroke-linejoin="round"/>',
           f'<path d="{mane2}" fill="none" stroke="{c["mane2"]}" stroke-width="6" stroke-linecap="round"/>',
           f'<path d="{mane1}" fill="none" stroke="{c["mane1"]}" stroke-width="6" stroke-linecap="round"/>']
    if mono:  # eye knocked out so a single colour still reads
        out.append(f'<path d="{circle_path(cx, cy, r)} {circle_path(58, 55, 3.4)}" fill="{c["head"]}" fill-rule="evenodd"/>')
    else:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c["head"]}"/>')
        out.append(f'<circle cx="58" cy="55" r="3.4" fill="{c["eye"]}"/>')
    return "".join(out)

# ---------------------------------------------------------------- directions
DIRS = {
    "circle-of-five": dict(
        title="Circle of five",
        mark=mark_circle, max_r=39,
        light=dict(dots=[LAV["dark"], GRN["dark"], SKY["dark"], PNK["dark"], YEL["dark"]], spark=INK),
        dark=dict(dots=[LAV["base"], GRN["base"], SKY["base"], PNK["base"], YEL["base"]], spark=SURFACE),
        mono=lambda col: dict(dots=[col]*5, spark=col),
        icon_bg=INK, icon=dict(dots=[LAV["base"], GRN["base"], SKY["base"], PNK["base"], YEL["base"]], spark=SURFACE),
        wordmark=("lower", 4.2, "spark", LAV["dark"], LAV["base"]),
    ),
    "spark-ring": dict(
        title="Spark ring",
        mark=mark_ring, max_r=42,
        light=dict(ring=INK, spark=GRN["dark"]),
        dark=dict(ring=SURFACE, spark=GRN["base"]),
        mono=lambda col: dict(ring=col, spark=col),
        icon_bg=GRN["base"], icon=dict(ring=INK, spark=INK),
        wordmark=("upper", 3.6, None, None, None),
    ),
    "sober-unicorn": dict(
        title="Sober unicorn",
        mark=mark_unicorn, max_r=46,
        light=dict(head=LAV["dark"], eye=SURFACE, horn=YEL["base"], mane1=PNK["dark"], mane2=SKY["dark"]),
        dark=dict(head=SURFACE, eye=INK, horn=YEL["base"], mane1=PNK["base"], mane2=SKY["base"]),
        mono=lambda col: dict(head=col, eye=None, horn=col, mane1=col, mane2=col),
        icon_bg=LAV["dark"], icon=dict(head=SURFACE, eye=INK, horn=YEL["base"], mane1=PNK["base"], mane2=SKY["base"]),
        wordmark=("lower", 4.8, "dot", INK, SURFACE),
    ),
}

def mark_svg(d, colors, mono=False):
    if d["mark"] is mark_unicorn:
        return mark_unicorn(colors, mono)
    return d["mark"](colors)

def wordmark_body(d, theme):
    kind, sw, dot, dl, dd = d["wordmark"]
    ink = INK if theme == "light" else SURFACE
    if kind == "upper":
        return upper_wordmark(ink, sw), UPPER_VB, UPPER_MID
    dot_color = dl if theme == "light" else dd
    return lower_wordmark(ink, sw, dot, dot_color), LOWER_VB, LOWER_MID

def svg(vb, body, title, w=None, h=None):
    size = f' width="{f(w)}" height="{f(h)}"' if w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(f(v) for v in vb)}"{size} role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

def lockup_h(d, theme):
    wm, vb, mid = wordmark_body(d, theme)
    s = 1.1 if vb is LOWER_VB else 1.15
    colors = d[theme]
    W = 120 + vb[2] * s + 2
    body = (f'<g>{mark_svg(d, colors)}</g>'
            f'<g transform="translate(120 {f(48 - mid*s)}) scale({s})">{wm}</g>')
    return (0, 0, W, 96), body

def lockup_v(d, theme):
    wm, vb, mid = wordmark_body(d, theme)
    s = 1.1 if vb is LOWER_VB else 1.15
    colors = d[theme]
    W = vb[2] * s
    H = 116 + vb[3] * s
    body = (f'<g transform="translate({f((W-96)/2)} 0)">{mark_svg(d, colors)}</g>'
            f'<g transform="translate(0 {f(116 - vb[1]*s)}) scale({s})">{wm}</g>')
    return (0, 0, W, H), body

def scaled_mark(d, colors, canvas, radius, mono=False):
    k = radius / d["max_r"]
    o = canvas / 2 - 48 * k
    return f'<g transform="translate({f(o)} {f(o)}) scale({f(k)})">{mark_svg(d, colors, mono)}</g>'

def icon_1024(d):
    return (0, 0, 1024, 1024), f'<rect width="1024" height="1024" fill="{d["icon_bg"]}"/>' + scaled_mark(d, d["icon"], 1024, 372)

def icon_tinted(d):
    return (0, 0, 1024, 1024), f'<rect width="1024" height="1024" fill="{INK}"/>' + scaled_mark(d, d["mono"](SURFACE), 1024, 372, mono=True)

def icon_foreground(d):
    # Android adaptive icon: 108 x 108 dp canvas, content inside the 66 dp safe circle (radius 33).
    return (0, 0, 108, 108), scaled_mark(d, d["icon"], 108, 31)

def icon_background(d):
    return (0, 0, 108, 108), f'<rect width="108" height="108" fill="{d["icon_bg"]}"/>'

def icon_mono(d):
    # Android themed icon / monochrome layer: single colour, alpha is what matters.
    return (0, 0, 108, 108), scaled_mark(d, d["mono"](INK), 108, 31, mono=True)

def build():
    for slug, d in DIRS.items():
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        T = f"SparkCircles, {d['title']}"
        files = {
            "symbol.svg": ((0, 0, 96, 96), mark_svg(d, d["light"]), f"{T} symbol"),
            "symbol-reverse.svg": ((0, 0, 96, 96), mark_svg(d, d["dark"]), f"{T} symbol, for dark backgrounds"),
            "symbol-mono.svg": ((0, 0, 96, 96), mark_svg(d, d["mono"](INK), mono=True), f"{T} symbol, one colour"),
        }
        wm, vb, _ = wordmark_body(d, "light")
        files["wordmark.svg"] = (vb, wm, "SparkCircles wordmark")
        wm_r, vb_r, _ = wordmark_body(d, "dark")
        files["wordmark-reverse.svg"] = (vb_r, wm_r, "SparkCircles wordmark, for dark backgrounds")
        for theme, suffix in (("light", ""), ("dark", "-reverse")):
            vb_h, b_h = lockup_h(d, theme)
            files[f"lockup-horizontal{suffix}.svg"] = (vb_h, b_h, T)
            vb_v, b_v = lockup_v(d, theme)
            files[f"lockup-stacked{suffix}.svg"] = (vb_v, b_v, T)
        for name, fn, label in (("icon-1024.svg", icon_1024, "iOS app icon master 1024"),
                                ("icon-tinted-1024.svg", icon_tinted, "iOS tinted icon source, grayscale"),
                                ("icon-foreground.svg", icon_foreground, "Android adaptive icon foreground, 108dp"),
                                ("icon-background.svg", icon_background, "Android adaptive icon background, 108dp"),
                                ("icon-mono.svg", icon_mono, "Android themed icon, monochrome layer, 108dp")):
            v, b = fn(d)
            files[name] = (v, b, f"{T}, {label}")
        for name, (v, b, t) in files.items():
            with open(os.path.join(folder, name), "w") as fh:
                fh.write(svg(v, b, t))
    print("ok")

if __name__ == "__main__":
    build()
