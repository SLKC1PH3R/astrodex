"""Rend des globes à partir des mosaïques NASA (projection orthographique + éclairage)."""
import numpy as np, sys, os
from PIL import Image
# Usage : python render_globes.py "<chemin vers NASA-3D-Resources/Images and Textures>"
SRC = (sys.argv[1] if len(sys.argv) > 1 else "NASA-3D-Resources/Images and Textures").rstrip("/") + "/"
OUT = os.path.join(os.path.dirname(__file__), "..", "catalog", "images") + "/"
S = 640

def globe(mapfile, name, lon0=0.0, tilt=0.0, light=(-0.8, -0.35, 0.5), limb=0.0, atm=None, gamma=1.0, rings=False):
    tex = np.asarray(Image.open(SRC + mapfile).convert("RGB")).astype(np.float32) / 255
    th, tw, _ = tex.shape
    pad = 1.9 if rings else 1.08
    N = int(S * pad) if rings else S
    R = S / 2 / 1.08
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    x = (xx - N / 2) / R; y = (yy - N / 2) / R
    r2 = x * x + y * y
    inside = r2 <= 1
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    # rotation (inclinaison autour de l'axe X)
    ct, st = np.cos(tilt), np.sin(tilt)
    y2 = y * ct - z * st; z2 = y * st + z * ct
    lat = np.arcsin(np.clip(-y2, -1, 1))
    lon = np.arctan2(x, z2) + lon0
    u = ((lon / (2 * np.pi) + 0.5) % 1) * (tw - 1)
    v = (0.5 - lat / np.pi) * (th - 1)
    col = tex[v.astype(int).clip(0, th - 1), u.astype(int).clip(0, tw - 1)] ** gamma
    L = np.array(light, np.float32); L /= np.linalg.norm(L)
    lam = np.clip(x * L[0] + y * L[1] + z * L[2], 0, 1)
    shade = 0.012 + 1.05 * lam ** 1.05
    if limb:
        shade *= (1 - limb) + limb * z ** 0.5
    img = np.zeros((N, N, 4), np.float32)
    img[..., :3] = col * shade[..., None]
    img[..., 3] = inside
    # anticrénelage du bord
    edge = np.clip((1 - np.sqrt(r2)) * R, 0, 1)
    img[..., 3] = np.where(r2 <= 1.02, edge, 0)
    if atm is not None:
        d = np.sqrt(r2)
        halo = np.exp(-((d - 1) * R / (R * 0.035)) ** 2) * (d > 0.97)
        lit = np.clip((x * L[0] + y * L[1]) / np.maximum(d, 1e-3) * 0.6 + 0.6, 0, 1)
        a = halo * lit * 0.85
        c = np.array(atm, np.float32)
        img[..., :3] = img[..., :3] * (1 - a[..., None]) + c * a[..., None]
        img[..., 3] = np.maximum(img[..., 3], a)
    if rings:
        img = add_rings(img, x, y, z, inside, R, tilt=0.42, L=L)
    Image.fromarray((img.clip(0, 1) * 255).astype(np.uint8), "RGBA").save(OUT + name + ".webp", quality=88)
    print("ok", name)

def add_rings(img, x, y, z, inside, R, tilt, L):
    # anneaux dans le plan équatorial vu sous l'angle « tilt » ; profil radial A / Cassini / B / C
    st = np.sin(tilt)
    rr = np.sqrt(x ** 2 + (y / st) ** 2)  # rayon dans le plan des anneaux (en rayons planétaires)
    prof = np.zeros_like(rr)
    prof += ((rr > 1.24) & (rr < 1.53)) * 0.35          # anneau C
    prof += ((rr >= 1.53) & (rr < 1.95)) * 0.92         # anneau B
    prof += ((rr >= 2.03) & (rr < 2.27)) * 0.70         # anneau A (après la division de Cassini)
    prof *= 0.94 + 0.06 * np.sin(rr * 140) + 0.04 * np.sin(rr * 37)               # fines structures
    ringcol = np.stack([0.86 + 0 * rr, 0.78 + 0 * rr, 0.62 + 0 * rr], -1) * (0.75 + 0.25 * np.clip(-L[1] + 0.5, 0, 1))
    front = y > 0                                       # moitié avant des anneaux (devant le globe)
    behind = inside & ~front
    a = prof * np.where(behind, 0, 1)
    # ombre du globe sur les anneaux (côté opposé à la lumière)
    shadow = (x * L[0] < 0) & (np.abs(x) < 1) & (y < 0) & ~inside
    a_col = ringcol * np.where(shadow, 0.25, 1)[..., None]
    out = img.copy()
    out[..., :3] = img[..., :3] * (1 - a[..., None]) + a_col * a[..., None]
    out[..., 3] = np.maximum(img[..., 3], a)
    return out

globe("Jupiter/Jupiter.jpg", "jupiter", lon0=1.2, tilt=0.05, limb=0.35)
globe("Saturn/Saturn.jpg", "saturne", tilt=0.42, limb=0.35, rings=True)
globe("Mars/Mars.jpg", "mars", lon0=-1.4, tilt=0.25, atm=(1.0, 0.65, 0.45))
globe("Neptune/Neptune.jpg", "neptune", tilt=0.3, limb=0.4, atm=(0.5, 0.75, 1.0))
globe("Pluto/Pluto.jpg", "pluton", lon0=3.0, tilt=0.2)
globe("Pluto - Charon/Pluto - Charon.jpg", "charon", tilt=0.2)
globe("Jupiter - Io (B)/Jupiter - Io (B).jpg", "io", lon0=0.4)
globe("Saturn - Titan/Saturn - Titan.jpg", "titan", limb=0.5, atm=(1.0, 0.7, 0.35))
