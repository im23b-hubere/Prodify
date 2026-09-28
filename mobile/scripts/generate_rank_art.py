"""
Generate the rank medallion artwork: one 120x120 SVG illustration per named rank (1-20).
Run from repo: python mobile/scripts/generate_rank_art.py
Writes mobile/lib/rankArt.generated.ts. Pass --preview <file.svg> to also write a contact sheet.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "lib" / "rankArt.generated.ts"

TIERS = {
    "starter": ("#e3a15e", "#2b180a"),
    "builder": ("#43c4ad", "#0a2622"),
    "engineer": ("#6e9cff", "#0d1938"),
    "pro": ("#ae79ff", "#1d0b3c"),
    "legend": ("#f4d34a", "#3b2c04"),
}


def tier_for(level):
    return ["starter", "builder", "engineer", "pro", "legend"][min(4, (level - 1) // 4)]


def frame(p, level, scene, defs=""):
    light, dark = TIERS[tier_for(level)]
    return f"""<defs>
<radialGradient id="{p}bg" cx="50%" cy="38%" r="68%"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></radialGradient>
<linearGradient id="{p}gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<clipPath id="{p}clip"><circle cx="60" cy="60" r="60"/></clipPath>
{defs}
</defs>
<circle cx="60" cy="60" r="60" fill="url(#{p}bg)"/>
<g clip-path="url(#{p}clip)">
{scene}
</g>
<ellipse cx="60" cy="30" rx="44" ry="22" fill="url(#{p}gloss)"/>
<circle cx="60" cy="60" r="58" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>"""


def shadow(cx=60, cy=96, rx=34, ry=5):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#000" opacity="0.28"/>'


def sparkle(x, y, s, fill="#fff", opacity=0.9):
    return (
        f'<path d="M {x} {y-s} Q {x} {y} {x+s} {y} Q {x} {y} {x} {y+s} Q {x} {y} {x-s} {y} '
        f'Q {x} {y} {x} {y-s} Z" fill="{fill}" opacity="{opacity}"/>'
    )


def note(x, y, fill="#fff", opacity=0.9):
    return (
        f'<g opacity="{opacity}"><ellipse cx="{x}" cy="{y}" rx="4" ry="3" fill="{fill}" transform="rotate(-20 {x} {y})"/>'
        f'<rect x="{x+3}" y="{y-14}" width="1.8" height="14" fill="{fill}"/>'
        f'<path d="M {x+4.8} {y-14} q 5 2 5 7" stroke="{fill}" stroke-width="1.8" fill="none"/></g>'
    )


# ---------------------------------------------------------------- starter

def art_1(p):  # Bedroom Producer: late-night desk, laptop, lamp, plant
    defs = f"""<linearGradient id="{p}screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3140"/><stop offset="1" stop-color="#171a22"/></linearGradient>
<radialGradient id="{p}lamp" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#ffe3a3" stop-opacity="0.55"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient>"""
    scene = f"""
<circle cx="32" cy="32" r="8" fill="#fff4cf"/><circle cx="36" cy="29" r="7" fill="#b9773a"/>
{sparkle(50, 22, 2.2)}{sparkle(22, 48, 1.6)}{sparkle(88, 26, 1.8)}
<polygon points="82,47 64,82 100,82" fill="url(#{p}lamp)"/>
<rect x="12" y="80" width="96" height="7" rx="2" fill="#5a3418"/>
<rect x="12" y="80" width="96" height="2" fill="#7a4a24"/>
<rect x="20" y="87" width="4" height="20" fill="#4a2a12"/><rect x="96" y="87" width="4" height="20" fill="#4a2a12"/>
<rect x="38" y="50" width="42" height="28" rx="2.5" fill="#d7dbe2"/>
<rect x="40.5" y="52.5" width="37" height="23" rx="1.5" fill="url(#{p}screen)"/>
<rect x="43" y="56" width="14" height="3" rx="1" fill="#ff7a3d"/><rect x="59" y="56" width="10" height="3" rx="1" fill="#f5d547"/>
<rect x="47" y="61" width="18" height="3" rx="1" fill="#45c9b3"/><rect x="43" y="66" width="8" height="3" rx="1" fill="#b07cff"/>
<rect x="53" y="66" width="20" height="3" rx="1" fill="#ff7a3d"/><rect x="61" y="71" width="12" height="3" rx="1" fill="#45c9b3"/>
<rect x="52" y="54" width="1" height="20" fill="#ffffff" opacity="0.7"/>
<path d="M 34 78 L 84 78 L 88 81 L 30 81 Z" fill="#aeb4bf"/>
<path d="M 94 80 L 96 58 L 84 47" stroke="#2b2b30" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<circle cx="96" cy="58" r="2" fill="#3a3a40"/>
<path d="M 76 40 L 90 50 L 80 54 Z" fill="#f5a623"/><path d="M 76 40 L 90 50 L 84 49 Z" fill="#ffc861"/>
<rect x="90" y="78" width="10" height="3" rx="1" fill="#2b2b30"/>
<rect x="18" y="68" width="11" height="12" rx="2" fill="#c0692c"/><rect x="17" y="67" width="13" height="3" rx="1" fill="#d9803e"/>
<ellipse cx="20" cy="61" rx="3" ry="7" fill="#4caf64" transform="rotate(-25 20 61)"/>
<ellipse cx="27" cy="60" rx="3" ry="8" fill="#5cc775" transform="rotate(20 27 60)"/>
<ellipse cx="23.5" cy="57" rx="2.6" ry="8" fill="#3f9d57"/>
"""
    return frame(p, 1, scene, defs)


