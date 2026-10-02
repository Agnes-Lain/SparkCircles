"""SparkCircles Ripple brand set (chosen direction).

Hand-built geometry only: open circular arcs with round caps, a four-point spark from
four cubic curves, and a custom monoline wordmark drawn as stroked paths (no font).
Run:  python3 docs/design/brand/_source/build_ripple.py
"""
import math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "ripple"))

# Design system tokens
INK, SURFACE, SHELL = "#1A1A1A", "#FFFFFF", "#F8F7F4"
GREEN_B, SKY_B, LAV_B, PINK_B, YEL_B = "#A5E07F", "#8FD3F7", "#C5B8F5", "#FFB6D3", "#FFD93D"

def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

# ------------------------------------------------------------------ symbol (96 x 96)
C = 48
# (radius, stroke, colour, [(gap centre deg, gap width deg)]); 0 deg = right, clockwise.
RINGS = [
    (14, 6.5, PINK_B,  [(270, 48)]),               # inner: opens at the top, where the drop falls
    (24, 6.0, LAV_B,   [(140, 34)]),
    (34, 5.5, SKY_B,   [(30, 26), (215, 44)]),
    (43, 4.5, GREEN_B, [(320, 22), (110, 36)]),    # outer: thinnest, the ripple losing energy
]
SPARK_R = 8.5
MAX_R = 43 + 4.5 / 2

# Small-size option: three rings, heavier strokes, larger spark.
RINGS_SMALL = [
    (16, 8.0, LAV_B,   [(270, 50)]),
    (29, 7.5, SKY_B,   [(140, 30), (20, 22)]),
    (41.5, 7.0, GREEN_B, [(320, 24), (205, 34)]),
]
SPARK_R_SMALL = 10
MAX_R_SMALL = 41.5 + 3.5

def pt(r, d):
    a = math.radians(d)
    return C + r * math.cos(a), C + r * math.sin(a)

def ring_d(r, gaps):
    gaps = sorted(((c - w / 2) % 360, w) for c, w in gaps)
    d = []
    for i, (s, w) in enumerate(gaps):
        a0, a1 = s + w, gaps[(i + 1) % len(gaps)][0]
        if a1 <= a0:
            a1 += 360
        x0, y0 = pt(r, a0)
        x1, y1 = pt(r, a1)
        d.append(f"M{f(x0)},{f(y0)} A{f(r)},{f(r)} 0 {1 if a1 - a0 > 180 else 0} 1 {f(x1)},{f(y1)}")
    return " ".join(d)

def spark_d(cx, cy, r):
    a, b = 0.14 * r, 0.28 * r
    return (f"M{f(cx)},{f(cy-r)} C{f(cx+a)},{f(cy-b)} {f(cx+b)},{f(cy-a)} {f(cx+r)},{f(cy)} "
            f"C{f(cx+b)},{f(cy+a)} {f(cx+a)},{f(cy+b)} {f(cx)},{f(cy+r)} "
            f"C{f(cx-a)},{f(cy+b)} {f(cx-b)},{f(cy+a)} {f(cx-r)},{f(cy)} "
            f"C{f(cx-b)},{f(cy-a)} {f(cx-a)},{f(cy-b)} {f(cx)},{f(cy-r)}Z")

def symbol(mono=None, small=False):
    rings, sr = (RINGS_SMALL, SPARK_R_SMALL) if small else (RINGS, SPARK_R)
    out = [f'<path d="{ring_d(r, g)}" fill="none" stroke="{mono or c}" stroke-width="{f(sw)}" stroke-linecap="round"/>'
           for r, sw, c, g in rings]
    out.append(f'<path d="{spark_d(C, C, sr)}" fill="{mono or YEL_B}"/>')
    return "".join(out)

# ------------------------------------------------------------------ wordmark "SparkCircles"
# Lowercase monoline alphabet of direction 3 (baseline 40, x-height 20, ascender/cap 8,
# descender 50, stroke 4.8). Capitals S and C use the same construction:
#  - C is the lowercase c circle scaled to cap height (r 16) with the same open-right aperture;
#  - S is the lowercase s curve scaled to cap height (x 1.3, y 1.6), so its spine and
#    terminals match the lowercase s.
SW = 4.8
S_LOWER = [(12, 22.8), (10.3, 20.7), (7.6, 19.8), (5.4, 20.1), (2.2, 20.5), (0.6, 22.6), (0.9, 25),
           (1.3, 28.3), (5, 28.9), (7.6, 29.7), (10.6, 30.6), (12.6, 32), (12.5, 35),
           (12.4, 38.4), (9.4, 40.2), (6.2, 40.1), (3.6, 40), (1.4, 38.8), (0, 36.8)]

def s_path(x, sx=1.0, sy=1.0):
    p = [(x + px * sx, 40 - (40 - py) * sy) for px, py in S_LOWER]
    d = f"M{f(p[0][0])},{f(p[0][1])}"
    for i in range(1, len(p), 3):
        d += " C" + " ".join(f"{f(a)},{f(b)}" for a, b in p[i:i + 3])
    return d

def ring(cx):
    return f"M{f(cx-10)},30 A10,10 0 1 1 {f(cx+10)},30 A10,10 0 1 1 {f(cx-10)},30"

def c_lower(cx):
    return f"M{f(cx+8.66)},25 A10,10 0 1 0 {f(cx+8.66)},35"

def c_cap(cx):
    # r 16 around (cx, 24); aperture +/-33 deg, optically matched to the lowercase c (+/-30 deg at r 10)
    dx, dy = 16 * math.cos(math.radians(33)), 16 * math.sin(math.radians(33))
    return f"M{f(cx+dx)},{f(24-dy)} A16,16 0 1 0 {f(cx+dx)},{f(24+dy)}"

