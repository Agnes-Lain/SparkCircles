"""Builds docs/design/brand/ripple/preview.html from the Ripple SVGs (run build_ripple.py first)."""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.normpath(os.path.join(HERE, "..", "ripple"))

def load(name, w=None, h=None):
    s = open(os.path.join(R, name)).read().strip()
    s = re.sub(r"<title>.*?</title>", "", s)
    a = (f' width="{w}"' if w else "") + (f' height="{h}"' if h else "")
    return s.replace("<svg ", f"<svg{a} ", 1)

def icon(px, name="ripple-icon-1024.svg", gray=False):
    g = " gray" if gray else ""
    return f'<span class="ic{g}" style="width:{px}px;height:{px}px;border-radius:{px*0.2237:.1f}px">{load(name, px, px)}</span>'

def disc(name_bg, px):
    # symbol on a white or Ink circle (rows added by the PM, kept)
    sym = re.sub(r"<title>.*?</title>", "", open(os.path.join(R, "ripple-symbol.svg")).read().strip())
    inner = re.search(r"<svg[^>]*>(.*)</svg>", sym, re.S).group(1)
    fill, stroke = ("#FFFFFF", ' stroke="rgba(0,0,0,0.08)" stroke-width="0.6"') if name_bg == "white" else ("#1A1A1A", "")
    return (f'<svg width="{px}" height="{px}" viewBox="-12 -12 120 120" role="img" aria-label="Ripple symbol on {name_bg}">'
            f'<circle cx="48" cy="48" r="59.5" fill="{fill}"{stroke}/>{inner}</svg>')

PLACE = [("#4A4A4A", "M7,12h10M12,7v10"), ("#F8F7F4", "M6,6h12v12H6z"), ("#FFFFFF", "M12,5a7,7 0 1 0 0.01,0"),
         ("#4A4A4A", "M5,17l7-10 7,10z"), ("#F8F7F4", "M6,9h12M6,15h12"), ("#FFFFFF", "M8,6v12M16,6v12"),
         ("#4A4A4A", "M6,12h12"), ("#F8F7F4", "M7,7l10,10M17,7l-10,10")]

def placeholder(i, px=60):
    bg, d = PLACE[i % len(PLACE)]
    st = "#FFFFFF" if bg == "#4A4A4A" else "#6E6E6E"
    return (f'<span class="ic" style="width:{px}px;height:{px}px;border-radius:{px*0.2237:.1f}px;background:{bg}">'
            f'<svg viewBox="0 0 24 24" width="{px*0.45:.0f}" height="{px*0.45:.0f}" aria-hidden="true"><path d="{d}" fill="none" stroke="{st}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>')

def phone(wall, label):
    cells = []
    for i in range(12):
        if i == 5:
            cells.append(f'<div class="app">{icon(60)}<span>SparkCircles</span></div>')
        else:
            cells.append(f'<div class="app">{placeholder(i)}<span>App</span></div>')
    dock = "".join(placeholder(i + 2) for i in range(4))
    return (f'<figure><div class="phone" style="background:{wall}" aria-label="Home screen mock-up, {label}">'
            f'<div class="grid{" lightwall" if wall == "#F8F7F4" else ""}">{"".join(cells)}</div><div class="dock">{dock}</div></div><figcaption>{label}</figcaption></figure>')

def adaptive():
    bg, fg = load("ripple-icon-background.svg", 72, 72), load("ripple-icon-foreground.svg", 72, 72)
    m = lambda r, extra="": f'<span class="stackic{extra}" style="border-radius:{r}">{bg}{fg}</span>'
    return f'{m("50%")}{m("22%")}{m("30% 50% 50% 50%")}{m("0", " safe")}'