def art_2(p):  # Loop Sketcher: sketchbook with a loop drawn on it and a pencil
    scene = f"""
{shadow(58, 97, 32, 5)}
<rect x="30" y="30" width="54" height="64" rx="4" fill="#e9dcc4" transform="rotate(-6 57 62)"/>
<g transform="rotate(-6 57 62)">
<rect x="30" y="30" width="54" height="64" rx="4" fill="#fbf6ec"/>
<g fill="none" stroke="#e2d6c0" stroke-width="1">
<line x1="38" y1="44" x2="78" y2="44"/><line x1="38" y1="52" x2="78" y2="52"/><line x1="38" y1="60" x2="78" y2="60"/>
<line x1="38" y1="68" x2="78" y2="68"/><line x1="38" y1="76" x2="78" y2="76"/><line x1="38" y1="84" x2="78" y2="84"/></g>
<g fill="#8d7f6a">{''.join(f'<circle cx="30" cy="{36 + i * 8}" r="2.2"/>' for i in range(8))}</g>
<circle cx="58" cy="62" r="15" fill="none" stroke="#ff7a3d" stroke-width="4" stroke-dasharray="80 20" stroke-linecap="round"/>
<path d="M 71 55 L 75 64 L 66 63 Z" fill="#ff7a3d"/>
<circle cx="58" cy="62" r="4" fill="#f5a623"/>
</g>
<g transform="rotate(38 80 56)">
<rect x="74" y="20" width="10" height="44" rx="1.5" fill="#f5b83d"/>
<rect x="74" y="20" width="3.5" height="44" fill="#ffd36e"/>
<rect x="74" y="16" width="10" height="6" fill="#c9ced6"/>
<rect x="74" y="11" width="10" height="6" rx="2" fill="#e86a6a"/>
<path d="M 74 64 L 84 64 L 79 75 Z" fill="#f1d5a8"/>
<path d="M 77.3 70.5 L 80.7 70.5 L 79 75 Z" fill="#3a3a3a"/>
</g>
{sparkle(28, 26, 2.4)}{sparkle(94, 88, 2)}
"""
    return frame(p, 2, scene)


def art_3(p):  # Beat Builder: drum machine with lit pads
    pads = []
    lit = {(0, 0): "#ff7a3d", (1, 1): "#f5d547", (2, 0): "#ff7a3d", (3, 2): "#45c9b3", (0, 2): "#f5d547", (2, 2): "#ff7a3d"}
    for col in range(4):
        for row in range(3):
            x = 31 + col * 15
            y = 60 + row * 12
            color = lit.get((col, row), "#4a4e5c")
            glow = f'<rect x="{x-1.5}" y="{y-1.5}" width="15" height="12" rx="3" fill="{color}" opacity="0.35"/>' if (col, row) in lit else ""
            pads.append(f'{glow}<rect x="{x}" y="{y}" width="12" height="9" rx="2" fill="{color}"/>')
    scene = f"""
{shadow(60, 97, 38, 5)}
<rect x="22" y="36" width="76" height="58" rx="7" fill="#1f222a"/>
<rect x="22" y="36" width="76" height="58" rx="7" fill="none" stroke="#3a3f4c" stroke-width="1.5"/>
<rect x="28" y="42" width="30" height="11" rx="2" fill="#0f1a14"/>
<rect x="30" y="44" width="26" height="7" rx="1" fill="#ffb347" opacity="0.85"/>
<rect x="31.5" y="46" width="3" height="3" fill="#1f222a"/><rect x="36" y="45.5" width="3" height="4" fill="#1f222a"/><rect x="40.5" y="46.5" width="3" height="2.5" fill="#1f222a"/>
<circle cx="70" cy="47.5" r="5" fill="#d5d9e0"/><line x1="70" y1="47.5" x2="72.5" y2="44" stroke="#1f222a" stroke-width="1.5"/>
<circle cx="85" cy="47.5" r="5" fill="#d5d9e0"/><line x1="85" y1="47.5" x2="82" y2="44.5" stroke="#1f222a" stroke-width="1.5"/>
{''.join(pads)}
"""
    return frame(p, 3, scene)


def art_4(p):  # Crate Digger: record crate, one record pulled out
    grooves = "".join(
        f'<circle cx="76" cy="44" r="{r}" fill="none" stroke="#2c2c2c" stroke-width="0.7"/>' for r in (19, 16, 13, 10)
    )
    scene = f"""
{shadow(60, 98, 40, 5)}
<circle cx="76" cy="44" r="22" fill="#111114"/>{grooves}
<path d="M 60 30 A 22 22 0 0 1 90 34" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2" fill="none"/>
<circle cx="76" cy="44" r="7" fill="#e85d4a"/><circle cx="76" cy="44" r="1.5" fill="#111114"/>
<rect x="30" y="44" width="16" height="30" rx="1" fill="#3d7bd9" transform="rotate(-10 38 60)"/>
<rect x="42" y="42" width="16" height="32" rx="1" fill="#f2c14e" transform="rotate(-4 50 58)"/>
<circle cx="50" cy="54" r="5" fill="#e85d4a" transform="rotate(-4 50 58)"/>
<rect x="56" y="46" width="16" height="30" rx="1" fill="#e85d4a" transform="rotate(5 64 60)"/>
<rect x="68" y="50" width="16" height="28" rx="1" fill="#6fcf97" transform="rotate(10 76 64)"/>
<rect x="22" y="64" width="76" height="32" rx="3" fill="#b0692d"/>
<rect x="22" y="64" width="76" height="4" fill="#c98040"/>
<line x1="22" y1="75" x2="98" y2="75" stroke="#8a4f1f" stroke-width="1.4"/>
<line x1="22" y1="86" x2="98" y2="86" stroke="#8a4f1f" stroke-width="1.4"/>
<rect x="50" y="78" width="20" height="6" rx="3" fill="#5a3212"/>
{sparkle(30, 34, 2.4)}{sparkle(98, 70, 1.8)}
"""
    return frame(p, 4, scene)


