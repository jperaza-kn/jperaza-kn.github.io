import numpy as np

# ============================================
# Van der Pol oscillator
#   x'' - μ(1-x^2)x' + x = 0
# Convert to first-order system:
#   x' = y
#   y' = μ(1-x^2)y - x
# ============================================

YMIN, YMAX = -4.5, 4.5

def f(mu, x, y):
    dx = y
    dy = mu*(1.0 - x*x)*y - x
    return dx, dy

def rk4_step(mu, x, y, dt):
    k1x, k1y = f(mu, x, y)
    k2x, k2y = f(mu, x + 0.5*dt*k1x, y + 0.5*dt*k1y)
    k3x, k3y = f(mu, x + 0.5*dt*k2x, y + 0.5*dt*k2y)
    k4x, k4y = f(mu, x + dt*k3x, y + dt*k3y)
    xn = x + (dt/6.0)*(k1x + 2*k2x + 2*k3x + k4x)
    yn = y + (dt/6.0)*(k1y + 2*k2y + 2*k3y + k4y)
    return xn, yn

def simulate(mu, x0, y0, T=30.0, dt=0.01):
    mu = float(mu)
    x = float(x0)
    y = float(y0)
    n = int(np.floor(T/dt)) + 1
    t = np.linspace(0.0, n*dt, n)
    xs = np.empty(n, dtype=float)
    ys = np.empty(n, dtype=float)
    xs[0] = x
    ys[0] = y
    for i in range(1, n):
        x, y = rk4_step(mu, x, y, dt)
        xs[i] = x
        ys[i] = y
    return t, xs, ys

def compute_plot_data(mu, x0, y0):
    """
    Returns:
      refs: list of dicts {x:[], y:[], name:str}
      main: dict {t:[], x:[], y:[]}
      ranges: {xmin,xmax,ymin,ymax}
    """
    mu = float(mu)

    # main trajectory
    t, xs, ys = simulate(mu, x0, y0, T=30.0, dt=0.01)

    # reference trajectories (fixed ICs)
    ref_ics = [
        (2.0, 0.0),
        (0.0, 2.0),
        (-2.0, 0.0),
        (0.0, -2.0),
        (1.5, 1.5),
        (-1.5, -1.5),
    ]
    refs = []
    for (rx0, ry0) in ref_ics:
        _, rxs, rys = simulate(mu, rx0, ry0, T=30.0, dt=0.01)
        refs.append({"x": rxs.tolist(), "y": rys.tolist(), "name": f"ref ({rx0:g},{ry0:g})"})

    # ranges
    allx = np.concatenate([xs] + [np.array(r["x"]) for r in refs])
    ally = np.concatenate([ys] + [np.array(r["y"]) for r in refs])
    pad = 0.35
    xmin, xmax = float(allx.min()-pad), float(allx.max()+pad)
    ymin, ymax = float(ally.min()-pad), float(ally.max()+pad)

    return (
        refs,
        {"t": t.tolist(), "x": xs.tolist(), "y": ys.tolist()},
        {"xmin": xmin, "xmax": xmax, "ymin": ymin, "ymax": ymax},
        float(YMIN), float(YMAX)
    )
