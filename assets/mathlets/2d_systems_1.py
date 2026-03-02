import numpy as np

# Ranges
XRANGE = (-5.0, 5.0)
YRANGE = (-5.0, 5.0)

# ---------- Linear system X' = A X ----------
def make_f(a11, a12, a21, a22):
    def f(x, y):
        dx = a11 * x + a12 * y
        dy = a21 * x + a22 * y
        return dx, dy
    return f

# ---------- RK4 integrator for a single seed ----------
def rk4_path(f, x0, y0, t_end, h=0.03, clip=10.0):
    if t_end == 0:
        return np.array([x0]), np.array([y0])
    h = abs(h) * (1.0 if t_end > 0 else -1.0)
    n_steps = int(abs(t_end) / abs(h))
    x, y = float(x0), float(y0)
    xs, ys = [x], [y]
    for _ in range(n_steps):
        dx1, dy1 = f(x, y)
        dx2, dy2 = f(x + 0.5*h*dx1, y + 0.5*h*dy1)
        dx3, dy3 = f(x + 0.5*h*dx2, y + 0.5*h*dy2)
        dx4, dy4 = f(x + h*dx3, y + h*dy3)
        x += (h/6.0) * (dx1 + 2*dx2 + 2*dx3 + dx4)
        y += (h/6.0) * (dy1 + 2*dy2 + 2*dy3 + dy4)
        if (not np.isfinite(x)) or (not np.isfinite(y)) or abs(x) > clip or abs(y) > clip:
            break
        xs.append(x); ys.append(y)
    return np.array(xs), np.array(ys)

# ---------- Integer lattice seeds ----------
def lattice_points(radius, xrange=XRANGE, yrange=YRANGE):
    xs, ys = [], []
    r = int(radius)
    for i in range(-r, r + 1):
        for j in range(-r, r + 1):
            if xrange[0] <= i <= xrange[1] and yrange[0] <= j <= yrange[1]:
                xs.append(i); ys.append(j)
    return np.array(xs, dtype=float), np.array(ys, dtype=float)

# ---------- Arrow segments at a point in direction f(x0,y0) ----------
def arrow_segments(f, x0, y0, length=0.5, head=0.18):
    dx, dy = f(x0, y0)
    n = float(np.hypot(dx, dy))
    if n < 1e-9:
        return None
    ux, uy = dx/n, dy/n
    x1, y1 = x0 + length*ux, y0 + length*uy

    # Perp
    px, py = -uy, ux
    h_base_x = x1 - 0.55*head*ux
    h_base_y = y1 - 0.55*head*uy

    # Shaft, left, right
    segs = [
        (x0, y0, x1, y1),
        (x1, y1, h_base_x + 0.5*head*px, h_base_y + 0.5*head*py),
        (x1, y1, h_base_x - 0.5*head*px, h_base_y - 0.5*head*py),
    ]
    return segs

# ---------- Classification markdown ----------
def _lam_str(z, lang="es"):
    if abs(z.imag) < 1e-12:
        return f"{z.real:.4g}"
    sgn = "+" if z.imag >= 0 else "-"
    return f"{z.real:.4g} {sgn} {abs(z.imag):.4g}\\,\\mathrm{{i}}"

