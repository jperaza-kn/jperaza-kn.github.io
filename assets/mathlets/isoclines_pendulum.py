# pendulum.py
# Pyodide-friendly (numpy only): phase portrait for the damped pendulum
#   θ̇ = ω
#   ω̇ = -a sin(θ) - b ω
#
# This file is meant to be loaded by your pyodide-base.js + loadPythonFile(...)
# and called from your pendulum.js.

import numpy as np

# Default plot ranges (match your Dash version)
TH_RANGE = (-2.0 * np.pi, 2.0 * np.pi)
OM_RANGE = (-5.0, 5.0)

def f_factory(a: float, b: float):
    """
    Returns the vector field f(θ, ω) = (dθ, dω).
    Works with scalars or numpy arrays.
    """
    def f(theta, omega):
        dtheta = omega
        domega = -a * np.sin(theta) - b * omega
        return dtheta, domega
    return f

def slope_field(
    a: float,
    b: float,
    th_range=TH_RANGE,
    om_range=OM_RANGE,
    n: int = 20,
    scale: float = 0.5,
    eps: float = 1e-12
):
    """
    Normalized direction field drawn as short line segments.
    Returns (xs, ys) as Python lists with NaN separators (Plotly-friendly).
    """
    f = f_factory(a, b)

    th = np.linspace(th_range[0], th_range[1], n)
    om = np.linspace(om_range[0], om_range[1], n)
    TH, OM = np.meshgrid(th, om)

    DTH, DOM = f(TH, OM)
    norm = np.sqrt(DTH**2 + DOM**2)

    # Avoid division by zero
    norm = np.where(norm < eps, 1.0, norm)
    DTHn = DTH / norm
    DOMn = DOM / norm

    x0 = TH - 0.5 * scale * DTHn
    x1 = TH + 0.5 * scale * DTHn
    y0 = OM - 0.5 * scale * DOMn
    y1 = OM + 0.5 * scale * DOMn

    xs = np.stack([x0, x1, np.full_like(x0, np.nan)], axis=-1).ravel()
    ys = np.stack([y0, y1, np.full_like(y0, np.nan)], axis=-1).ravel()

    return xs.tolist(), ys.tolist()

def rk4_path(
    a: float,
    b: float,
    th0: float,
    om0: float,
    t_end: float,
    h: float = 0.02,
    clip: float = 6.0
):
    """
    RK4 integration in time t from 0 to t_end (can be negative).
    Returns (ths, oms) as Python lists.

    clip: stops integration if |ω| exceeds clip or ω becomes non-finite.
    """
    f = f_factory(a, b)

    h = abs(h) * (1.0 if t_end >= 0 else -1.0)
    theta, omega = float(th0), float(om0)
    ths, oms = [theta], [omega]

    t = 0.0
    while (t_end - t) * h > 0:
        if abs(t_end - t) < abs(h):
            h = (t_end - t)

        dth1, dom1 = f(theta, omega)
        dth2, dom2 = f(theta + 0.5*h*dth1, omega + 0.5*h*dom1)
        dth3, dom3 = f(theta + 0.5*h*dth2, omega + 0.5*h*dom2)
        dth4, dom4 = f(theta + h*dth3, omega + h*dom3)

        theta += (h/6.0) * (dth1 + 2.0*dth2 + 2.0*dth3 + dth4)
        omega += (h/6.0) * (dom1 + 2.0*dom2 + 2.0*dom3 + dom4)
        t += h

        if (not np.isfinite(omega)) or abs(omega) > clip:
            break

        ths.append(theta)
        oms.append(omega)

    return ths, oms