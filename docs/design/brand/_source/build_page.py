import os, re
B = "/Users/yizhuzong/code/Agnes-Lain/SparkCircles/docs/design/brand"

DIRS = [
    ("circle-of-five", "1 · Circle of five",
     "Five family circles, one per module colour, gathered around a spark.",
     ["Tells the whole product story: circles of families + the five modules + joy.",
      "Very recognisable on a dark icon; the five colours make it joyful without being childish.",
      "Strong secondary pattern: the dots can become loaders, avatars rows, illustrations."],
     ["Five small dots get busy at 29 px; the spark becomes a speck.",
      "On light backgrounds the Dark variants (brown yellow, plum) look muddier than the pastels.",
      "Rainbow dots are a common 'community app' trope; distinctiveness depends on the spark."]),
    ("spark-ring", "2 · Spark ring",
     "One circle drawn with a single line, opened by a spark escaping from it.",
     ["Most sober and trustworthy; consistent with the line-icon style (stroke ratio of 1.8 at 24 px).",
      "Scales best: crisp at 29 px, simple to animate (the spark can draw the ring on success).",
      "Green background ties the icon to the primary button colour; perfect in mono and tinted modes."],
     ["Least joyful of the three; relies on colour and copy for warmth.",
      "Circle + star marks are frequent; the opening angle and spark shape must stay exact to stay ownable.",
      "Spark is close to the Events tab 'sparkles' icon (see notes)."]),
    ("sober-unicorn", "3 · Sober unicorn",
     "The brand's own 'Sober Unicorn': a round head whose horn is the spark, with a two-colour mane.",
     ["Most memorable and characterful; links to the unicorn emoji already used in empty states.",
      "Gives children a friendly character while parents see a calm geometric shape.",
      "Works as a mascot for onboarding, loaders and celebrations."],
     ["Highest risk of feeling childish next to verification and safety topics.",
      "Unicorns are widely used by other brands; the mark is harder to protect and to keep distinct.",
      "In one colour the mane reads like 'speed lines' or a signal icon."]),
]

def load(slug, name, h=None, w=None, cls=""):
    s = open(os.path.join(B, slug, name)).read().strip()
    s = re.sub(r"<title>.*?</title>", "", s)
    attrs = ""
    if h: attrs += f' height="{h}"'
    if w: attrs += f' width="{w}"'
    if cls: attrs += f' class="{cls}"'
    return s.replace("<svg ", f"<svg{attrs} ", 1)

def icon(slug, px, extra=""):
    return f'<span class="ic {extra}" style="width:{px}px;height:{px}px;border-radius:{px*0.2237:.1f}px">{load(slug, "icon-1024.svg", px, px)}</span>'

PLACE = [("#4A4A4A", "M7,12h10M12,7v10"), ("#F8F7F4", "M6,6h12v12H6z"), ("#1A1A1A", "M12,5a7,7 0 1 0 0.01,0"),
         ("#FFFFFF", "M5,17l7-10 7,10z"), ("#4A4A4A", "M6,9h12M6,15h12"), ("#F8F7F4", "M8,6v12M16,6v12"),
         ("#1A1A1A", "M6,12h12"), ("#FFFFFF", "M7,7l10,10M17,7l-10,10")]

def placeholder(i, px=60):
    bg, d = PLACE[i % len(PLACE)]
    stroke = "#FFFFFF" if bg in ("#1A1A1A", "#4A4A4A") else "#6E6E6E"
    return (f'<span class="ic" style="width:{px}px;height:{px}px;border-radius:{px*0.2237:.1f}px;background:{bg}">'
            f'<svg viewBox="0 0 24 24" width="{px*0.45:.0f}" height="{px*0.45:.0f}" aria-hidden="true"><path d="{d}" fill="none" stroke="{stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>')

def home(slug):
    cells = []
    for i in range(16):
        if i == 5:
            cells.append(f'<div class="app">{icon(slug, 60)}<span>SparkCircles</span></div>')
        else:
            cells.append(f'<div class="app">{placeholder(i)}<span>App</span></div>')
    dock = "".join(placeholder(i + 3) for i in range(4))
    return f'<div class="phone" aria-label="Home screen mock-up"><div class="grid">{"".join(cells)}</div><div class="dock">{dock}</div></div>'