# ---------------------------------------------------------------- builder

def art_5(p):  # Hook Writer: studio condenser mic with notes
    defs = f"""<linearGradient id="{p}mic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa3b1"/><stop offset="0.45" stop-color="#f1f4f8"/><stop offset="1" stop-color="#7d8594"/></linearGradient>"""
    grille = "".join(f'<line x1="47" y1="{30 + i * 5}" x2="73" y2="{30 + i * 5}" stroke="#6b7280" stroke-width="0.8" opacity="0.6"/>' for i in range(6))
    scene = f"""
{shadow(60, 99, 22, 4)}
<path d="M 40 56 Q 40 76 60 76 Q 80 76 80 56" stroke="#2a2e37" stroke-width="4" fill="none" stroke-linecap="round"/>
<rect x="57.5" y="76" width="5" height="18" fill="#2a2e37"/>
<rect x="44" y="93" width="32" height="5" rx="2.5" fill="#2a2e37"/>
<rect x="45" y="22" width="30" height="46" rx="15" fill="url(#{p}mic)"/>
{grille}
<rect x="45" y="56" width="30" height="5" fill="#c9a24a"/>
<rect x="45" y="61" width="30" height="7" rx="3" fill="#8b93a1"/>
<rect x="50" y="26" width="4" height="26" rx="2" fill="#ffffff" opacity="0.55"/>
{note(26, 44, "#f5d547")}{note(88, 36, "#ffffff")}{note(92, 70, "#ff7a3d", 0.85)}
"""
    return frame(p, 5, scene, defs)


def art_6(p):  # Arrangement Brain: DAW arrangement with song-shaped clips
    clips = [
        (0, 0, 18, "#43c4ad"), (0, 22, 30, "#43c4ad"), (0, 56, 26, "#43c4ad"),
        (1, 10, 26, "#ff7a3d"), (1, 40, 40, "#ff7a3d"),
        (2, 22, 20, "#f5d547"), (2, 46, 34, "#f5d547"),
        (3, 34, 46, "#e87fb0"),
    ]
    clip_svg = "".join(
        f'<rect x="{22 + x}" y="{46 + lane * 11}" width="{w}" height="8" rx="2" fill="{c}"/>'
        f'<rect x="{22 + x}" y="{46 + lane * 11}" width="{w}" height="2.5" rx="1" fill="#ffffff" opacity="0.3"/>'
        for lane, x, w, c in clips
    )
    scene = f"""
{shadow(60, 98, 42, 5)}
<rect x="14" y="32" width="92" height="62" rx="6" fill="#0c1f1c"/>
<rect x="14" y="32" width="92" height="62" rx="6" fill="none" stroke="#2c5a52" stroke-width="1.5"/>
<rect x="14" y="32" width="92" height="9" rx="6" fill="#16332e"/>
<circle cx="21" cy="36.5" r="1.8" fill="#ff5f57"/><circle cx="27" cy="36.5" r="1.8" fill="#febc2e"/><circle cx="33" cy="36.5" r="1.8" fill="#28c840"/>
{''.join(f'<line x1="18" y1="{44 + i * 11}" x2="102" y2="{44 + i * 11}" stroke="#1e3f39" stroke-width="0.8"/>' for i in range(5))}
{clip_svg}
<line x1="64" y1="42" x2="64" y2="92" stroke="#ffffff" stroke-width="1.5"/>
<path d="M 60 42 L 68 42 L 64 47 Z" fill="#ffffff"/>
{sparkle(100, 24, 2.4)}{sparkle(18, 22, 1.8)}
"""
    return frame(p, 6, scene)


def art_7(p):  # Synth Tweaker: analog synth with knobs and keys
    white = "".join(f'<rect x="{18 + i * 7}" y="70" width="6.4" height="20" rx="1" fill="#f4f5f7"/>' for i in range(12))
    black = "".join(
        f'<rect x="{18 + i * 7 + 4.4}" y="70" width="4" height="12" rx="0.8" fill="#15171c"/>'
        for i in range(11) if i % 7 not in (2, 6)
    )
    knobs = "".join(
        f'<circle cx="{26 + i * 14}" cy="52" r="5" fill="#e7eaef"/><circle cx="{26 + i * 14}" cy="52" r="5" fill="none" stroke="#9aa1ad" stroke-width="0.8"/>'
        f'<line x1="{26 + i * 14}" y1="52" x2="{26 + i * 14 + 3.5 * math.cos(a)}" y2="{52 - 3.5 * math.sin(a)}" stroke="#20242c" stroke-width="1.4" stroke-linecap="round"/>'
        for i, a in enumerate([2.4, 1.2, 0.4, 2.0, 1.6, 0.8])
    )
    scene = f"""
{shadow(60, 97, 44, 5)}
<rect x="12" y="38" width="96" height="56" rx="6" fill="#262a33"/>
<rect x="12" y="38" width="96" height="3" rx="1.5" fill="#43c4ad"/>
<rect x="12" y="38" width="7" height="56" rx="3" fill="#8a5a2b"/><rect x="101" y="38" width="7" height="56" rx="3" fill="#8a5a2b"/>
{knobs}
<rect x="22" y="61" width="30" height="4" rx="2" fill="#0d1a18"/><rect x="24" y="62" width="18" height="2" rx="1" fill="#43c4ad"/>
<rect x="60" y="61" width="36" height="4" rx="2" fill="#0d1a18"/><rect x="62" y="62" width="10" height="2" rx="1" fill="#ff7a3d"/>
{white}{black}
"""
    return frame(p, 7, scene)


