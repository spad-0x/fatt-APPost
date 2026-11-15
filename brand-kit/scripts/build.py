#!/usr/bin/env python3
"""Build genuine vector brand assets from the supplied reference and Sora."""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import potrace
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
C = dict(dark="#014630", white="#ffffff", mint="#9bf9a4", sage="#2f6b4f",
         ink="#111827", ground="#f4f5f7", secondary="#5f6672")
JOBS: list[dict] = []
METRICS: dict = {}


def write(path, data):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(data, encoding="utf-8")


def svg(w, h, content, title, bg=None, desc="", defs=""):
    background = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">'
            f'<title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc>'
            f'{defs}{background}{content}</svg>\n')


def bounds(d):
    p = BoundsPen(None)
    parse_path(d, p)
    return p.bounds


def trace_hand():
    # Segment the WHITE hand only. Wordmark is below y=820 in the reference.
    a = np.array(Image.open(ROOT / "sources/reference-logo.png").convert("RGB"))
    mask = (a[:, :, 0] > 128) & (a[:, :, 1] > 160) & (a[:, :, 2] > 128)
    mask[820:, :] = False
    traced = potrace.Bitmap(~mask).trace(turdsize=50, alphamax=1, opttolerance=.35)
    curves = list(traced)
    if len(curves) != 1:
        raise ValueError("Expected one connected hand silhouette")
    p = SVGPathPen(None)
    xy = lambda q: (q.x, q.y)
    segment_count = 0
    for curve in curves:
        p.moveTo(xy(curve.start_point))
        for seg in curve:
            segment_count += 1
            if seg.is_corner:
                p.lineTo(xy(seg.c))
                p.lineTo(xy(seg.end_point))
            else:
                p.curveTo(xy(seg.c1), xy(seg.c2), xy(seg.end_point))
        p.closePath()
    raw = p.getCommands()
    x0, y0, x1, y1 = bounds(raw)
    s = 1000 / (x1 - x0)
    normalized = SVGPathPen(None)
    parse_path(raw, TransformPen(normalized, (s, 0, 0, s, -x0*s, -y0*s)))
    d = normalized.getCommands()
    # Reduce serialization precision, without changing the fitted Bezier geometry.
    import re
    d = re.sub(r"-?\d+(?:\.\d+)?(?:e[-+]?\d+)?",
               lambda m: f"{float(m.group()):.5f}".rstrip("0").rstrip(".") if "." in m.group() or "e" in m.group() else m.group(), d)
    b = bounds(d)
    METRICS["hand"] = {"reference_bounds": [x0, y0, x1, y1],
                       "normalized_bounds": b, "bezier_segments": segment_count,
                       "source": "sources/reference-logo.png", "trace_tolerance": .35}
    return d, b[3] - b[1]


HAND, HAND_H = trace_hand()
FONT_DATA = (ROOT / "fonts/Sora-Variable.ttf").read_bytes()
FONT_CACHE = {}


def font(weight=600):
    if weight not in FONT_CACHE:
        t = instantiateVariableFont(TTFont(io.BytesIO(FONT_DATA)), {"wght": weight}, inplace=False)
        buf = io.BytesIO()
        t.save(buf)
        face = hb.Face(buf.getvalue())
        h = hb.Font(face)
        h.scale = (face.upem, face.upem)
        FONT_CACHE[weight] = (t, h)
    return FONT_CACHE[weight]


def shape(text, weight=600, colors=None):
    """HarfBuzz shaping including Sora kerning; return outlined SVG and INK bounds."""
    t, h = font(weight)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(h, buf, {"kern": True})
    gs = t.getGlyphSet()
    order = t.getGlyphOrder()
    paths = []
    pen_bounds = BoundsPen(gs)
    cursor = 0
    positions = {}
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        positions[info.cluster] = cursor + pos.x_offset
        glyph = gs[order[info.codepoint]]
        tr = (1, 0, 0, -1, cursor + pos.x_offset, -pos.y_offset)
        p = SVGPathPen(gs)
        glyph.draw(TransformPen(p, tr))
        glyph.draw(TransformPen(pen_bounds, tr))
        d = p.getCommands()
        if d:
            color = colors(info.cluster) if colors else C["ink"]
            paths.append(f'<path fill="{color}" d="{d}"/>')
        cursor += pos.x_advance
    return "".join(paths), pen_bounds.bounds, positions


def mark(x, y, width, color=C["white"]):
    return f'<g data-part="hand" transform="translate({x:.6f} {y:.6f}) scale({width/1000:.9f})"><path fill="{color}" d="{HAND}"/></g>'


