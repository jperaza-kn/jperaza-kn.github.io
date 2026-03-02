import numpy as np

# =====================================================
# Lotka–Volterra (Predator–Prey) system
#
#   x' = α x - β x y
#   y' = δ x y - γ y
#
# A conserved quantity (first integral) is:
#   C(x,y) = δ x - γ ln(x) + β y - α ln(y)
# (for x>0, y>0). Along exact solutions, C is constant.
# =====================================================

def _rk4_step(f, t, z, h, params):
    k1 = f(t, z, params)
    k2 = f(t + 0.5*h, z + 0.5*h*k1, params)
    k3 = f(t + 0.5*h, z + 0.5*h*k2, params)
    k4 = f(t + h, z + h*k3, params)
    return z + (h/6.0)*(k1 + 2*k2 + 2*k3 + k4)

def _lv_rhs(t, z, p):
    x, y = z
    a, b, g, d = p["alpha"], p["beta"], p["gamma"], p["delta"]
    dx = a*x - b*x*y
    dy = d*x*y - g*y
    return np.array([dx, dy], dtype=float)

def conserved_charge(x, y, alpha, beta, gamma, delta):
    # guard against non-positive values (log domain)
    x = max(float(x), 1e-12)
    y = max(float(y), 1e-12)
    alpha = float(alpha); beta = float(beta); gamma = float(gamma); delta = float(delta)
    return delta*x - gamma*np.log(x) + beta*y - alpha*np.log(y)

def simulate(alpha, beta, gamma, delta, x0, y0, tmax=30.0, nsteps=1200):
    alpha = float(alpha); beta = float(beta); gamma = float(gamma); delta = float(delta)
    x0 = float(x0); y0 = float(y0)

    tmax = float(tmax); nsteps = int(nsteps)
    if nsteps < 10:
        nsteps = 10
    h = tmax/(nsteps-1)

    p = {"alpha": alpha, "beta": beta, "gamma": gamma, "delta": delta}
    t = np.linspace(0.0, tmax, nsteps)

    z = np.zeros((nsteps, 2), dtype=float)
    z[0, :] = [max(x0, 1e-12), max(y0, 1e-12)]

    for i in range(nsteps-1):
        z[i+1, :] = _rk4_step(_lv_rhs, t[i], z[i, :], h, p)
        # numerical guard (keep positive)
        z[i+1, 0] = max(z[i+1, 0], 1e-12)
        z[i+1, 1] = max(z[i+1, 1], 1e-12)

    x = z[:, 0]
    y = z[:, 1]

    C0 = conserved_charge(x[0], y[0], alpha, beta, gamma, delta)
    C = np.array([conserved_charge(xi, yi, alpha, beta, gamma, delta) for xi, yi in zip(x, y)])
    drift = float(np.max(np.abs(C - C0)))

    return t, x, y, C0, drift

def compute_plot_data(alpha, beta, gamma, delta, x0, y0):
    """
    Returns:
      t, x(t), y(t), phase_x, phase_y, C0, drift,
      x_range, y_range
    """
    t, x, y, C0, drift = simulate(alpha, beta, gamma, delta, x0, y0, tmax=30.0, nsteps=1200)

    # ranges with padding
    x_min, x_max = float(np.min(x)), float(np.max(x))
    y_min, y_max = float(np.min(y)), float(np.max(y))

    def pad(lo, hi):
        if hi <= lo:
            return lo - 1.0, hi + 1.0
        span = hi - lo
        return lo - 0.08*span, hi + 0.08*span

    xr0, xr1 = pad(x_min, x_max)
    yr0, yr1 = pad(y_min, y_max)

    return (
        t.tolist(),
        x.tolist(),
        y.tolist(),
        x.tolist(),
        y.tolist(),
        float(C0),
        float(drift),
        float(xr0), float(xr1),
        float(yr0), float(yr1),
    )
