#!/usr/bin/env python3
"""Export the three HDR 效能工作模式 EETF curves as .cube LUTs for DaVinci Resolve.

Domain: absolute PQ (ST 2084) code, [0,1] == 0..10,000 nit, Rec.2020 primaries.
The LUT maps PQ code V -> V' (tone-mapped PQ code); primaries/gamut unchanged.

Outputs (assets/luts/):
  1D LUTs  eetf_1d_<mode>.cube   — per-channel curve, 忠实对应 EETF；文件小
  3D LUTs  eetf_3d_<mode>.cube   — RGB-max 保色相压缩；高饱和高光不偏色
"""
import os

# ---- PQ (ST 2084) ----
m1 = 2610/16384; m2 = 2523/4096*128
c1 = 3424/4096; c2 = 2413/4096*32; c3 = 2392/4096*32
def pq_inv(nit):                     # nit -> code
    Y = max(nit, 0)/10000; Ym = Y**m1
    return ((c1 + c2*Ym)/(1 + c3*Ym))**m2

KS_FLOOR = pq_inv(350)               # 参考白保护下限

MODES = [
    ("performance4000", "性能模式(面板4000nit)", 4000),
    ("performance", "性能模式(面板3000nit)", 3000),
    ("balanced",    "平衡模式(L_target=1500 静态快照)", 1500),
    ("eco500",      "ECO模式(最高亮度500nit)", 500),
    ("eco600",      "ECO模式(最高亮度600nit)", 600),
    ("eco700",      "ECO模式(最高亮度700nit)", 700),
    ("eco800",      "ECO模式(最高亮度800nit)", 800),
    ("eco1000",     "ECO模式(最高亮度1000nit)", 1000),
]

def mode_params(Ltarget):
    Vpeak = pq_inv(Ltarget)
    KS = max(1.5*Vpeak - 0.5, KS_FLOOR)
    m0 = min(1 - KS, 3*(Vpeak - KS))     # 单调性钳制
    return Vpeak, KS, m0

def eetf_code(V, p):
    """PQ code -> tone-mapped PQ code. p = (Vpeak, KS, m0)."""
    Vpeak, KS, m0 = p
    if V <= KS:
        return V
    t = (V - KS)/(1 - KS)
    return ((2*t**3 - 3*t**2 + 1)*KS
            + (t**3 - 2*t**2 + t)*m0
            + (-2*t**3 + 3*t**2)*Vpeak)

def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x

OUT = "assets/luts"
os.makedirs(OUT, exist_ok=True)

# ---------- 1D LUTs (per-channel curve) ----------
N1 = 4096          # 高密度；对灰阶/中性内容数学上精确，无插值锯齿
for key, title, Lt in MODES:
    p = mode_params(Lt)
    lines = [
        f'# HDR 效能工作模式 EETF — {title} (L_target={Lt} nit)',
        '# Domain: absolute PQ (ST2084) code [0,1] = 0..10000 nit, Rec.2020',
        '# 1D per-channel tone curve; apply on PQ-encoded signal.',
        f'TITLE "EETF 1D {title} {Lt}nit"',
        f'LUT_1D_SIZE {N1}',
        'DOMAIN_MIN 0.0 0.0 0.0',
        'DOMAIN_MAX 1.0 1.0 1.0',
    ]
    for i in range(N1):
        v = clamp01(eetf_code(i/(N1-1), p))
        lines.append(f'{v:.6f} {v:.6f} {v:.6f}')
    with open(f'{OUT}/eetf_1d_{key}.cube', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

# ---------- 3D LUTs (RGB-max, hue-preserving) ----------
N3 = 65            # 65³ 高精度，配合 DaVinci 四面体插值基本无锯齿。灰阶/中性内容建议直接用 1D
for key, title, Lt in MODES:
    p = mode_params(Lt)
    lines = [
        f'# HDR 效能工作模式 EETF — {title} (L_target={Lt} nit)',
        '# Domain: absolute PQ (ST2084) code [0,1] = 0..10000 nit, Rec.2020',
        '# 3D LUT, RGB-max hue-preserving compression; apply on PQ-encoded signal.',
        f'TITLE "EETF 3D {title} {Lt}nit"',
        f'LUT_3D_SIZE {N3}',
        'DOMAIN_MIN 0.0 0.0 0.0',
        'DOMAIN_MAX 1.0 1.0 1.0',
    ]
    step = 1.0/(N3-1)
    for bi in range(N3):
        b = bi*step
        for gi in range(N3):
            g = gi*step
            for ri in range(N3):          # R varies fastest (.cube convention)
                r = ri*step
                M = max(r, g, b)
                if M <= 1e-9:
                    ro, go, bo = r, g, b
                else:
                    gain = eetf_code(M, p)/M     # 同比缩放 → 保色相
                    ro, go, bo = r*gain, g*gain, b*gain
                lines.append(f'{clamp01(ro):.6f} {clamp01(go):.6f} {clamp01(bo):.6f}')
    with open(f'{OUT}/eetf_3d_{key}.cube', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

# ---- sanity ----
for key, title, Lt in MODES:
    p = mode_params(Lt)
    def out_nit(nit):
        return None
    print(f'{title:32s} 1D+3D 已导出  '
          f'in 100→{eetf_code(pq_inv(100),p):.4f}  '
          f'in 1000→{eetf_code(pq_inv(1000),p):.4f}  '
          f'in 10000→{eetf_code(1.0,p):.4f} (=PQ({Lt}))')
print('files in', OUT)
