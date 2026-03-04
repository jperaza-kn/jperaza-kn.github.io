import numpy as np

# =========================
# Logistic equation:
#   dx/dt = r x (1 - x/K)
# with parameters:
#   r  : growth rate
#   K  : carrying capacity
# IC:
#   x(0)=x0
#
# Analytical solution:
#   x(t) = K / (1 + ((K - x0)/x0) e^{-r t})
# =========================

def logistic_solution(t, K, r, x0):
    K = float(K); r = float(r); x0 = float(x0)
    # keep x0 away from 0 to avoid division blow-ups in the closed form
    eps = 1e-12
    x0_safe = np.sign(x0) * max(abs(x0), eps)
    denom = 1.0 + ((K - x0_safe) / x0_safe) * np.exp(-r * t)
    return K / denom

def compute_plot_data(K, r, x0, T=20.0, N=1200):
    """
    Returns data for Plotly:
      t, x(t), x_phase, dxdt_phase, eq_lines, meta, yRange, pRange
    """
    K = float(K); r = float(r); x0 = float(x0)
    T = float(T); N = int(N)

    t = np.linspace(0.0, T, N)
    x = logistic_solution(t, K, r, x0)

    # phase curve: dx/dt vs x
    dxdt = r * x * (1.0 - x / K) if K != 0 else r * x

    eq = {"x0": 0.0, "xK": K, "t0": 0.0, "tT": T}
    meta = {"K": K, "r": r, "x0": x0, "T": T, "N": N}

    # y-range for time plot
    y_min = float(min(np.min(x), 0.0))
    y_max = float(max(np.max(x), K, 1.0))
    pad = 0.08 * (y_max - y_min + 1e-9)
    y_min -= pad
    y_max += pad

    # y-range for phase plot
    pmin = float(np.min(dxdt))
    pmax = float(np.max(dxdt))
    ppad = 0.08 * (pmax - pmin + 1e-9)
    pmin -= ppad
    pmax += ppad

    return (
        t.tolist(),
        x.tolist(),
        x.tolist(),
        dxdt.tolist(),
        eq,
        meta,
        (y_min, y_max),
        (pmin, pmax),
    )