def r_lower(x):
    return f"M{f(x)},40 V20 M{f(x)},30 A10,10 0 0 1 {f(x+10)},20"

# Glyph positions (hand-spaced; "kC" tightened because the open arms of k leave room
# for the round of C, and C's aperture opens space before i).
X = dict(S=2, p=25, a=61, r1=77, k=91, C=124, i=143.5, r2=149.5, c=173.5, l=188.5, e=204.5, s=219.5)

def wordmark_strokes():
    return " ".join([
        s_path(X["S"], 1.3, 1.6),                                  # S
        f"M{X['p']},20 V50 " + ring(X["p"] + 10),                  # p
        ring(X["a"]) + f" M{X['a']+10},20 V40",                    # a
        r_lower(X["r1"]),                                          # r
        f"M{X['k']},8 V40 M{X['k']+12},20 L{X['k']},32 M{X['k']+4.5},28 L{X['k']+12.5},40",  # k
        c_cap(X["C"]),                                             # C
        f"M{X['i']},20 V40",                                       # i
        r_lower(X["r2"]),                                          # r
        c_lower(X["c"]),                                           # c
        f"M{X['l']},8 V40",                                        # l
        f"M{X['e']-10},30 H{X['e']+10} A10,10 0 1 0 {f(X['e']+8.66)},35",  # e
        s_path(X["s"]),                                            # s
    ])

WM_VB = (0, 5, 236, 48)   # x, y, w, h  (5.6 ascender top ... 52.4 descender bottom)
WM_MID = 27               # optical middle used to align with the symbol centre

def wordmark(color):
    return (f'<path d="{wordmark_strokes()}" fill="none" stroke="{color}" stroke-width="{SW}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="{X["i"]}" cy="11.5" r="3" fill="{color}"/>')

# ------------------------------------------------------------------ assemblies
WM_SCALE_H = 0.86   # wordmark optically balanced against the ripple (cap height = 29% of the symbol)
WM_SCALE_V = 0.92

def lockup_h(color):
    gap, s = 20, WM_SCALE_H
    W = 96 + gap + WM_VB[2] * s
    body = (f'<g>{symbol()}</g><g transform="translate({96+gap} {f(48-WM_MID*s)}) scale({s})">'
            f'{wordmark(color)}</g>')
    return f"0 0 {f(W)} 96", body

def lockup_v(color):
    s = WM_SCALE_V
    W = WM_VB[2] * s
    top = 96 + 16
    H = top + WM_VB[3] * s
    body = (f'<g transform="translate({f((W-96)/2)} 0)">{symbol()}</g>'
            f'<g transform="translate(0 {f(top-WM_VB[1]*s)}) scale({s})">{wordmark(color)}</g>')
    return f"0 0 {f(W)} {f(H)}", body

def scaled(canvas, radius, mono=None, small=False):
    k = radius / (MAX_R_SMALL if small else MAX_R)
    o = canvas / 2 - 48 * k
    return f'<g transform="translate({f(o)} {f(o)}) scale({f(k)})">{symbol(mono, small)}</g>'

def write(name, vb, body, label):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{label}">'
                 f'<title>{label}</title>{body}</svg>\n')

def build():
    os.makedirs(OUT, exist_ok=True)
    T = "SparkCircles"
    write("ripple-symbol.svg", "0 0 96 96", symbol(), f"{T} Ripple symbol")
    write("ripple-symbol-on-dark.svg", "0 0 96 96",
          f'<circle cx="48" cy="48" r="48" fill="{INK}"/>' + scaled(96, 37), f"{T} Ripple symbol on an Ink disc")
    write("ripple-symbol-mono-ink.svg", "0 0 96 96", symbol(INK), f"{T} Ripple symbol, one colour Ink")
    write("ripple-symbol-mono-white.svg", "0 0 96 96", symbol(SURFACE), f"{T} Ripple symbol, one colour white")
    write("ripple-wordmark.svg", " ".join(f(v) for v in WM_VB), wordmark(INK), "SparkCircles")
    write("ripple-wordmark-white.svg", " ".join(f(v) for v in WM_VB), wordmark(SURFACE), "SparkCircles")
    for name, (vb, body) in {
        "ripple-logo.svg": lockup_h(INK),
        "ripple-lockup-horizontal.svg": lockup_h(INK),
        "ripple-lockup-horizontal-on-dark.svg": lockup_h(SURFACE),
        "ripple-lockup-stacked.svg": lockup_v(INK),
        "ripple-lockup-stacked-on-dark.svg": lockup_v(SURFACE),
    }.items():
        write(name, vb, body, "SparkCircles")
    sq = lambda bg: f'<rect width="1024" height="1024" fill="{bg}"/>'
    write("ripple-icon-1024.svg", "0 0 1024 1024", sq(INK) + scaled(1024, 380), f"{T} iOS app icon master 1024")
    write("ripple-icon-small-1024.svg", "0 0 1024 1024", sq(INK) + scaled(1024, 392, small=True),
          f"{T} simplified small-size app icon option, 1024")
    write("ripple-icon-tinted-1024.svg", "0 0 1024 1024", sq(INK) + scaled(1024, 380, SURFACE),
          f"{T} iOS tinted icon source, grayscale")
    write("ripple-icon-foreground.svg", "0 0 108 108", scaled(108, 31), f"{T} Android adaptive icon foreground, 108dp")
    write("ripple-icon-background.svg", "0 0 108 108", f'<rect width="108" height="108" fill="{INK}"/>',
          f"{T} Android adaptive icon background, 108dp")
    write("ripple-icon-mono.svg", "0 0 108 108", scaled(108, 31, INK), f"{T} Android themed icon, monochrome, 108dp")
    print("svgs ok")

if __name__ == "__main__":
    build()
