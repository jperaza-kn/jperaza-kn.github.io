import numpy as np

# Parameters (match your Dash defaults)
Lx = 5.0
Lp = 5.0
NX, NP = 220, 220

k = 1.0
m = 1.0

def trajectory(t_arr, x0, p0, alpha):
    """
    Damped oscillator with beta = alpha/2.
    Returns x(t), p(t).
    """
    w0 = np.sqrt(k / m)
    beta = 0.5 * alpha
    v0 = p0 / m

    if beta < w0:  # underdamped
        wd = np.sqrt(max(w0*w0 - beta*beta, 0.0))
        A = x0
        B = (v0 + beta * x0) / wd if wd > 1e-12 else 0.0
        e = np.exp(-beta * t_arr)
        x = e * (A * np.cos(wd * t_arr) + B * np.sin(wd * t_arr))
        xdot = e * (-beta * (A*np.cos(wd*t_arr) + B*np.sin(wd*t_arr))
                    + (-A*wd*np.sin(wd*t_arr) + B*wd*np.cos(wd*t_arr)))

    elif np.isclose(beta, w0):
        e = np.exp(-beta * t_arr)
        x = e * (x0 + (v0 + beta * x0) * t_arr)
        xdot = e * (v0 + beta*x0 - beta*(x0 + (v0 + beta*x0)*t_arr))

    else:  # overdamped
        r1 = -beta + np.sqrt(beta*beta - w0*w0)
        r2 = -beta - np.sqrt(beta*beta - w0*w0)
        C2 = (v0 - r1 * x0) / (r2 - r1) if abs(r2 - r1) > 1e-12 else 0.0
        C1 = x0 - C2
        x = C1 * np.exp(r1 * t_arr) + C2 * np.exp(r2 * t_arr)
        xdot = C1 * r1 * np.exp(r1 * t_arr) + C2 * r2 * np.exp(r2 * t_arr)

    p = m * xdot
    return x, p

def H0(x, p):
    return 0.5 * k * x**2 + 0.5 * (p**2) / m

# Precompute energy contours grid (independent of alpha, t)
_x_grid = np.linspace(-Lx, Lx, NX)
_p_grid = np.linspace(-Lp, Lp, NP)
_X, _P = np.meshgrid(_x_grid, _p_grid)
_H = H0(_X, _P)

def compute_fig_data(x0: float, p0: float, alpha: float, t_cur: float):
    """
    Returns a dict with Plotly-friendly lists for:
      - energy contours grid
      - phase trajectory up to t_cur
      - x(t) curve on [0,10] + marker at t_cur
      - arrow annotation data for phase trajectory tip direction
    """
    x0 = float(x0); p0 = float(p0); alpha = float(alpha); t_cur = float(t_cur)
    t_cur = max(0.0, min(10.0, t_cur))

    # Phase trajectory on [0, t_cur]
    # Similar density rule as Dash: scale with t_cur, cap to >=2 points
    n_pts = max(2, int(800 * max(t_cur, 1e-6) / 10.0))
    s_arr = np.linspace(0.0, t_cur, n_pts)
    xs, ps = trajectory(s_arr, x0, p0, alpha)

    # x(t) on [0,10]
    T_long = np.linspace(0.0, 10.0, 1000)
    x_long, _p_long = trajectory(T_long, x0, p0, alpha)
    x_now = float(np.interp(t_cur, T_long, x_long))

    # Direction arrow near tip (compute a small step direction)
    arrow = None
    if len(xs) >= 2:
        i_tip = -1
        i_tail = -2
        dx = float(xs[i_tip] - xs[i_tail])
        dy = float(ps[i_tip] - ps[i_tail])
        scale = 10.0
        arrow = {
            "x": float(xs[i_tip] + scale * dx),
            "y": float(ps[i_tip] + scale * dy),
            "ax": float(xs[i_tip]),
            "ay": float(ps[i_tip]),
        }

    return {
        "x_grid": _x_grid.tolist(),
        "p_grid": _p_grid.tolist(),
        "H": _H.tolist(),
        "xs": xs.tolist(),
        "ps": ps.tolist(),
        "T_long": T_long.tolist(),
        "x_long": x_long.tolist(),
        "t_cur": t_cur,
        "x_now": x_now,
        "x0": x0,
        "p0": p0,
        "arrow": arrow
    }