def adaptive(slug):
    bg = load(slug, "icon-background.svg", 72, 72)
    fg = load(slug, "icon-foreground.svg", 72, 72)
    def mask(r):
        return f'<span class="stackic" style="border-radius:{r}">{bg}{fg}</span>'
    return f'<div class="row">{mask("50%")}{mask("22%")}{mask("30% 50% 50% 50%")}<span class="stackic safe">{bg}{fg}</span></div>'

def signin(slug, lower):
    return f'''<div class="signin">
      <div class="signin-top">{load(slug, "lockup-horizontal.svg", 32)}</div>
      <h4>Welcome back</h4>
      <p class="body">Log in to see today's turns and events.</p>
      <div class="fake-input">Email</div>
      <button class="primary">Log in</button>
    </div>'''

def column(slug, title, idea, pros, cons):
    return f'''
<article class="dir" aria-labelledby="{slug}-t">
  <header><h2 id="{slug}-t">{title}</h2><p class="body">{idea}</p></header>

  <p class="label">Lockup · light and dark</p>
  <div class="tile light">{load(slug, "lockup-horizontal.svg", 56)}</div>
  <div class="tile dark">{load(slug, "lockup-horizontal-reverse.svg", 56)}</div>
  <div class="pair">
    <div class="tile light">{load(slug, "lockup-stacked.svg", 120)}</div>
    <div class="tile dark">{load(slug, "lockup-stacked-reverse.svg", 120)}</div>
  </div>
  <div class="pair">
    <div class="tile light">{load(slug, "symbol.svg", 72)}{load(slug, "symbol-mono.svg", 72)}</div>
    <div class="tile dark">{load(slug, "symbol-reverse.svg", 72)}</div>
  </div>

  <p class="label">App icon · 1024 master (shown at 200), 180, 60, 40, 29</p>
  <div class="tile light sizes">{icon(slug, 200)}</div>
  <div class="tile light sizes">{icon(slug, 180)}{icon(slug, 60)}{icon(slug, 40)}{icon(slug, 29)}</div>
  <div class="tile dark sizes">{icon(slug, 60)}{icon(slug, 40)}{icon(slug, 29)}</div>
  <p class="label">Grayscale check</p>
  <div class="tile light sizes gray">{icon(slug, 60)}{icon(slug, 40)}{icon(slug, 29)}</div>

  <p class="label">iOS tinted · Android adaptive (masks + 66% safe zone) · Android themed</p>
  <div class="tile light sizes">
    <span class="ic" style="width:60px;height:60px;border-radius:13.4px">{load(slug, "icon-tinted-1024.svg", 60, 60, "tint")}</span>
    {adaptive(slug)}
    <span class="ic themed" style="width:60px;height:60px;border-radius:50%">{load(slug, "icon-mono.svg", 60, 60)}</span>
  </div>

  <p class="label">Home screen</p>
  {home(slug)}

  <p class="label">In the app · sign-in header</p>
  {signin(slug, True)}

  <div class="procon">
    <div><p class="h3">Strong</p><ul>{"".join(f"<li>{p}</li>" for p in pros)}</ul></div>
    <div><p class="h3">Weak</p><ul>{"".join(f"<li>{c}</li>" for c in cons)}</ul></div>
  </div>
</article>'''

