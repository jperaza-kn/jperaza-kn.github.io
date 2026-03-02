# 2d_systems_gauss.py
# Pyodide-friendly (numpy only)
# 3D linear system: Xdot = A X, with A 3x3
# Provides RK4 integration + eigenvalues formatting helpers.

import numpy as np

XYZ_RANGE = (-5.0, 5.0)

def A_matrix(a11, a12, a13, a21, a22, a23, a31, a32, a33):
    return np.array([[a11, a12, a13],
                     [a21, a22, a23],
                     [a31, a32, a33]], dtype=float)

def f_factory(a11, a12, a13, a21, a22, a23, a31, a32, a33):
    A = A_matrix(a11, a12, a13, a21, a22, a23, a31, a32, a33)
    def f(x, y, z):
        dx = A[0, 0]*x + A[0, 1]*y + A[0, 2]*z
        dy = A[1, 0]*x + A[1, 1]*y + A[1, 2]*z
        dz = A[2, 0]*x + A[2, 1]*y + A[2, 2]*z
        return dx, dy, dz
    return f

def rk4_path(a11, a12, a13, a21, a22, a23, a31, a32, a33,
             x0, y0, z0, t_end, h=0.02, clip=10.0):
    """
    RK4 integration in time t from 0 to t_end (can be negative).
    Returns (xs, ys, zs) as Python lists (Plotly-friendly).
    """
    f = f_factory(a11, a12, a13, a21, a22, a23, a31, a32, a33)

    h = abs(h) * (1.0 if t_end >= 0 else -1.0)
    x, y, z = float(x0), float(y0), float(z0)
    xs, ys, zs = [x], [y], [z]

    t = 0.0
    while (t_end - t) * h > 0:
        if abs(t_end - t) < abs(h):
            h = (t_end - t)

        dx1, dy1, dz1 = f(x, y, z)
        dx2, dy2, dz2 = f(x + 0.5*h*dx1, y + 0.5*h*dy1, z + 0.5*h*dz1)
        dx3, dy3, dz3 = f(x + 0.5*h*dx2, y + 0.5*h*dy2, z + 0.5*h*dz2)
        dx4, dy4, dz4 = f(x + h*dx3, y + h*dy3, z + h*dz3)

        x += (h/6.0) * (dx1 + 2.0*dx2 + 2.0*dx3 + dx4)
        y += (h/6.0) * (dy1 + 2.0*dy2 + 2.0*dy3 + dy4)
        z += (h/6.0) * (dz1 + 2.0*dz2 + 2.0*dz3 + dz4)
        t += h

        if (not np.isfinite(x)) or (not np.isfinite(y)) or (not np.isfinite(z)) or (np.linalg.norm([x, y, z]) > clip):
            break

        xs.append(x); ys.append(y); zs.append(z)

    return xs, ys, zs


def eigvals_formatted(a11, a12, a13, a21, a22, a23, a31, a32, a33):
    """
    Returns 3 eigenvalues of A formatted as strings for LaTeX.
    """
    A = A_matrix(a11, a12, a13, a21, a22, a23, a31, a32, a33)
    try:
        evals = np.linalg.eigvals(A)
    except np.linalg.LinAlgError:
        evals = [np.nan, np.nan, np.nan]

    def fmt_ev(l):
        if not np.isfinite(np.real(l)) or not np.isfinite(np.imag(l)):
            return r"\text{NaN}"
        if abs(np.imag(l)) < 1e-8:
            return f"{np.real(l):.3f}"
        sign = "+" if np.imag(l) >= 0 else "-"
        return f"{np.real(l):.3f} {sign} {abs(np.imag(l)):.3f} i"

    return [fmt_ev(l) for l in evals]