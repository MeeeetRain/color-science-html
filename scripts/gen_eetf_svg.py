#!/usr/bin/env python3
"""Generate EETF tone-mapping curve charts (SVG) for the HDR 效能工作模式 doc.

Fig 1 (assets/eetf_curve.svg): the three modes' input→output luminance curves
in absolute PQ domain, with knee points, the 1:1 reference diagonal, and the
compression region.  (ECO L_target updated to 800 nit — 实测高光预算下限)

Fig 2 (assets/eetf_curve_eco_brightness.svg): ECO on an 800-nit low-end panel
at user-brightness B = 1.0 / 0.5 / 0.2 — reference white drops with f(B)=B,
peak budget drops slower with g(B)=B^0.35, so headroom grows (3.9× → 11.2×).
"""
import math

# ---- PQ (ST 2084) ----
m1 = 2610/16384; m2 = 2523/4096*128
c1 = 3424/4096; c2 = 2413/4096*32; c3 = 2392/4096*32
def pq_inv(nit):            # nit -> code [0,1]
    Y = max(nit, 0)/10000
    Ym = Y**m1
    return ((c1 + c2*Ym)/(1 + c3*Ym))**m2
def pq_eotf(V):             # code -> nit
    V = max(V, 0); Vp = V**(1/m2)
    num = max(Vp - c1, 0); den = c2 - c3*Vp
    return (num/den)**(1/m1)*10000

KS_FLOOR = pq_inv(350)      # reference-white protection floor

def eetf(nit_in, Ltarget, floor=KS_FLOOR):
    V = pq_inv(nit_in)
    Vpeak = pq_inv(Ltarget)
    KS = max(1.5*Vpeak - 0.5, floor)
    if V <= KS:
        Vp = V
    else:
        t = (V - KS)/(1 - KS)
        # 起点切线钳制，保证 roll-off 单调不过冲（floor 抬高 KS 时才生效）
        m0 = min(1 - KS, 3*(Vpeak - KS))
        Vp = ((2*t**3 - 3*t**2 + 1)*KS
              + (t**3 - 2*t**2 + t)*m0
              + (-2*t**3 + 3*t**2)*Vpeak)
    return pq_eotf(Vp)

def knee_nit(Ltarget, floor=KS_FLOOR):
    KS = max(1.5*pq_inv(Ltarget) - 0.5, floor)
    return pq_eotf(KS)

def eetf_phys(nit_in, Ltarget, fB, floor=KS_FLOOR):
    """物理显示域：线性区 out=in×fB（斜率 fB），高光区 Hermite 抬到 Ltarget。"""
    V = pq_inv(nit_in)
    Vpeak = pq_inv(Ltarget)
    KS = max(1.5*Vpeak - 0.5, floor)
    if V <= KS:
        return nit_in * fB
    t = (V - KS)/(1 - KS)
    m0 = min(1 - KS, 3*(Vpeak - KS))
    Vp = ((2*t**3 - 3*t**2 + 1)*KS
          + (t**3 - 2*t**2 + t)*m0
          + (-2*t**3 + 3*t**2)*Vpeak)
    return pq_eotf(Vp)

def curve_points_phys(Lt, fB):
    pts = []
    for i in range(201):
        nit_in = 10**(LO + (HI - LO)*i/200)
        pts.append(f"{X(nit_in):.1f},{Y(max(eetf_phys(nit_in, Lt, fB),1)):.1f}")
    return " ".join(pts)

def m0_of(Ltarget, floor=KS_FLOOR):
    KS = max(1.5*pq_inv(Ltarget) - 0.5, floor)
    return min(1 - KS, 3*(pq_inv(Ltarget) - KS))

# ---- canvas / log-log mapping ----
W, H = 880, 620
L, R, T, B = 78, 96, 58, 68
PW, PH = W - L - R, H - T - B
LO, HI = math.log10(1), math.log10(10000)      # 1 .. 10000 nit
def X(nit): return L + (math.log10(max(nit,1)) - LO)/(HI - LO)*PW
def Y(nit): return (H - B) - (math.log10(max(nit,1)) - LO)/(HI - LO)*PH