def art_8(p):  # DAW Demon: monitor with devil horns and a hot waveform
    wave = " ".join(
        f"{'M' if i == 0 else 'L'} {26 + i * 2} {60 + math.sin(i * 0.9) * (3 + (i % 5) * 2.2)}" for i in range(35)
    )
    scene = f"""
{shadow(60, 99, 30, 4)}
<path d="M 30 36 Q 22 22 30 14 Q 30 26 40 32 Z" fill="#e8443a"/>
<path d="M 90 36 Q 98 22 90 14 Q 90 26 80 32 Z" fill="#e8443a"/>
<path d="M 30 36 Q 25 26 29 19 Q 30 28 36 33 Z" fill="#ff7b6e"/>
<rect x="18" y="32" width="84" height="54" rx="5" fill="#1a1d24"/>
<rect x="22" y="36" width="76" height="44" rx="2" fill="#0b1f1c"/>
<path d="{wave}" stroke="#43c4ad" stroke-width="2" fill="none" stroke-linejoin="round"/>
<path d="{wave}" stroke="#43c4ad" stroke-width="6" fill="none" opacity="0.2"/>
<line x1="22" y1="60" x2="98" y2="60" stroke="#ffffff" stroke-opacity="0.12"/>
<rect x="54" y="86" width="12" height="7" fill="#2a2e37"/>
<rect x="42" y="93" width="36" height="4" rx="2" fill="#2a2e37"/>
<path d="M 84 40 L 94 40" stroke="#ff5a4e" stroke-width="2" stroke-linecap="round"/>
<circle cx="28" cy="42" r="1.6" fill="#ff5a4e"/>
"""
    return frame(p, 8, scene)


# ---------------------------------------------------------------- engineer

def art_9(p):  # Drum Pocket: snare drum with crossed sticks
    defs = f"""<linearGradient id="{p}shell" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9c1f1a"/><stop offset="0.4" stop-color="#e5483d"/><stop offset="1" stop-color="#8a1a16"/></linearGradient>
<linearGradient id="{p}chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8c96a5"/><stop offset="0.45" stop-color="#f4f7fb"/><stop offset="1" stop-color="#7b8494"/></linearGradient>"""
    rods = "".join(f'<rect x="{x}" y="60" width="2.5" height="26" fill="url(#{p}chrome)"/>' for x in (30, 44, 58.8, 74, 88))
    scene = f"""
{shadow(60, 99, 38, 5)}
<rect x="24" y="58" width="72" height="30" fill="url(#{p}shell)"/>
{rods}
<ellipse cx="60" cy="88" rx="36" ry="8" fill="url(#{p}shell)"/>
<ellipse cx="60" cy="88" rx="36" ry="8" fill="none" stroke="url(#{p}chrome)" stroke-width="3"/>
<ellipse cx="60" cy="58" rx="36" ry="10" fill="#f3efe6"/>
<ellipse cx="60" cy="58" rx="36" ry="10" fill="none" stroke="url(#{p}chrome)" stroke-width="3.5"/>
<ellipse cx="60" cy="57" rx="16" ry="4" fill="#ffffff" opacity="0.6"/>
<g transform="rotate(-28 60 40)"><rect x="57" y="10" width="6" height="56" rx="3" fill="#e7c186"/><rect x="57" y="10" width="2" height="56" fill="#f6dcaa"/><ellipse cx="60" cy="10" rx="3.6" ry="4.5" fill="#e7c186"/></g>
<g transform="rotate(28 60 40)"><rect x="57" y="10" width="6" height="56" rx="3" fill="#dcb376"/><rect x="57" y="10" width="2" height="56" fill="#f0d29c"/><ellipse cx="60" cy="10" rx="3.6" ry="4.5" fill="#dcb376"/></g>
{sparkle(24, 40, 2.6)}{sparkle(98, 44, 2.2)}
"""
    return frame(p, 9, scene, defs)


def art_10(p):  # Sub Sculptor: subwoofer cone with shockwaves
    defs = f"""<radialGradient id="{p}cone" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#4b5263"/><stop offset="1" stop-color="#15181f"/></radialGradient>
<radialGradient id="{p}cap" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8d96a8"/><stop offset="1" stop-color="#2d323d"/></radialGradient>"""
    rings = "".join(
        f'<circle cx="60" cy="60" r="{r}" fill="none" stroke="#9ec0ff" stroke-width="2" opacity="{o}"/>' for r, o in ((44, 0.5), (51, 0.3), (58, 0.15))
    )
    scene = f"""
{rings}
<rect x="24" y="24" width="72" height="72" rx="10" fill="#15171d"/>
<rect x="24" y="24" width="72" height="72" rx="10" fill="none" stroke="#343a46" stroke-width="1.5"/>
{''.join(f'<circle cx="{x}" cy="{y}" r="2" fill="#5a6273"/>' for x, y in ((31, 31), (89, 31), (31, 89), (89, 89)))}
<circle cx="60" cy="60" r="30" fill="#2b303b"/>
<circle cx="60" cy="60" r="27" fill="none" stroke="#3d4454" stroke-width="3"/>
<circle cx="60" cy="60" r="24" fill="url(#{p}cone)"/>
<circle cx="60" cy="60" r="10" fill="url(#{p}cap)"/>
<ellipse cx="56" cy="55" rx="4" ry="2.5" fill="#ffffff" opacity="0.35"/>
<path d="M 40 44 A 24 24 0 0 1 58 36" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" fill="none"/>
"""
    return frame(p, 10, scene, defs)