CSS = """
*{box-sizing:border-box}
body{margin:0;background:#F8F7F4;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:32px 16px 48px;display:flex;flex-direction:column;gap:32px}
h1{font-size:28px;line-height:1.2;font-weight:500;margin:0}
h2{font-size:20px;line-height:1.3;font-weight:500;margin:0 0 12px}
.body{font-size:14px;line-height:1.6;color:#4A4A4A;margin:8px 0 0;max-width:760px}
.label{font-size:11px;line-height:1.4;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#4A4A4A;margin:0 0 12px}
.panel{border:.5px solid rgba(0,0,0,.08);border-radius:16px;padding:32px;display:flex;align-items:flex-end;justify-content:center;gap:40px;flex-wrap:wrap}
.panel.light{background:#F8F7F4}.panel.white{background:#FFFFFF}.panel.dark{background:#1A1A1A;border-color:#1A1A1A}
.panel.dark figcaption{color:#FFFFFF}
.panel svg{max-width:100%;height:auto}
.big svg{width:100%;max-width:720px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:760px){.two{grid-template-columns:1fr}.panel{padding:16px}}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
figcaption{font-size:12px;line-height:1.5;color:#6E6E6E;text-align:center}
.ic{display:inline-flex;overflow:hidden;flex:none}
.ic svg{display:block;width:100%;height:100%}
.gray{filter:grayscale(1)}
.stackic{position:relative;width:48px;height:48px;overflow:hidden;display:inline-block;flex:none}
.panel .stackic svg{position:absolute;left:-12px;top:-12px;max-width:none;width:72px;height:72px}
.stackic.safe{outline:1px dashed #6E6E6E}
.stackic.safe::after{content:"";position:absolute;left:2px;top:2px;width:44px;height:44px;border:1px dashed #FFFFFF;border-radius:50%}
.phone{width:300px;border-radius:32px;padding:28px 14px 14px;display:flex;flex-direction:column;gap:20px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);row-gap:16px;justify-items:center}
.app{display:flex;flex-direction:column;align-items:center;gap:4px;width:66px}
.app span:last-child{font-size:11px;line-height:1.4;color:#FFFFFF;white-space:nowrap}
.lightwall .app span:last-child{color:#1A1A1A}
.dock{display:flex;justify-content:space-around;background:rgba(255,255,255,.2);border-radius:24px;padding:10px}
.signin{background:#F8F7F4;border:.5px solid rgba(0,0,0,.08);border-radius:24px;padding:24px 16px;display:flex;flex-direction:column;gap:8px;width:360px;max-width:100%}
.signin .top svg{height:36px;width:auto}
.signin h3{font-size:28px;line-height:1.2;font-weight:500;margin:24px 0 0}
.fake{border:1.5px solid #6E6E6E;border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.6;color:#6E6E6E;background:#FFFFFF;margin-top:8px}
.btn{border:0;border-radius:100px;background:#A5E07F;color:#1A1A1A;font:inherit;font-size:15px;font-weight:500;min-height:48px;margin-top:8px}
.verdict{background:#FFFFFF;border:.5px solid rgba(0,0,0,.08);border-radius:16px;padding:16px;font-size:14px;line-height:1.6;color:#4A4A4A}
.verdict strong{color:#1A1A1A;font-weight:500}
"""