def chart(title, out, extra):
    """extra: callable drawing into the svg list after grid/axes."""
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
               f'viewBox="0 0 {W} {H}" font-family="-apple-system,PingFang SC,sans-serif">')
    svg.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
    svg.append(f'<text x="{L}" y="30" font-size="19" font-weight="700" fill="#111">{title}</text>')

    # grid + ticks
    ticks = [1, 10, 100, 1000, 10000]
    for n in ticks:
        x, y = X(n), Y(n)
        svg.append(f'<line x1="{x:.1f}" y1="{T}" x2="{x:.1f}" y2="{H-B}" stroke="#eee"/>')
        svg.append(f'<line x1="{L}" y1="{y:.1f}" x2="{W-R}" y2="{y:.1f}" stroke="#eee"/>')
        lbl = f"{n//1000}k" if n >= 1000 else str(n)
        svg.append(f'<text x="{x:.1f}" y="{H-B+18}" font-size="12" fill="#555" '
                   f'text-anchor="middle">{lbl}</text>')
        svg.append(f'<text x="{L-10}" y="{y+4:.1f}" font-size="12" fill="#555" '
                   f'text-anchor="end">{lbl}</text>')

    svg.append(f'<rect x="{L}" y="{T}" width="{PW}" height="{PH}" fill="none" stroke="#999"/>')
    svg.append(f'<text x="{L+PW/2:.0f}" y="{H-24}" font-size="13.5" fill="#333" '
               'text-anchor="middle">输入亮度（内容信号，nit，对数）</text>')
    svg.append(f'<text x="22" y="{T+PH/2:.0f}" font-size="13.5" fill="#333" '
               f'text-anchor="middle" transform="rotate(-90 22 {T+PH/2:.0f})">'
               '输出亮度（面板显示，nit，对数）</text>')

    # 1:1 reference diagonal
    svg.append(f'<line x1="{X(1):.1f}" y1="{Y(1):.1f}" x2="{X(10000):.1f}" y2="{Y(10000):.1f}" '
               'stroke="#bbb" stroke-width="1.5" stroke-dasharray="6 5"/>')
    dlx, dly = X(3200), Y(5200)
    svg.append(f'<text x="{dlx:.1f}" y="{dly:.1f}" font-size="11.5" fill="#999" '
               f'text-anchor="middle" transform="rotate(-33 {dlx:.1f} {dly:.1f})">'
               '1:1 理想直通（输出 = 输入）</text>')

    extra(svg)
    svg.append('</svg>')
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(svg))

def curve_points(Lt, floor=KS_FLOOR, n=201):
    pts = []
    for i in range(n):
        nit_in = 10**(LO + (HI - LO)*i/(n-1))
        pts.append(f"{X(nit_in):.1f},{Y(eetf(nit_in, Lt, floor)):.1f}")
    return " ".join(pts)

def refwhite_line(svg, y_nit, label, color="#eab308", textcolor="#a16207"):
    yy = Y(y_nit)
    svg.append(f'<line x1="{L}" y1="{yy:.1f}" x2="{W-R}" y2="{yy:.1f}" '
               f'stroke="{color}" stroke-width="1.4" stroke-dasharray="3 4"/>')
    svg.append(f'<text x="{L+6:.1f}" y="{yy-6:.1f}" font-size="11.5" fill="{textcolor}">{label}</text>')