def art_11(p):  # Mix Engineer: console with faders and meters
    strips = []
    for i, fader in enumerate([0.3, 0.6, 0.45, 0.7, 0.35, 0.55]):
        x = 22 + i * 13
        strips.append(f'<circle cx="{x + 4}" cy="44" r="3.4" fill="#d9dee6"/><line x1="{x + 4}" y1="44" x2="{x + 5.8}" y2="41.4" stroke="#1d212a" stroke-width="1.2"/>')
        leds = 5
        lit = 2 + (i * 3) % 4
        for k in range(leds):
            color = "#3ddc84" if k < 3 else ("#f5d547" if k == 3 else "#ff5a4e")
            on = k < lit
            strips.append(f'<rect x="{x + 7.5}" y="{80 - k * 5}" width="2.5" height="3.5" rx="0.6" fill="{color}" opacity="{1 if on else 0.2}"/>')
        strips.append(f'<rect x="{x + 3}" y="54" width="2" height="30" rx="1" fill="#0b0d12"/>')
        y = 54 + (1 - fader) * 26
        strips.append(f'<rect x="{x - 0.5}" y="{y}" width="9" height="5" rx="1.2" fill="#e9edf3"/><rect x="{x - 0.5}" y="{y + 2}" width="9" height="1" fill="#6e9cff"/>')
    scene = f"""
{shadow(60, 99, 44, 5)}
<path d="M 14 36 L 106 36 L 110 94 L 10 94 Z" fill="#232733"/>
<path d="M 14 36 L 106 36 L 106.4 40 L 13.6 40 Z" fill="#6e9cff" opacity="0.8"/>
{''.join(strips)}
<line x1="14" y1="50" x2="106" y2="50" stroke="#343a48" stroke-width="1"/>
"""
    return frame(p, 11, scene)


def art_12(p):  # Sidechain Surgeon: pumping waveform and a scalpel
    bars = []
    for i in range(22):
        phase = (i % 5) / 4
        h = 6 + phase * 22
        x = 16 + i * 4
        bars.append(f'<rect x="{x}" y="{62 - h / 2}" width="2.6" height="{h}" rx="1.3" fill="#9ec0ff" opacity="{0.55 + phase * 0.45}"/>')
    scene = f"""
<rect x="12" y="38" width="96" height="48" rx="8" fill="#0b1328" opacity="0.8"/>
{''.join(bars)}
<path d="M 16 80 L 22 80 L 26 70 L 30 88 L 34 76 L 104 76" stroke="#ff5a78" stroke-width="1.8" fill="none" stroke-linejoin="round" opacity="0.9"/>
<g transform="rotate(-35 64 46)">
<rect x="38" y="42" width="30" height="8" rx="3" fill="#cfd6e1"/>
<rect x="38" y="42" width="30" height="3" rx="1.5" fill="#f2f5f9"/>
{''.join(f'<line x1="{42 + k * 5}" y1="44" x2="{42 + k * 5}" y2="49" stroke="#9aa3b1" stroke-width="0.8"/>' for k in range(5))}
<path d="M 68 43 L 92 43 Q 98 46 92 50 L 68 49 Z" fill="#eef3f8"/>
<path d="M 68 43 L 92 43 Q 95 44.5 94 46 L 68 46 Z" fill="#ffffff"/>
</g>
<rect x="84" y="20" width="16" height="16" rx="3" fill="#ff5a78"/>
<rect x="90" y="23" width="4" height="10" rx="1" fill="#ffffff"/><rect x="87" y="26" width="10" height="4" rx="1" fill="#ffffff"/>
"""
    return frame(p, 12, scene)


# ---------------------------------------------------------------- pro

def art_13(p):  # Stereo Architect: blueprint with two speakers and the stereo field
    grid = "".join(f'<line x1="{x}" y1="0" x2="{x}" y2="120" stroke="#ffffff" stroke-opacity="0.07"/>' for x in range(10, 120, 10))
    grid += "".join(f'<line x1="0" y1="{y}" x2="120" y2="{y}" stroke="#ffffff" stroke-opacity="0.07"/>' for y in range(10, 120, 10))

    def speaker(x):
        return (
            f'<rect x="{x}" y="40" width="20" height="40" rx="3" fill="#1a1528"/>'
            f'<circle cx="{x + 10}" cy="50" r="4.5" fill="#3a3150"/><circle cx="{x + 10}" cy="50" r="2" fill="#d6b8ff"/>'
            f'<circle cx="{x + 10}" cy="67" r="7.5" fill="#3a3150"/><circle cx="{x + 10}" cy="67" r="3" fill="#8f6bd1"/>'
        )

    scene = f"""
{grid}
{shadow(60, 94, 44, 4)}
<path d="M 36 60 Q 60 20 84 60" stroke="#d6b8ff" stroke-width="1.5" fill="none" stroke-dasharray="3 3"/>
<path d="M 36 60 Q 60 34 84 60" stroke="#d6b8ff" stroke-width="1.5" fill="none" opacity="0.6"/>
<path d="M 36 60 L 60 84 L 84 60" stroke="#ffffff" stroke-width="1" fill="none" opacity="0.5"/>
{speaker(14)}{speaker(86)}
<circle cx="60" cy="84" r="5" fill="#ffffff"/>
<path d="M 53 84 A 7 7 0 0 1 67 84" stroke="#ffffff" stroke-width="2" fill="none"/>
<circle cx="60" cy="44" r="2" fill="#ffffff"/>
{sparkle(60, 26, 2.4, "#d6b8ff")}
"""
    return frame(p, 13, scene)