CSS = """
:root{--shell:#F8F7F4;--surface:#FFFFFF;--border:rgba(0,0,0,.08);--ink:#1A1A1A;--ink2:#4A4A4A;--ink3:#6E6E6E;--green:#A5E07F;--green-dark:#2F7A1F}
*{box-sizing:border-box}
body{margin:0;background:var(--shell);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1320px;margin:0 auto;padding:32px 16px 48px}
h1{font-size:28px;line-height:1.2;font-weight:500;margin:0}
h2{font-size:20px;line-height:1.3;font-weight:500;margin:0}
h4{font-size:20px;line-height:1.3;font-weight:500;margin:0}
.h3{font-size:16px;line-height:1.4;font-weight:500;margin:0 0 4px}
.body{font-size:14px;line-height:1.6;color:var(--ink2);margin:4px 0 0}
.label{font-size:11px;line-height:1.4;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin:16px 0 8px}
.intro{display:flex;flex-direction:column;gap:8px;margin-bottom:24px;max-width:760px}
.cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:start}
@media (max-width:1100px){.cols{grid-template-columns:1fr}}
.dir{background:var(--surface);border:.5px solid var(--border);border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.04);padding:16px;min-width:0}
.tile{border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;overflow:hidden}
.tile svg{max-width:100%;height:auto}
.tile.light{background:var(--shell);border:.5px solid var(--border)}
.tile.dark{background:var(--ink)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sizes{justify-content:flex-start;flex-wrap:wrap;align-items:flex-end}
.ic{display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.ic svg{display:block;width:100%;height:100%}
.gray{filter:grayscale(1)}
.themed{background:#E6F7DD}
.row{display:flex;gap:8px;align-items:center}
.stackic{position:relative;width:48px;height:48px;overflow:hidden;display:inline-block;flex:none}
.tile .stackic svg{position:absolute;left:-12px;top:-12px;max-width:none;width:72px;height:72px}
.stackic.safe{border-radius:0;outline:1px dashed var(--ink3)}
.stackic.safe::after{content:"";position:absolute;left:2px;top:2px;width:44px;height:44px;border:1px dashed var(--surface);border-radius:50%}
.phone{width:100%;max-width:340px;margin:0 auto;background:#6E6E6E;border-radius:32px;padding:28px 18px 14px;display:flex;flex-direction:column;gap:20px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);row-gap:16px;justify-items:center}
.app{display:flex;flex-direction:column;align-items:center;gap:4px;width:68px}
.app span:last-child{font-size:11px;line-height:1.4;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68px}
.dock{display:flex;justify-content:space-around;background:rgba(255,255,255,.2);border-radius:24px;padding:10px}
.signin{background:var(--shell);border:.5px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;max-width:390px;margin:0 auto}
.signin-top{margin-bottom:16px}
.signin-top svg{height:32px;width:auto}
.fake-input{border:1.5px solid var(--ink3);border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.6;color:var(--ink3);background:var(--surface);margin-top:8px}
.primary{border:0;border-radius:100px;background:var(--green);color:var(--ink);font:inherit;font-size:15px;font-weight:500;min-height:48px;margin-top:8px}
.procon{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.procon ul{margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:var(--ink2)}
.compare{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end;background:var(--surface);border:.5px solid var(--border);border-radius:16px;padding:16px;margin-bottom:24px}
.compare figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.compare figcaption{font-size:12px;line-height:1.5;color:var(--ink3)}
.reco{background:#E6F7DD;border-radius:16px;padding:12px 16px;color:var(--ink);font-size:14px;line-height:1.6;margin-bottom:24px}
.reco strong{font-weight:500;color:var(--green-dark)}
"""

def build():
    cols = "".join(column(*d) for d in DIRS)
    compare = "".join(
        f'<figure>{icon(s, 60)}<figcaption>{t.split(" · ")[1]}</figcaption></figure>'
        f'<figure class="gray">{icon(s, 60)}<figcaption>grayscale</figcaption></figure>'
        for s, t, *_ in DIRS)
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SparkCircles logo proposals</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="intro">
    <p class="label" style="margin:0">Brand · proposal for PM review · 2 October 2026</p>
    <h1>SparkCircles logo and app icon</h1>
    <p class="body">Three directions built only from design system v1.3 colours and hand-drawn geometry (no fonts). Each shows the lockups on light and dark, the app icon from 1024 to 29&nbsp;px, the iOS tinted and Android adaptive/themed variants, a home-screen mock-up with neutral placeholder icons, and the wordmark inside the app. Rationale and notes: <code>logo-proposals.md</code>.</p>
  </div>
  <div class="reco"><strong>Recommendation: 2 · Spark ring</strong>, for the icon and the main logo. It is the calmest and most trustworthy, the most legible at 29&nbsp;px, and it matches the line icons. Borrow the five-colour dots from direction 1 as a secondary pattern (loaders, illustrations) to bring the joy.</div>
  <p class="label">Side by side at home-screen size</p>
  <div class="compare">{compare}</div>
  <div class="cols">{cols}</div>
</div>
</body>
</html>
"""
    with open(os.path.join(B, "logo-proposals.html"), "w") as fh:
        fh.write(html)
    print("ok")

build()