def build():
    sizes = lambda name: "".join(f"<figure>{icon(px if px != 1024 else 256, name)}<figcaption>{px} px{' (shown at 256)' if px == 1024 else ''}</figcaption></figure>"
                                 for px in (1024, 180, 60, 40, 29))
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SparkCircles Ripple brand</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <p class="label">Brand · Ripple, chosen direction · for PM review · 2 October 2026</p>
    <h1>Ripple</h1>
    <p class="body">A spark falls into the water and its circles spread to nearby families. Four open rings in Base colours (from the outside in: green, sky, lavender, pink) around a lemon spark, with the "SparkCircles" wordmark drawn in the same monoline alphabet. Everything below is built from <code>_source/build_ripple.py</code>.</p>
  </header>

  <section>
    <h2>Logo</h2>
    <p class="label">Horizontal lockup · light (shell) and dark (Ink)</p>
    <div class="panel light big">{load("ripple-lockup-horizontal.svg")}</div>
    <div class="panel dark big" style="margin-top:16px">{load("ripple-lockup-horizontal-on-dark.svg")}</div>
    <p class="label" style="margin-top:24px">Stacked lockup · light and dark</p>
    <div class="two">
      <div class="panel light">{load("ripple-lockup-stacked.svg", 240)}</div>
      <div class="panel dark">{load("ripple-lockup-stacked-on-dark.svg", 240)}</div>
    </div>
    <p class="label" style="margin-top:24px">Wordmark alone · 48 px tall on white</p>
    <div class="panel white">{load("ripple-wordmark.svg", None, 48)}</div>
  </section>

  <section>
    <h2>Symbol</h2>
    <p class="label">On shell · 256, 64 and 32 px</p>
    <div class="panel light">{"".join(f'<figure>{load("ripple-symbol.svg", px, px)}<figcaption>{px} px</figcaption></figure>' for px in (256, 64, 32))}</div>
    <p class="label" style="margin-top:24px">On a white circle · 256, 64 and 32 px</p>
    <div class="panel light">{"".join(f'<figure>{disc("white", px)}<figcaption>{px} px</figcaption></figure>' for px in (256, 64, 32))}</div>
    <p class="label" style="margin-top:24px">On a dark circle (Ink) · 256, 64 and 32 px</p>
    <div class="panel light">{"".join(f'<figure>{disc("Ink", px)}<figcaption>{px} px</figcaption></figure>' for px in (256, 64, 32))}</div>
    <p class="label" style="margin-top:24px">One colour · Ink and white</p>
    <div class="two">
      <div class="panel white">{load("ripple-symbol-mono-ink.svg", 96, 96)}{load("ripple-symbol-mono-ink.svg", 32, 32)}</div>
      <div class="panel dark">{load("ripple-symbol-mono-white.svg", 96, 96)}{load("ripple-symbol-mono-white.svg", 32, 32)}</div>
    </div>
  </section>

  <section>
    <h2>App icon</h2>
    <p class="label">Main icon · pastel ripple on Ink · 1024, 180, 60, 40, 29</p>
    <div class="panel white">{sizes("ripple-icon-1024.svg")}</div>
    <p class="label" style="margin-top:24px">Option for small sizes · three rings, heavier strokes</p>
    <div class="panel white">{sizes("ripple-icon-small-1024.svg")}</div>
    <p class="label" style="margin-top:24px">Side by side at 40 and 29 px, colour and grayscale</p>
    <div class="panel light">
      <figure>{icon(40)}<figcaption>main 40</figcaption></figure><figure>{icon(29)}<figcaption>main 29</figcaption></figure>
      <figure>{icon(40, "ripple-icon-small-1024.svg")}<figcaption>small option 40</figcaption></figure><figure>{icon(29, "ripple-icon-small-1024.svg")}<figcaption>small option 29</figcaption></figure>
      <figure>{icon(40, gray=True)}<figcaption>main, grayscale</figcaption></figure><figure>{icon(40, "ripple-icon-small-1024.svg", True)}<figcaption>small, grayscale</figcaption></figure>
    </div>
    <div class="verdict" style="margin-top:16px"><strong>Legibility verdict.</strong> At 60 and 40 px the four rings and the spark read clearly on Ink. At 29 px the rings merge into a soft multicoloured disc; the silhouette and colours stay recognisable, but the openings and the spark are barely visible. The three-ring option keeps visible gaps and a visible spark at 29 px. Proposal: ship the main icon, and use the three-ring artwork only where the system renders it at 29–40 px (Settings, Spotlight, notifications) if the PM wants maximum crispness. Both are provided.</div>
    <p class="label" style="margin-top:24px">iOS tinted · Android adaptive (masks, 66% safe zone) · Android themed</p>
    <div class="panel light">
      <figure>{icon(60, "ripple-icon-tinted-1024.svg")}<figcaption>iOS tinted source</figcaption></figure>
      <figure><div style="display:flex;gap:8px">{adaptive()}</div><figcaption>Android adaptive</figcaption></figure>
      <figure><span class="ic" style="width:60px;height:60px;border-radius:50%;background:#E6F7DD">{load("ripple-icon-mono.svg", 60, 60)}</span><figcaption>Android themed (example tint)</figcaption></figure>
    </div>
    <p class="label" style="margin-top:24px">Home screen · neutral placeholder icons</p>
    <div class="panel white">{phone("#6E6E6E", "Mid-grey wallpaper")}{phone("#F8F7F4", "Light wallpaper")}</div>
  </section>

  <section>
    <h2>In the app</h2>
    <p class="label">Sign-in header · horizontal lockup at 36 px</p>
    <div class="panel white">
      <div class="signin">
        <div class="top">{load("ripple-lockup-horizontal.svg")}</div>
        <h3>Welcome back</h3>
        <p class="body">Log in to see today's turns and events.</p>
        <div class="fake">Email</div>
        <button class="btn">Log in</button>
      </div>
    </div>
  </section>
</div>
</body>
</html>
"""
    with open(os.path.join(R, "preview.html"), "w") as fh:
        fh.write(html)
    print("page ok")

if __name__ == "__main__":
    build()