def art_14(p):  # Bus Compressor: vintage VU meter
    ticks = []
    for i in range(11):
        angle = math.radians(150 - i * 12)
        r1, r2 = 30, 34 if i % 5 else 36
        cx, cy = 60, 84
        color = "#c0392b" if i >= 8 else "#2a2233"
        ticks.append(
            f'<line x1="{cx + r1 * math.cos(angle):.1f}" y1="{cy - r1 * math.sin(angle):.1f}" '
            f'x2="{cx + r2 * math.cos(angle):.1f}" y2="{cy - r2 * math.sin(angle):.1f}" stroke="{color}" stroke-width="1.4"/>'
        )
    needle = math.radians(64)
    defs = f"""<radialGradient id="{p}face" cx="50%" cy="80%" r="80%"><stop offset="0" stop-color="#fff3cf"/><stop offset="1" stop-color="#e8c989"/></radialGradient>"""
    scene = f"""
{shadow(60, 99, 40, 5)}
<rect x="16" y="34" width="88" height="60" rx="8" fill="#241c30"/>
<rect x="21" y="39" width="78" height="50" rx="4" fill="url(#{p}face)"/>
<path d="M 30.4 67 A 34 34 0 0 1 89.6 67" stroke="#2a2233" stroke-width="1" fill="none"/>
<path d="M 81 58 A 34 34 0 0 1 89.6 67" stroke="#c0392b" stroke-width="3" fill="none"/>
{''.join(ticks)}
<text x="38" y="80" font-family="Helvetica" font-weight="bold" font-size="8" fill="#2a2233" text-anchor="middle">VU</text>
<line x1="60" y1="84" x2="{60 + 36 * math.cos(needle):.1f}" y2="{84 - 36 * math.sin(needle):.1f}" stroke="#1b1422" stroke-width="1.6" stroke-linecap="round"/>
<rect x="21" y="82" width="78" height="7" fill="#241c30"/>
<circle cx="60" cy="84" r="3.5" fill="#1b1422"/>
<rect x="21" y="39" width="78" height="10" rx="4" fill="#ffffff" opacity="0.25"/>
<circle cx="96" cy="30" r="3" fill="#ff5a4e"/><circle cx="96" cy="30" r="6" fill="#ff5a4e" opacity="0.3"/>
"""
    return frame(p, 14, scene, defs)


def art_15(p):  # Pre-Master: spectrum analyser with an EQ curve
    defs = f"""<linearGradient id="{p}bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7b4ddb"/><stop offset="1" stop-color="#ff7ad9"/></linearGradient>"""
    heights = [14, 22, 30, 36, 34, 28, 30, 24, 20, 22, 16, 12, 10, 8]
    bars = "".join(
        f'<rect x="{19 + i * 6}" y="{86 - h}" width="4.4" height="{h}" rx="1" fill="url(#{p}bar)"/>' for i, h in enumerate(heights)
    )
    scene = f"""
{shadow(60, 99, 44, 5)}
<rect x="12" y="34" width="96" height="60" rx="7" fill="#130a26"/>
<rect x="12" y="34" width="96" height="60" rx="7" fill="none" stroke="#3d2a66" stroke-width="1.5"/>
{''.join(f'<line x1="16" y1="{y}" x2="104" y2="{y}" stroke="#ffffff" stroke-opacity="0.06"/>' for y in (46, 58, 70, 82))}
{bars}
<path d="M 16 64 C 30 64 32 50 44 50 C 56 50 58 68 70 68 C 82 68 86 56 104 56" stroke="#ffffff" stroke-width="2" fill="none"/>
<circle cx="44" cy="50" r="3" fill="#ffffff"/><circle cx="70" cy="68" r="3" fill="#ffffff"/><circle cx="92" cy="58" r="3" fill="#ffffff"/>
{sparkle(100, 24, 2.4)}
"""
    return frame(p, 15, scene, defs)