def words(x, y, width, colors, editable=False):
    raw, b, positions = shape("fatt APPost", colors=lambda i: colors[1] if 5 <= i <= 7 else colors[0])
    x0, y0, x1, y1 = b
    scale = width / (x1-x0)
    if editable:
        raw = (f'<text font-family="Sora" font-size="1000" font-weight="600" font-kerning="normal" '
               f'xml:space="preserve"><tspan x="{positions[0]}" fill="{colors[0]}">fatt </tspan>'
               f'<tspan x="{positions[5]}" fill="{colors[1]}">APP</tspan>'
               f'<tspan x="{positions[8]}" fill="{colors[0]}">ost</tspan></text>')
    return (f'<g data-part="wordmark" transform="translate({x:.6f} {y:.6f}) scale({scale:.9f}) '
            f'translate({-x0:.6f} {-y0:.6f})">{raw}</g>'), (y1-y0)*scale


WORD_BOUNDS = shape("fatt APPost")[1]
WORD_RATIO = (WORD_BOUNDS[3]-WORD_BOUNDS[1]) / (WORD_BOUNDS[2]-WORD_BOUNDS[0])
METRICS["typography"] = {"text": "fatt APPost", "family": "Sora", "weight": 600,
                       "ink_bounds_at_1000": WORD_BOUNDS,
                       "kerning": "HarfBuzz, kern enabled", "highlight_clusters": [5,6,7]}


def layout(kind, colors, editable=False):
    if kind == "stacked":
        w, h, ww, mw, gap = 1200, 1200, 960, 650, 64
        mh, wh = mw*HAND_H/1000, ww*WORD_RATIO
        top = (h-mh-gap-wh)/2
        mb = [(w-mw)/2, top, (w+mw)/2, top+mh]
        wb = [(w-ww)/2, top+mh+gap, (w+ww)/2, top+mh+gap+wh]
    elif kind == "horizontal":
        w, h, ww, mw, gap = 1280, 320, 760, 280, 64
        mh, wh = mw*HAND_H/1000, ww*WORD_RATIO
        left = (w-mw-gap-ww)/2
        mb = [left, (h-mh)/2, left+mw, (h+mh)/2]
        wb = [left+mw+gap, (h-wh)/2, left+mw+gap+ww, (h+wh)/2]
    elif kind == "wordmark":
        w, h, ww = 1200, 280, 960
        wh = ww*WORD_RATIO
        mb = None
        wb = [(w-ww)/2, (h-wh)/2, (w+ww)/2, (h+wh)/2]
    else:
        raise ValueError(kind)
    content = mark(mb[0], mb[1], mw, colors[2]) if mb else ""
    content += words(wb[0], wb[1], ww, colors, editable)[0]
    METRICS[kind] = {"canvas": [w,h], "hand_bounds": mb, "wordmark_bounds": wb,
                     "content_bounds": [min(mb[0], wb[0]), min(mb[1],wb[1]), max(mb[2],wb[2]), max(mb[3],wb[3])] if mb else wb,
                     "gap": gap if mb else None}
    return w, h, content


VARIANTS = {
    "dark": ((C["white"], C["mint"], C["white"]), C["dark"]),
    "reverse": ((C["white"], C["mint"], C["white"]), None),
    "on-light": ((C["ink"], C["sage"], C["sage"]), None),
    "mono-white": ((C["white"],)*3, None),
    "mono-sage": ((C["sage"],)*3, None),
    "mono-ink": ((C["ink"],)*3, None),
}


def save_svg(path, w, h, content, bg=None, title="fatt APPost", desc="", defs=""):
    write(path, svg(w,h,content,title,bg,desc,defs))


def raster(source, output, width, height=None):
    JOBS.append(dict(source=source, output=output, width=width, height=height))


for kind in ("stacked", "horizontal", "wordmark"):
    for variant, (colors, bg) in VARIANTS.items():
        w,h,content = layout(kind, colors)
        path = f"assets/brand/svg/logo-{kind}-{variant}.svg"
        save_svg(path,w,h,content,bg,desc="Mano aperta senza stellina. Wordmark Sora SemiBold, APP in evidenza.")
        sizes = [1024,2048] if kind=="stacked" else [1600,3200]
        if variant.startswith("mono-"):
            sizes = [sizes[-1]]
        for size in sizes:
            raster(path,f"assets/brand/png/logo-{kind}-{variant}-{size}.png",size)

# Editable text masters: embedded full Sora WOFF2 and supplied TTF for desktop editors.
f = TTFont(io.BytesIO(FONT_DATA))
f.flavor="woff2"
f.save(ROOT/"fonts/Sora-Variable.woff2")
encoded = base64.b64encode((ROOT/"fonts/Sora-Variable.woff2").read_bytes()).decode()
font_def = ('<defs><style>@font-face{font-family:Sora;font-style:normal;font-weight:100 800;'
            f'src:url(data:font/woff2;base64,{encoded}) format("woff2")' + '}</style></defs>')
