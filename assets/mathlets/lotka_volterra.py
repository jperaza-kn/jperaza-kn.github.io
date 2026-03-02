import numpy as np

# =====================================================
# Lotka–Volterra (predator–prey) system
#
#   x' = α x - β x y
#   y' = δ x y - γ y
#
# x(t): prey population
# y(t): predator population
#
# We integrate with a fixed-step RK4 solver (Pyodide-friendly).
# =====================================================

# Defaults (chosen for a nice closed orbit)
X0_DEFAULT = 10.0
Y0_DEFAULT = 5.0
T_MAX = 30.0
DT = 0.01

def rhs(x, y, alpha, beta, gamma, delta):
    dx = alpha * x - beta * x * y
    dy = delta * x * y - gamma * y
    return dx, dy

def rk4(alpha, beta, gamma, delta, x0=X0_DEFAULT, y0=Y0_DEFAULT, t_max=T_MAX, dt=DT):
    alpha = float(alpha); beta = float(beta); gamma = float(gamma); delta = float(delta)
    x0 = float(x0); y0 = float(y0); t_max = float(t_max); dt = float(dt)

    n = int(np.floor(t_max / dt)) + 1
    t = np.linspace(0.0, dt*(n-1), n)

    x = np.empty(n, dtype=float)
    y = np.empty(n, dtype=float)
    x[0] = max(x0, 0.0)
    y[0] = max(y0, 0.0)

    for i in range(n - 1):
        xi, yi = x[i], y[i]

        k1x, k1y = rhs(xi, yi, alpha, beta, gamma, delta)
        k2x, k2y = rhs(xi + 0.5*dt*k1x, yi + 0.5*dt*k1y, alpha, beta, gamma, delta)
        k3x, k3y = rhs(xi + 0.5*dt*k2x, yi + 0.5*dt*k2y, alpha, beta, gamma, delta)
        k4x, k4y = rhs(xi + dt*k3x, yi + dt*k3y, alpha, beta, gamma, delta)

        x_next = xi + (dt/6.0)*(k1x + 2*k2x + 2*k3x + k4x)
        y_next = yi + (dt/6.0)*(k1y + 2*k2y + 2*k3y + k4y)

        # keep non-negative (numerical guard)
        x[i+1] = max(x_next, 0.0)
        y[i+1] = max(y_next, 0.0)

    return t, x, y

def axis_range(vals, pad_frac=0.08, min_span=1.0):
    vmin = float(np.min(vals))
    vmax = float(np.max(vals))
    span = vmax - vmin
    if span < min_span:
        mid = 0.5*(vmin + vmax)
        span = min_span
        vmin = mid - 0.5*span
        vmax = mid + 0.5*span
    pad = pad_frac * span
    return (max(vmin - pad, 0.0), vmax + pad)

def compute_plot_data(alpha, beta, gamma, delta):
    """
    Returns JSON-friendly Plotly data:
      t, x, y, phase_x, phase_y, x_range, y_range, t_max

    - phase_x, phase_y are identical to x, y (trajectory in x–y plane).
    - ranges are [min,max] for axes (with padding).
    """
    t, x, y = rk4(alpha, beta, gamma, delta)

    xr = axis_range(x)
    yr = axis_range(y)

    return (
        t.tolist(),
        x.tolist(),
        y.tolist(),
        x.tolist(),
        y.tolist(),
        [float(xr[0]), float(xr[1])],
        [float(yr[0]), float(yr[1])],
        float(t[-1]),
        float(X0_DEFAULT),
        float(Y0_DEFAULT),
    )