def art_16(p):  # Final Bounce: audio file dropping into a shiny disc
    defs = f"""<linearGradient id="{p}disc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f2ff"/><stop offset="0.3" stop-color="#ffc6f2"/><stop offset="0.55" stop-color="#c8f5ff"/><stop offset="0.8" stop-color="#fff2b8"/><stop offset="1" stop-color="#d7ccff"/></linearGradient>"""
    wave = " ".join(f"{'M' if i == 0 else 'L'} {27 + i * 2} {40 + math.sin(i * 1.3) * (2 + (i % 4) * 1.6)}" for i in range(16))
    scene = f"""
{shadow(72, 100, 30, 4)}
<circle cx="72" cy="74" r="24" fill="url(#{p}disc)"/>
<circle cx="72" cy="74" r="24" fill="none" stroke="#ffffff" stroke-opacity="0.8"/>
<circle cx="72" cy="74" r="8" fill="#e6e1f5"/><circle cx="72" cy="74" r="3" fill="#2a1a4a"/>
<path d="M 56 62 A 20 20 0 0 1 74 52" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/>
<rect x="20" y="24" width="40" height="32" rx="4" fill="#f7f5ff"/>
<path d="M 50 24 L 60 34 L 50 34 Z" fill="#d9d2f2"/>
<path d="{wave}" stroke="#8a55ea" stroke-width="1.8" fill="none"/>
<rect x="24" y="48" width="18" height="3" rx="1.5" fill="#c9bff0"/>
<path d="M 52 50 Q 64 50 66 58" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M 60 56 L 67 62 L 70 53 Z" fill="#ffffff"/>
{sparkle(98, 42, 3)}{sparkle(40, 80, 2.2)}
"""
    return frame(p, 16, scene, defs)


# ---------------------------------------------------------------- legend

def art_17(p):  # Release Ready: rocket with a vinyl porthole
    defs = f"""<linearGradient id="{p}body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9ced8"/><stop offset="0.45" stop-color="#ffffff"/><stop offset="1" stop-color="#aab1bf"/></linearGradient>
<linearGradient id="{p}flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.5" stop-color="#ffb22e"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></linearGradient>"""
    scene = f"""
<g transform="rotate(35 60 60)">
<path d="M 52 78 Q 60 112 68 78 Z" fill="url(#{p}flame)"/>
<path d="M 55 78 Q 60 98 65 78 Z" fill="#fffbe0"/>
<path d="M 48 64 L 38 82 L 50 78 Z" fill="#e8443a"/><path d="M 72 64 L 82 82 L 70 78 Z" fill="#e8443a"/>
<path d="M 60 16 Q 76 34 72 78 L 48 78 Q 44 34 60 16 Z" fill="url(#{p}body)"/>
<path d="M 60 16 Q 68 24 70.5 32 L 49.5 32 Q 52 24 60 16 Z" fill="#e8443a"/>
<circle cx="60" cy="50" r="9" fill="#111114"/><circle cx="60" cy="50" r="9" fill="none" stroke="#9aa3b1" stroke-width="2"/>
<circle cx="60" cy="50" r="6" fill="none" stroke="#2c2c2c" stroke-width="0.6"/>
<circle cx="60" cy="50" r="3" fill="#f5d547"/>
<rect x="56" y="70" width="8" height="8" fill="#e8443a"/>
</g>
<circle cx="22" cy="92" r="9" fill="#ffffff" opacity="0.25"/><circle cx="32" cy="100" r="11" fill="#ffffff" opacity="0.2"/><circle cx="14" cy="104" r="8" fill="#ffffff" opacity="0.18"/>
{sparkle(24, 30, 2.6)}{sparkle(96, 88, 2.2)}{sparkle(40, 16, 1.6)}
"""
    return frame(p, 17, scene, defs)


def art_18(p):  # Platinum Ears: platinum headphones
    defs = f"""<linearGradient id="{p}plat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#cfd6e2"/><stop offset="1" stop-color="#8e97a8"/></linearGradient>"""
    scene = f"""
{shadow(60, 100, 36, 5)}
<path d="M 28 66 Q 28 24 60 24 Q 92 24 92 66" stroke="url(#{p}plat)" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M 34 60 Q 36 32 60 31" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.7"/>
<rect x="18" y="58" width="22" height="34" rx="10" fill="url(#{p}plat)"/>
<rect x="80" y="58" width="22" height="34" rx="10" fill="url(#{p}plat)"/>
<rect x="34" y="62" width="8" height="26" rx="4" fill="#2a2e37"/>
<rect x="78" y="62" width="8" height="26" rx="4" fill="#2a2e37"/>
<rect x="22" y="64" width="4" height="18" rx="2" fill="#ffffff" opacity="0.8"/>
<circle cx="91" cy="75" r="4" fill="#f5d547"/>
{sparkle(60, 50, 5)}{sparkle(98, 36, 2.6)}{sparkle(22, 40, 2)}
"""
    return frame(p, 18, scene, defs)