# =====================================================================
# Fig 1 — 三种模式
# =====================================================================
def fig1(svg):
    # 203 nit reference white (signal domain)
    xw = X(203)
    svg.append(f'<line x1="{xw:.1f}" y1="{T}" x2="{xw:.1f}" y2="{H-B}" stroke="#eab308" '
               'stroke-width="1.4" stroke-dasharray="3 4"/>')
    svg.append(f'<text x="{xw+5:.1f}" y="{T+16}" font-size="11.5" fill="#a16207">'
               '参考白 203 nit（恒 1:1）</text>')

    modes = [
        ("性能模式  L_target = 3000 nit", 3000, "#2563eb"),
        ("平衡模式  L_target ≈ 1500 nit（随场景 800–3000）", 1500, "#f59e0b"),
        ("ECO 模式  L_target = 800 nit", 800, "#10b981"),
    ]
    for name, Lt, col in modes:
        svg.append(f'<polyline points="{curve_points(Lt)}" fill="none" stroke="{col}" '
                   'stroke-width="3"/>')
        kn = knee_nit(Lt)
        kx, ky = X(kn), Y(kn)
        svg.append(f'<circle cx="{kx:.1f}" cy="{ky:.1f}" r="5" fill="#fff" stroke="{col}" '
                   'stroke-width="2.5"/>')
        py = Y(Lt)
        svg.append(f'<text x="{W-R+6}" y="{py+4:.1f}" font-size="11.5" fill="{col}" '
                   f'font-weight="600">{Lt}</text>')

    callouts = [
        (800,  "ECO 拐点 350 nit",   -60, -40, "#10b981"),
        (1500, "平衡 拐点 ≈590 nit", -58, -66, "#f59e0b"),
        (3000, "性能 拐点 ≈1660 nit", -60, -40, "#2563eb"),
    ]
    for Lt, txt, dx, dy, col in callouts:
        kn = knee_nit(Lt); kx, ky = X(kn), Y(kn)
        tx, ty = kx + dx, ky + dy
        svg.append(f'<line x1="{kx:.1f}" y1="{ky:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
                   f'stroke="{col}" stroke-width="1" opacity="0.55"/>')
        svg.append(f'<text x="{tx:.1f}" y="{ty-4:.1f}" font-size="11.5" fill="{col}" '
                   f'font-weight="600" text-anchor="middle">{txt}</text>')

    svg.append(f'<text x="{X(1100):.1f}" y="{Y(150):.1f}" font-size="12.5" fill="#2563eb" '
               f'opacity="0.9" text-anchor="middle">拐点右侧 → Hermite roll-off 压缩高光</text>')
    svg.append(f'<text x="{X(1100):.1f}" y="{Y(105):.1f}" font-size="12.5" fill="#555" '
               f'opacity="0.9" text-anchor="middle">拐点左侧 → 1:1 忠实直通（含参考白、肤色、中间调）</text>')

    lx, ly = L + 14, T + 40
    svg.append(f'<rect x="{lx-8}" y="{ly-20}" width="290" height="90" rx="6" '
               'fill="#ffffff" stroke="#ddd"/>')
    for i, (name, Lt, col) in enumerate(modes):
        yy = ly + i*24
        svg.append(f'<line x1="{lx}" y1="{yy}" x2="{lx+26}" y2="{yy}" stroke="{col}" '
                   'stroke-width="3"/>')
        svg.append(f'<text x="{lx+34}" y="{yy+4}" font-size="12" fill="#222">{name}</text>')

chart("HDR 效能工作模式 — EETF 色调映射曲线（绝对 PQ 域）", "assets/eetf_curve.svg", fig1)

# =====================================================================
# Fig 2 — ECO 用户亮度解耦（800 nit 面板）
# =====================================================================
PANEL = 800
BETA = 0.35
def g(b): return b**BETA
def f(b): return b

