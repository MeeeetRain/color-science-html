#!/usr/bin/env python3
"""
Generate SDR-vs-HDR comparison image.
Output: raw RGB48BE on stdout, intended for ffmpeg → AVIF PQ encoding.

Layout (1600x320):
  Left  half (800 wide): SDR — each linear RGB channel hard-clipped at 100 nit
  Right half (800 wide): HDR — same source content, native linear up to 1000 nit
Five horizontal color rows, each row ramps the source luminance log-scale
from 1 nit (left edge of half) to 1000 nit (right edge of half).
"""
import sys
import numpy as np

W, H = 1600, 320
PANEL_W = 800
ROWS = 5
GAP = 4  # vertical gap between rows
ROW_H = (H - GAP * (ROWS - 1)) // ROWS

# PQ (SMPTE ST 2084) inverse EOTF constants
m1 = 2610 / 16384
m2 = 2523 / 4096 * 128
c1 = 3424 / 4096
c2 = 2413 / 4096 * 32
c3 = 2392 / 4096 * 32

def pq_inv_eotf(L_nit):
    """Convert absolute luminance (cd/m²) to PQ signal in [0,1]."""
    Y = np.maximum(L_nit, 0.0) / 10000.0
    Ym1 = np.power(Y, m1)
    return np.power((c1 + c2 * Ym1) / (1.0 + c3 * Ym1), m2)

# Saturated colors (linear-light normalized RGB ratios)
colors = [
    (1.00, 0.08, 0.10),  # red
    (1.00, 0.50, 0.05),  # orange
    (1.00, 0.95, 0.10),  # yellow
    (0.12, 1.00, 0.35),  # green
    (0.20, 0.55, 1.00),  # blue
]

img_lin = np.zeros((H, W, 3), dtype=np.float32)

x_norm = np.arange(PANEL_W, dtype=np.float32) / (PANEL_W - 1)
# Log ramp: 1 nit → 1000 nit
L_ramp = np.power(10.0, x_norm * 3.0)

for i, (r, g, b) in enumerate(colors):
    y0 = i * (ROW_H + GAP)
    y1 = y0 + ROW_H
    # source linear RGB in nits
    src = np.stack([L_ramp * r, L_ramp * g, L_ramp * b], axis=-1)
    src_2d = np.tile(src[None, :, :], (ROW_H, 1, 1))
    # SDR: clip each channel at 100 nit
    sdr = np.clip(src_2d, 0.0, 100.0)
    # HDR: pass through, but cap at 1000 nit (display headroom)
    hdr = np.clip(src_2d, 0.0, 1000.0)
    img_lin[y0:y1, :PANEL_W] = sdr
    img_lin[y0:y1, PANEL_W:] = hdr

# narrow black divider in the middle
img_lin[:, PANEL_W - 2:PANEL_W + 2] = 0.0

mode = sys.argv[1] if len(sys.argv) > 1 else "pq"

if mode == "pq":
    # PQ-encoded raw RGB48BE → ffmpeg → AVIF (BT.2020 / PQ / 10-bit)
    pq = pq_inv_eotf(img_lin)
    u16 = np.clip(pq * 65535.0, 0, 65535).astype(np.uint16)
    sys.stdout.buffer.write(u16.byteswap().tobytes())
elif mode == "sdr":
    # SDR fallback: simulate same idea on SDR display.
    # Normalize each side to its own white point so the SDR/HDR contrast is visible.
    out = np.zeros_like(img_lin)
    # SDR half: already clipped to 100 nit → divide by 100 to get 0..1
    out[:, :PANEL_W] = img_lin[:, :PANEL_W] / 100.0
    # HDR half: divide by 1000 to compress 1000 nit headroom into 0..1
    # (preserves channel ratios → saturation stays)
    out[:, PANEL_W:] = img_lin[:, PANEL_W:] / 1000.0
    out = np.clip(out, 0.0, 1.0)
    # sRGB OETF (approximation)
    srgb = np.where(out <= 0.0031308, 12.92 * out, 1.055 * np.power(out, 1 / 2.4) - 0.055)
    u8 = np.clip(srgb * 255.0, 0, 255).astype(np.uint8)
    sys.stdout.buffer.write(u8.tobytes())
else:
    sys.exit(f"unknown mode: {mode}")