def classify_md_es(a11, a12, a21, a22):
    A = np.array([[a11, a12], [a21, a22]], dtype=float)
    tr = float(np.trace(A))
    det = float(np.linalg.det(A))
    disc = tr**2 - 4*det
    ev = np.linalg.eigvals(A)

    if det < 0:
        typ = "Silla (autovalores reales de signo opuesto)"
    elif det > 0 and disc > 1e-12 and tr < 0:
        typ = "Nodo estable (reales, negativos)"
    elif det > 0 and disc > 1e-12 and tr > 0:
        typ = "Nodo inestable (reales, positivos)"
    elif det > 0 and abs(disc) <= 1e-12 and tr < 0:
        typ = "Nodo degenerado estable (reales e iguales, < 0)"
    elif det > 0 and abs(disc) <= 1e-12 and tr > 0:
        typ = "Nodo degenerado inestable (reales e iguales, > 0)"
    elif det > 0 and disc < -1e-12 and abs(tr) > 1e-12:
        typ = "Foco/Espiral (complejos conjugados, parte real ≠ 0)"
    elif det > 0 and disc < -1e-12 and abs(tr) <= 1e-12:
        typ = "Centro (autovalores puramente imaginarios)"
    elif abs(det) <= 1e-12 and abs(tr) > 1e-12:
        typ = "Semiplano (un autovalor 0, otro ≠ 0)"
    elif abs(det) <= 1e-12 and abs(tr) <= 1e-12:
        typ = "Nilpotente / caso especial (ambos autovalores 0)"
    else:
        typ = "Caso no clasificado"

    rp = np.real(ev)
    if np.all(rp < -1e-12):
        stab = "estable (atractor)"
    elif np.all(rp > 1e-12):
        stab = "inestable (repulsor)"
    elif np.any(np.abs(rp) <= 1e-12):
        stab = "marginal/indeterminada (alguna parte real ≈ 0)"
    else:
        stab = "mixta (signos opuestos en partes reales)"

    lam_tex = ",\\; ".join(_lam_str(z, "es") for z in ev)

    return rf"""
<h2>Clasificación por traza y determinante</h2>

\[
A=\begin{{pmatrix}}
{a11:.3g} & {a12:.3g}\\
{a21:.3g} & {a22:.3g}
\end{{pmatrix}},
\]
\[
\mathrm{{tr}}\,A={tr:.4g},\quad
\det A={det:.4g},\]
\[
\Delta=\mathrm{{tr}}(A)^2-4\det A={disc:.4g}.
\]

<p><strong>Autovalores:</strong></p>
\[
\lambda_1,\lambda_2 = {lam_tex}.
\]

<p><strong>Tipo:</strong> \({typ}\).<br/>
<strong>Estabilidad:</strong> {stab}.</p>

<hr style="border:0;border-top:1px solid rgba(31,42,58,.7); margin: 16px 0;" />

<p><strong>Guía rápida</strong></p>
<ul>
  <li>\(\det A<0\): silla.</li>
  <li>\(\det A>0,\ \Delta>0\): nodo (estable si \(\mathrm{{tr}}A<0\)).</li>
  <li>\(\det A>0,\ \Delta<0\): foco/espiral (estable si \(\Re\lambda<0\)).</li>
  <li>\(\det A>0,\ \Delta=0\): nodo degenerado.</li>
  <li>\(\mathrm{{tr}}A=0,\ \det A>0,\ \Delta<0\): centro.</li>
</ul>
"""

def classify_md_en(a11, a12, a21, a22):
    A = np.array([[a11, a12], [a21, a22]], dtype=float)
    tr = float(np.trace(A))
    det = float(np.linalg.det(A))
    disc = tr**2 - 4*det
    ev = np.linalg.eigvals(A)

    if det < 0:
        typ = "Saddle (real eigenvalues with opposite signs)"
    elif det > 0 and disc > 1e-12 and tr < 0:
        typ = "Stable node (real, negative)"
    elif det > 0 and disc > 1e-12 and tr > 0:
        typ = "Unstable node (real, positive)"
    elif det > 0 and abs(disc) <= 1e-12 and tr < 0:
        typ = "Degenerate stable node (repeated real, < 0)"
    elif det > 0 and abs(disc) <= 1e-12 and tr > 0:
        typ = "Degenerate unstable node (repeated real, > 0)"
    elif det > 0 and disc < -1e-12 and abs(tr) > 1e-12:
        typ = "Spiral/focus (complex conjugates, nonzero real part)"
    elif det > 0 and disc < -1e-12 and abs(tr) <= 1e-12:
        typ = "Center (purely imaginary eigenvalues)"
    elif abs(det) <= 1e-12 and abs(tr) > 1e-12:
        typ = "Line of equilibria (one eigenvalue 0, the other ≠ 0)"
    elif abs(det) <= 1e-12 and abs(tr) <= 1e-12:
        typ = "Nilpotent / special case (both eigenvalues 0)"
    else:
        typ = "Unclassified case"

    rp = np.real(ev)
    if np.all(rp < -1e-12):
        stab = "stable (attractor)"
    elif np.all(rp > 1e-12):
        stab = "unstable (repulsor)"
    elif np.any(np.abs(rp) <= 1e-12):
        stab = "marginal/indeterminate (some real part ≈ 0)"
    else:
        stab = "mixed (opposite signs in real parts)"

    lam_tex = ",\\; ".join(_lam_str(z, "en") for z in ev)

    return rf"""
<h2>Classification via trace and determinant</h2>

\[
A=\begin{{pmatrix}}
{a11:.3g} & {a12:.3g}\\
{a21:.3g} & {a22:.3g}
\end{{pmatrix}},
\]
\[
\mathrm{{tr}}\,A={tr:.4g},\quad
\det A={det:.4g},\]
\[
\Delta=\mathrm{{tr}}(A)^2-4\det A={disc:.4g}.
\]
<p><strong>Eigenvalues:</strong></p>
\[
\lambda_1,\lambda_2 = {lam_tex}.
\]

<p><strong>Type:</strong> \({typ}\).<br/>
<strong>Stability:</strong> {stab}.</p>

<hr style="border:0;border-top:1px solid rgba(31,42,58,.7); margin: 16px 0;" />

<p><strong>Quick guide</strong></p>
<ul>
  <li>\(\det A<0\): saddle.</li>
  <li>\(\det A>0,\ \Delta>0\): node (stable if \(\mathrm{{tr}}A<0\)).</li>
  <li>\(\det A>0,\ \Delta<0\): spiral/focus (stable if \(\Re\lambda<0\)).</li>
  <li>\(\det A>0,\ \Delta=0\): degenerate node.</li>
  <li>\(\mathrm{{tr}}A=0,\ \det A>0,\ \Delta<0\): center.</li>
</ul>
"""

