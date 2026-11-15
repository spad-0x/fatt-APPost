#!/usr/bin/env python3
"""Verify the actual exported geometry, alpha channels and maskable icon pixels."""
from __future__ import annotations
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform, Identity
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parents[1]
CHECKS=[]


def check(condition, name, **extra):
    CHECKS.append(dict(check=name,passed=bool(condition),**extra))
    if not condition:
        raise AssertionError(name+": "+repr(extra))


def svg_transform(value):
    t=Identity
    for name,args in re.findall(r"([A-Za-z]+)\(([^)]*)\)",value):
        a=[float(n) for n in re.split(r"[ ,]+",args.strip()) if n]
        if name=="translate":
            t=t.translate(a[0],a[1] if len(a)>1 else 0)
        elif name=="scale":
            t=t.scale(a[0],a[1] if len(a)>1 else a[0])
        elif name=="matrix":
            t=t.transform(Transform(*a))
        else:
            raise ValueError(name)
    return t


def part_bounds(root,part):
    pen=BoundsPen(None)
    def walk(node,parent=Identity,active=False):
        tr=parent.transform(svg_transform(node.get("transform","")))
        active=active or node.get("data-part")==part
        if active and node.tag.rsplit("}",1)[-1]=="path":
            parse_path(node.get("d",""),TransformPen(pen,tr))
        for child in node:
            walk(child,tr,active)
    walk(root)
    return list(pen.bounds) if pen.bounds else None


jobs=json.loads((ROOT/"scripts/render-jobs.json").read_text())
png_count=0
for job in jobs:
    im=Image.open(ROOT/job["output"]).convert("RGBA")
    source=ET.parse(ROOT/job["source"]).getroot()
    sw,sh=float(source.get("width")),float(source.get("height"))
    expected_h=job["height"] or round(job["width"]*sh/sw)
    check(im.size==(job["width"],expected_h),f"PNG size: {job['output']}",size=list(im.size))
    a=np.array(im)
    bg=next((n for n in source if n.tag.endswith("}rect")),None)
    transparent=bg is None
    low,high=im.getchannel("A").getextrema()
    check((low==0 and high==255) if transparent else (low==high==255),
          f"PNG alpha: {job['output']}",alpha_min=low,alpha_max=high)
    if not transparent:
        color=bg.get("fill")
        if color and color.startswith("#"):
            rgb=tuple(int(color[i:i+2],16) for i in (1,3,5))
            # Edge resampling can round a premultiplied channel by one 8-bit step.
            check(max(abs(int(a[0,0,i])-rgb[i]) for i in range(3))<=1,
                  f"PNG background: {job['output']}",color=color)
    png_count+=1

# Required raster formats outside the generic render jobs.
icon=Image.open(ROOT/"public/icons/icon-512.png").convert("RGBA")
icon.save(ROOT/"public/favicon.ico",format="ICO",sizes=[(16,16),(32,32),(48,48)])
ico=Image.open(ROOT/"public/favicon.ico")
check(ico.ico.sizes()=={(16,16),(32,32),(48,48)},"ICO includes 16, 32 and 48 pixels")
shutil.copyfile(ROOT/"marketing/og/og-image.png",ROOT/"public/og-image.png")

# XML and genuinely vector-only production assets.
svg_count=0
for path in sorted(ROOT.rglob("*.svg")):
    root=ET.parse(path).getroot()
    ids=[n.get("id") for n in root.iter() if n.get("id")]
    check(len(ids)==len(set(ids)),f"SVG unique IDs: {path.relative_to(ROOT)}")
    if "sources" not in path.parts:
        tags={n.tag.rsplit("}",1)[-1] for n in root.iter()}
        check(not tags.intersection({"image","text","script","foreignObject"}),
              f"Production SVG uses only vectors: {path.relative_to(ROOT)}")
    svg_count+=1