def art_19(p):  # Studio Legend: golden ribbon mic in a laurel wreath
    defs = f"""<linearGradient id="{p}gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8860b"/><stop offset="0.45" stop-color="#ffe98a"/><stop offset="1" stop-color="#a87a08"/></linearGradient>"""
    leaves = []
    for side in (-1, 1):
        p0 = (60 + side * 6, 96)
        p1 = (60 + side * 46, 90)
        p2 = (60 + side * 38, 30)
        stem = f"M {p0[0]} {p0[1]} Q {p1[0]} {p1[1]} {p2[0]} {p2[1]}"
        leaves.append(f'<path d="{stem}" stroke="#c99a1e" stroke-width="2" fill="none" stroke-linecap="round"/>')
        for i in range(7):
            t = 0.18 + i * 0.12
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
            dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
            dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
            tangent = math.degrees(math.atan2(dy, dx))
            for flip in (-1, 1):
                rot = tangent + 90 + flip * 40
                ox = x + math.cos(math.radians(rot - 90)) * 4.5
                oy = y + math.sin(math.radians(rot - 90)) * 4.5
                shade = "#f3d25c" if flip > 0 else "#d9ad2b"
                leaves.append(
                    f'<ellipse cx="{ox:.1f}" cy="{oy:.1f}" rx="2.6" ry="5.6" fill="{shade}" '
                    f'transform="rotate({rot:.0f} {ox:.1f} {oy:.1f})"/>'
                )
        tip_x, tip_y = p2
        leaves.append(f'<ellipse cx="{tip_x}" cy="{tip_y - 4}" rx="2.6" ry="5.6" fill="#f3d25c" transform="rotate({side * 20} {tip_x} {tip_y - 4})"/>')
    scene = f"""
{shadow(60, 101, 26, 4)}
{''.join(leaves)}
<rect x="44" y="24" width="32" height="48" rx="12" fill="url(#{p}gold)"/>
{''.join(f'<line x1="{48 + k * 4}" y1="30" x2="{48 + k * 4}" y2="66" stroke="#8a6200" stroke-width="1" opacity="0.5"/>' for k in range(7))}
<rect x="44" y="44" width="32" height="6" fill="#8a6200" opacity="0.55"/>
<rect x="49" y="28" width="4" height="38" rx="2" fill="#fff6c9" opacity="0.7"/>
<rect x="57" y="72" width="6" height="16" fill="url(#{p}gold)"/>
<rect x="44" y="88" width="32" height="6" rx="3" fill="url(#{p}gold)"/>
<path d="M 48 16 L 53 22 L 60 14 L 67 22 L 72 16 L 70 24 L 50 24 Z" fill="#ffe98a"/>
{sparkle(94, 30, 2.6)}{sparkle(26, 24, 2)}
"""
    return frame(p, 19, scene, defs)


def art_20(p):  # Hall of Sound: spotlit stage, curtains, trophy, crowd
    defs = f"""<linearGradient id="{p}curtain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d0f16"/><stop offset="0.5" stop-color="#c62532"/><stop offset="1" stop-color="#6d0f16"/></linearGradient>
<linearGradient id="{p}gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8860b"/><stop offset="0.45" stop-color="#fff0a0"/><stop offset="1" stop-color="#a87a08"/></linearGradient>
<linearGradient id="{p}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.05"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0.45"/></linearGradient>"""
    crowd = "".join(f'<circle cx="{8 + i * 9}" cy="{106 + (i % 2) * 3}" r="6" fill="#140c02"/>' for i in range(13))
    scene = f"""
<rect x="0" y="0" width="120" height="120" fill="#2a1c02" opacity="0.35"/>
<polygon points="30,0 40,0 66,84 46,84" fill="url(#{p}beam)"/>
<polygon points="80,0 90,0 74,84 54,84" fill="url(#{p}beam)"/>
<path d="M 0 0 L 30 0 Q 26 50 34 96 L 0 96 Z" fill="url(#{p}curtain)"/>
<path d="M 120 0 L 90 0 Q 94 50 86 96 L 120 96 Z" fill="url(#{p}curtain)"/>
<path d="M 0 0 L 120 0 L 120 12 Q 90 20 60 12 Q 30 20 0 12 Z" fill="#8f1520"/>
<rect x="0" y="84" width="120" height="14" fill="#4a3208"/>
<rect x="0" y="84" width="120" height="3" fill="#7a560f"/>
<ellipse cx="60" cy="85" rx="24" ry="4" fill="#fff6c8" opacity="0.5"/>
<path d="M 44 38 L 76 38 Q 76 64 60 66 Q 44 64 44 38 Z" fill="url(#{p}gold)"/>
<path d="M 44 42 Q 34 42 36 52 Q 38 58 46 58" stroke="url(#{p}gold)" stroke-width="3.5" fill="none"/>
<path d="M 76 42 Q 86 42 84 52 Q 82 58 74 58" stroke="url(#{p}gold)" stroke-width="3.5" fill="none"/>
<rect x="56" y="66" width="8" height="8" fill="url(#{p}gold)"/>
<rect x="48" y="74" width="24" height="9" rx="2" fill="#3b2a07"/>
<rect x="50" y="76" width="20" height="2" fill="#ffe98a" opacity="0.6"/>
<rect x="49" y="41" width="4" height="18" rx="2" fill="#fffbe0" opacity="0.7"/>
{sparkle(60, 30, 4)}{sparkle(42, 28, 2)}{sparkle(80, 30, 2.4)}
{crowd}
"""
    return frame(p, 20, scene, defs)


ARTS = {i: globals()[f"art_{i}"] for i in range(1, 21)}


def svg_for(level):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">{ARTS[level](f"r{level}")}</svg>'


def sheet():
    cells = []
    for level in range(1, 21):
        col = (level - 1) % 5
        row = (level - 1) // 5
        cells.append(f'<g transform="translate({10 + col * 130} {10 + row * 130})">{ARTS[level](f"s{level}")}</g>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 530" width="1320" height="1060">'
        '<rect width="660" height="530" fill="#0a0a0a"/>' + "".join(cells) + "</svg>"
    )


def main() -> None:
    entries = ",\n".join(
        f"  {level}: {json.dumps(' '.join(svg_for(level).split()))}" for level in range(1, 21)
    )
    OUT.write_text(
        "// Generated by scripts/generate_rank_art.py. Edit the generator, not this file.\n"
        "/** Full-colour medallion illustration (120x120 SVG markup) for each named rank. */\n"
        f"export const RANK_ART_XML: Record<number, string> = {{\n{entries},\n}};\n",
        encoding="utf-8",
    )
    if "--preview" in sys.argv:
        Path(sys.argv[sys.argv.index("--preview") + 1]).write_text(sheet(), encoding="utf-8")


if __name__ == "__main__":
    main()