for kind in ("stacked", "horizontal", "wordmark"):
    w,h,content=layout(kind,VARIANTS["dark"][0],editable=True)
    save_svg(f"sources/logo-{kind}-editable.svg",w,h,content,C["dark"],
             desc="Testo modificabile Sora 600. Font incorporato; installare il TTF negli editor desktop.",defs=font_def)

for name in ("white","mint","sage","ink"):
    save_svg(f"assets/brand/marks/hand-{name}.svg",1000,round(HAND_H,6),
             mark(0,0,1000,C[name]),title="fatt APPost — mano aperta")
save_svg("assets/brand/marks/hand-currentcolor.svg",1000,round(HAND_H,6),
         mark(0,0,1000,"currentColor"),title="fatt APPost — simbolo monocromatico")

# Shared icon geometry. Maskable silhouette fits INSIDE the mandated 80% diameter circle.
for name,ratio in (("icon",.78),("icon-maskable",.70)):
    width=512*ratio
    content=mark((512-width)/2,(512-width*HAND_H/1000)/2,width)
    p=f"public/icons/{name}.svg"
    save_svg(p,512,512,content,C["dark"],title="fatt APPost — icona")
    for size in (192,512):
        raster(p,f"public/icons/{name}-{size}.png",size)
    if name=="icon":
        for size in (16,32,48,96):
            raster(p,f"public/favicon-{size}x{size}.png",size)
        raster(p,"public/apple-touch-icon.png",180)
        write("public/favicon.svg",svg(512,512,content,"fatt APPost",C["dark"]))

save_svg("public/safari-pinned-tab.svg",1000,1000,mark(100,(1000-800*HAND_H/1000)/2,800,"#000000"),
         title="fatt APPost — pinned tab")

for size in (512,1024):
    mw=1024*.70
    content=mark((1024-mw)/2,(1024-mw*HAND_H/1000)/2,mw)
    p="marketing/avatar/avatar.svg"
    save_svg(p,1024,1024,content,C["dark"],title="fatt APPost — avatar")
    raster(p,f"marketing/avatar/avatar-{size}.png",size)
defs='<defs><clipPath id="circle"><circle cx="512" cy="512" r="512"/></clipPath></defs>'
circle=f'<g clip-path="url(#circle)"><rect width="1024" height="1024" fill="{C["dark"]}"/>{content}</g>'
save_svg("marketing/avatar/avatar-round.svg",1024,1024,circle,defs=defs,title="fatt APPost — avatar circolare")
raster("marketing/avatar/avatar-round.svg","marketing/avatar/avatar-round-1024.png",1024)


def fitted_logo(kind,w,h,content_width):
    lw,lh,body=layout(kind,VARIANTS["dark"][0])
    b=METRICS[kind]["content_bounds"]
    s=content_width/(b[2]-b[0])
    tx=w/2-s*(b[0]+b[2])/2
    ty=h/2-s*(b[1]+b[3])/2
    return f'<g transform="translate({tx:.8f} {ty:.8f}) scale({s:.9f})">{body}</g>'


for path,w,h,kind,cw in [
    ("marketing/og/og-image",1200,630,"stacked",800),
    ("marketing/og/og-horizontal",1200,630,"horizontal",1000),
    ("marketing/social/post-square",1080,1080,"stacked",864),
    ("marketing/social/story",1080,1920,"stacked",864),
    ("marketing/social/banner",1584,396,"horizontal",1180),
    ("marketing/social/repository-social-preview",1280,640,"stacked",800),
]:
    body=fitted_logo(kind,w,h,cw)
    save_svg(path+".svg",w,h,body,C["dark"],title="fatt APPost",desc="Identità di marca: mano aperta e wordmark Sora.")
    raster(path+".svg",path+".png",w,h)


def label(text,x,y,size=20,color=None,weight=600):
    raw,b,_=shape(text,weight,lambda i:color or C["ink"])
    # Top-left ink anchored for consistent board labels.
    return f'<g transform="translate({x} {y}) scale({size/1000}) translate({-b[0]} {-b[1]})">{raw}</g>'