# ---------- Build Plotly traces as plain dicts ----------
def _scatter_line(x, y, color="rgba(70,160,255,0.75)", width=1.6):
    return {
        "type": "scatter",
        "mode": "lines",
        "x": x,
        "y": y,
        "line": {"color": color, "width": width},
        "hoverinfo": "skip",
        "showlegend": False
    }

def _scatter_markers(x, y, size=4, color="rgba(0,0,0,0.35)"):
    return {
        "type": "scatter",
        "mode": "markers",
        "x": x,
        "y": y,
        "marker": {"size": size, "color": color},
        "showlegend": False,
    }

def compute_plot_and_md(a11, a12, a21, a22, R, T):
    a11 = float(a11); a12 = float(a12); a21 = float(a21); a22 = float(a22)
    R = int(R)
    T = float(T)

    f = make_f(a11, a12, a21, a22)

    ix, iy = lattice_points(R, XRANGE, YRANGE)

    traces = []

    # axes lines
    traces.append({
        "type": "scatter",
        "mode": "lines",
        "x": [XRANGE[0], XRANGE[1]],
        "y": [0, 0],
        "line": {"color": "#888", "width": 1},
        "showlegend": False,
        "hoverinfo": "skip"
    })
    traces.append({
        "type": "scatter",
        "mode": "lines",
        "x": [0, 0],
        "y": [YRANGE[0], YRANGE[1]],
        "line": {"color": "#888", "width": 1},
        "showlegend": False,
        "hoverinfo": "skip"
    })

    clip = max(XRANGE[1], YRANGE[1]) + 1

    # trajectories + initial points
    for (x0, y0) in zip(ix, iy):
        xf, yf = rk4_path(f, x0, y0,  T, h=0.03, clip=clip)
        xb, yb = rk4_path(f, x0, y0, -T, h=0.03, clip=clip)
        xx = np.concatenate([xb[::-1], xf[1:]])
        yy = np.concatenate([yb[::-1], yf[1:]])

        traces.append(_scatter_line(xx.tolist(), yy.tolist(),
                                   color="rgba(70,160,255,0.75)", width=1.6))
        traces.append(_scatter_markers([float(x0)], [float(y0)],
                                       size=4, color="rgba(0,0,0,0.35)"))

    # arrows at each lattice point
    # represent each arrow as 3 short line traces (shaft + 2 head segments)
    for (x0, y0) in zip(ix, iy):
        segs = arrow_segments(f, float(x0), float(y0), length=0.5, head=0.18)
        if segs is None:
            continue
        for (xa, ya, xb2, yb2) in segs:
            traces.append(_scatter_line([xa, xb2], [ya, yb2],
                                        color="rgba(70,160,255,0.85)", width=1.8))

    md_es = classify_md_es(a11, a12, a21, a22)
    md_en = classify_md_en(a11, a12, a21, a22)

    return traces, md_es, md_en, [XRANGE[0], XRANGE[1]], [YRANGE[0], YRANGE[1]]