def fig2(svg):
    # signal reference white line
    xw = X(203)
    svg.append(f'<line x1="{xw:.1f}" y1="{T}" x2="{xw:.1f}" y2="{H-B}" stroke="#eab308" '
               'stroke-width="1.4" stroke-dasharray="3 4"/>')
    svg.append(f'<text x="{xw+5:.1f}" y="{T+16}" font-size="11.5" fill="#a16207">'
               '信号参考白 203 nit（码值恒不变）</text>')

    curves = [
        ("B = 1.0 · 线性斜率 1.0", 1.0, "#10b981", 1.0),
        ("B = 0.5 · 线性斜率 0.5", 0.5, "#0d9488", 0.85),
        ("B = 0.2 · 线性斜率 0.2", 0.2, "#0f766e", 0.7),
    ]
    for name, Bv, col, op in curves:
        P = PANEL*g(Bv)
        svg.append(f'<polyline points="{curve_points_phys(P, f(Bv))}" fill="none" stroke="{col}" '
                   f'stroke-width="3" opacity="{op}"/>')
        py = Y(P)
        svg.append(f'<text x="{W-R+6}" y="{py-4:.1f}" font-size="11.5" fill="{col}" '
                   f'font-weight="600" opacity="{op}">P(B)={P:.0f} · H={P/(203*f(Bv)):.1f}×</text>')
        # 物理拐点（信号码 349 × fB）随 B 下移
        ksig = knee_nit(PANEL)
        kx, ky = X(ksig), Y(ksig*f(Bv))
        svg.append(f'<circle cx="{kx:.1f}" cy="{ky:.1f}" r="4.5" fill="#fff" stroke="{col}" '
                   f'stroke-width="2.2" opacity="{op}"/>')

    # physical reference-white levels R(B), horizontal markers
    for _name, Bv, col, op in curves:
        Rv = 203*f(Bv)
        yy = Y(Rv)
        svg.append(f'<line x1="{X(203):.1f}" y1="{yy:.1f}" x2="{W-R}" y2="{yy:.1f}" '
                   f'stroke="#eab308" stroke-width="1.4" stroke-dasharray="3 4" opacity="{op}"/>')
        svg.append(f'<text x="{X(203)+6:.1f}" y="{yy-5:.1f}" font-size="11" fill="#a16207" '
                   f'opacity="{op}">R(B)={Rv:.0f}</text>')

    # f(B) dim line (linear slope) for B=0.2 reference
    svg.append(f'<line x1="{X(1):.1f}" y1="{Y(1*0.2):.1f}" x2="{X(10000):.1f}" y2="{Y(10000*0.2):.1f}" '
               'stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2 5" opacity="0.6"/>')
    svg.append(f'<text x="{X(2500):.1f}" y="{Y(2500*0.2)+16:.1f}" font-size="11" fill="#0f766e" '
               f'text-anchor="middle" transform="rotate(-33 {X(2500):.1f} {Y(2500*0.2):.1f})">'
               '线性区斜率 = f(B)（B=0.2）</text>')

    # annotation
    svg.append(f'<text x="{X(60):.1f}" y="{Y(800):.1f}" font-size="12" fill="#555" '
               'text-anchor="middle">峰值预算 P(B) = 800×B^0.35 — 降得慢</text>')
    svg.append(f'<text x="{X(110):.1f}" y="{Y(13):.1f}" font-size="12" fill="#a16207" '
               'text-anchor="middle">参考白物理 R(B) = 203×B — 降得快（线性区斜率=f(B)）</text>')
    svg.append(f'<text x="{X(1100):.1f}" y="{Y(150):.1f}" font-size="12.5" fill="#0d9488" '
               'text-anchor="middle">headroom H = P(B)/R(B)：调暗时增大（3.9× → 6.2× → 11.2×）</text>')

    # legend
    lx, ly = L + 14, T + 40
    svg.append(f'<rect x="{lx-8}" y="{ly-20}" width="300" height="100" rx="6" '
               'fill="#ffffff" stroke="#ddd"/>')
    for i, (name, Bv, col, op) in enumerate(curves):
        yy = ly + i*26
        svg.append(f'<line x1="{lx}" y1="{yy}" x2="{lx+26}" y2="{yy}" stroke="{col}" '
                   f'stroke-width="3" opacity="{op}"/>')
        svg.append(f'<text x="{lx+34}" y="{yy+4}" font-size="12" fill="#222" opacity="{op}">{name}</text>')

chart("ECO 用户亮度解耦 — 800 nit 面板 @ B = 1.0 / 0.5 / 0.2",
      "assets/eetf_curve_eco_brightness.svg", fig2)

# ---- sanity ----
for name, Lt, _ in [
    ("性能3000", 3000, None), ("平衡1500", 1500, None), ("ECO800", 800, None)]:
    print(f"{name:10s} knee = {knee_nit(Lt):7.1f} nit   out@10000 = {eetf(10000, Lt):6.1f} nit   m0 = {m0_of(Lt):.3f}")
for Bv in (1.0, 0.5, 0.2):
    P = PANEL*g(Bv); Rv = 203*f(Bv)
    print(f"B={Bv}: f={f(Bv):.2f} g={g(Bv):.3f} R={Rv:5.1f} P={P:5.1f} H={P/Rv:5.1f}x "
          f"knee={knee_nit(P):5.1f} m0={m0_of(P):.3f}")
print("wrote assets/eetf_curve.svg + assets/eetf_curve_eco_brightness.svg")