# Centering proof: raw vector paths with geometric axis and exact ink bounding boxes.
w,h,body=layout("stacked",VARIANTS["dark"][0])
guide=f'<path d="M600 0V1200M0 600H1200" fill="none" stroke="{C["mint"]}" stroke-width="1" opacity=".6" stroke-dasharray="8 8"/>'
for name in ("hand_bounds","wordmark_bounds","content_bounds"):
    b=METRICS["stacked"][name]
    guide+=f'<rect x="{b[0]}" y="{b[1]}" width="{b[2]-b[0]}" height="{b[3]-b[1]}" fill="none" stroke="{C["mint"]}" stroke-width="1"/>'
save_svg("docs/centering-proof.svg",w,h,body+guide,C["dark"],title="fatt APPost — verifica della centratura")
raster("docs/centering-proof.svg","docs/centering-proof.png",1200)

# Independent 1:1 silhouette export, used by verify.py to compare with the raster.
rb=METRICS["hand"]["reference_bounds"]
save_svg("docs/hand-trace-check.svg",1254,1254,mark(rb[0],rb[1],rb[2]-rb[0]),"#000000",
         title="Confronto della sagoma con il riferimento")
raster("docs/hand-trace-check.svg","docs/hand-trace-check.png",1254)

# A self-contained contact board; every letter is outlined, no font dependency.
board=label("fatt APPost / Brand asset kit",56,40,28,C["sage"])
board+=label("Sora 600 · Mano originale · Palette piatta",56,82,17,C["secondary"],400)
board+=f'<rect x="48" y="136" width="1504" height="650" rx="28" fill="{C["dark"]}"/>'
hero=fitted_logo("stacked",1504,650,850)
board+=f'<g transform="translate(48 136)">{hero}</g>'
board+=f'<rect x="48" y="818" width="940" height="370" rx="28" fill="{C["white"]}"/>'
board+=label("Versione per fondi chiari",80,850,19,C["secondary"],400)
lw,lh,light=layout("horizontal",VARIANTS["on-light"][0])
board+=f'<g transform="translate(70 928) scale(.7)">{light}</g>'
board+=f'<rect x="1020" y="818" width="532" height="370" rx="28" fill="{C["dark"]}"/>'
board+=label("Icona · Avatar · PWA",1052,850,19,C["white"],400)
board+=mark(1126,962,320)
for i,(name,key) in enumerate((("Verde scuro","dark"),("Bianco","white"),("Menta / APP","mint"),("Salvia / UI","sage"),("Inchiostro / UI","ink"))):
    x=48+i*306
    board+=f'<rect x="{x}" y="1220" width="280" height="84" rx="14" fill="{C[key]}"/>'
    board+=label(name,x,1322,18,C["ink"])
    board+=label(C[key].upper(),x,1354,16,C["secondary"],400)
board+=label("SVG modificabili / PNG / Icone / Social / Repository",48,1420,18,C["secondary"],400)
save_svg("preview/brand-kit-overview.svg",1600,1480,board,C["ground"],title="fatt APPost — panoramica del brand kit")
raster("preview/brand-kit-overview.svg","preview/brand-kit-overview.png",1600)

tokens={"brand":{k:C[k] for k in ("dark","white","mint")},
        "interface":{k:C[k] for k in ("sage","ink","ground")},
        "wordmark":{"family":"Sora","weight":600},"interface_font":"Poppins"}
write("assets/brand/tokens.json",json.dumps(tokens,indent=2)+"\n")
write("assets/brand/brand.css",'''/* Brand-only tokens. Interface tokens remain governed by DESIGN.md. */
:root {
  --brand-dark: #014630;
  --brand-white: #ffffff;
  --brand-mint: #9bf9a4;
  --brand-on-light: #2f6b4f;
  --brand-ink: #111827;
  --brand-wordmark-font: "Sora", sans-serif;
}
/* Inline SVG only: .brand-mark { color: var(--brand-on-light); } */
''')
manifest={"id":"./", "name":"fatt APPost","short_name":"fatt APPost", "lang":"it",
          "start_url":"./","scope":"./","display":"standalone",
          "background_color":C["ground"],"theme_color":C["ground"],
          "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
                   {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
                   {"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
write("public/site.webmanifest",json.dumps(manifest,indent=2)+"\n")
write("docs/geometry.json",json.dumps(METRICS,indent=2)+"\n")
write("scripts/render-jobs.json",json.dumps(JOBS,indent=2)+"\n")
for file in ("logo-horizontal-on-light.svg","logo-horizontal-reverse.svg",
             "logo-stacked-on-light.svg","logo-stacked-reverse.svg","logo-stacked-dark.svg"):
    write("public/brand/"+file,(ROOT/"assets/brand/svg"/file).read_text())
write("public/brand/hand-sage.svg",(ROOT/"assets/brand/marks/hand-sage.svg").read_text())
print(f"Vector assets built. {len(JOBS)} PNG render jobs ready.")