# Measure exported PATHS, rather than trusting the generation metrics.
geometry=json.loads((ROOT/"docs/geometry.json").read_text())
measured={}
for kind in ("stacked","horizontal","wordmark"):
    root=ET.parse(ROOT/f"assets/brand/svg/logo-{kind}-dark.svg").getroot()
    wb=part_bounds(root,"wordmark")
    mb=part_bounds(root,"hand")
    actual=([min(wb[0],mb[0]),min(wb[1],mb[1]),max(wb[2],mb[2]),max(wb[3],mb[3])] if mb else wb)
    w,h=geometry[kind]["canvas"]
    center=[(actual[0]+actual[2])/2,(actual[1]+actual[3])/2]
    error=max(abs(center[0]-w/2),abs(center[1]-h/2))
    check(error<.001,f"Actual vector centering: {kind}",center=center,max_error_units=error)
    if kind=="stacked":
        check(abs((mb[0]+mb[2])/2-(wb[0]+wb[2])/2)<.001,"Stacked hand and wordmark share X axis")
    if kind=="horizontal":
        check(abs((mb[1]+mb[3])/2-(wb[1]+wb[3])/2)<.001,"Horizontal hand and wordmark share Y axis")
    measured[kind]={"hand_bounds":mb,"wordmark_bounds":wb,"content_center":center,"max_error_units":error}

# Exact highlight palette exists in actual rendered primary PNG.
pixels=np.array(Image.open(ROOT/"assets/brand/png/logo-stacked-dark-1024.png").convert("RGBA"))
for color in [(255,255,255),(155,249,164)]:
    count=int(np.count_nonzero(np.all(pixels[:,:,:3]==color,axis=2)&(pixels[:,:,3]==255)))
    check(count>100,f"Primary color {color}",solid_pixels=count)

# Compare the traced hand against the source threshold used for extraction.
ref=np.array(Image.open(ROOT/"sources/reference-logo.png").convert("RGB"))
refmask=(ref[:,:,0]>128)&(ref[:,:,1]>160)&(ref[:,:,2]>128)
refmask[820:,:]=False
trace=np.array(Image.open(ROOT/"docs/hand-trace-check.png").convert("L"))>127
iou=float(np.count_nonzero(trace&refmask)/np.count_nonzero(trace|refmask))
check(iou>.995,"Hand silhouette overlap with supplied source",intersection_over_union=iou)

# All ink, including fingers, must fit in the central circle of radius 40%.
safezone={}
for rel in ("public/icons/icon-maskable-192.png","public/icons/icon-maskable-512.png","marketing/avatar/avatar-1024.png"):
    a=np.array(Image.open(ROOT/rel).convert("RGB"));n=a.shape[0]
    ink=np.max(np.abs(a.astype(int)-np.array([1,70,48])),axis=2)>32
    yy,xx=np.nonzero(ink)
    radius=float(np.sqrt((xx+.5-n/2)**2+(yy+.5-n/2)**2).max())
    check(radius<=n*.4,f"Mask-safe silhouette: {rel}",max_radius=radius,limit=n*.4)
    safezone[rel]={"ink_max_radius":radius,"safe_radius":n*.4}

manifest=json.loads((ROOT/"public/site.webmanifest").read_text())
for i in manifest["icons"]:
    check((ROOT/"public"/i["src"]).is_file(),f"Manifest asset exists: {i['src']}")
    im=Image.open(ROOT/"public"/i["src"])
    check(f"{im.width}x{im.height}"==i["sizes"],f"Manifest icon size: {i['src']}")
check(manifest["theme_color"]=="#f4f5f7" and manifest["background_color"]=="#f4f5f7",
      "PWA background colors match DESIGN.md")

report={"status":"passed","checked_at_utc":datetime.now(timezone.utc).isoformat(),
        "png_render_jobs":png_count,"svg_files":svg_count,"checks_passed":len(CHECKS),
        "hand_silhouette_iou":iou,"centering_from_actual_paths":measured,
        "safe_zone":safezone,"checks":CHECKS}
(ROOT/"docs/validation.json").write_text(json.dumps(report,indent=2)+"\n")

# Stable ordered inventory, excluding self-referential hashes and local installs.
files=[]
for p in sorted(ROOT.rglob("*")):
    rel=p.relative_to(ROOT)
    if not p.is_file() or any(n in rel.parts for n in ("node_modules",".venv","__pycache__",".git")):
        continue
    if p.name in ("MANIFEST.json","SHA256SUMS.txt",".DS_Store") or p.suffix==".pyc":
        continue
    data=p.read_bytes()
    files.append({"path":str(rel),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
(ROOT/"MANIFEST.json").write_text(json.dumps({"brand":"fatt APPost","version":"1.0.0","files":files},indent=2)+"\n")
(ROOT/"SHA256SUMS.txt").write_text("".join(f"{i['sha256']}  {i['path']}\n" for i in files))
print(f"PASS: {len(CHECKS)} checks; {svg_count} SVGs; {png_count} PNG render jobs; hand IoU {iou:.6f}.")
