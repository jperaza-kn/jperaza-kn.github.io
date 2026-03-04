
import numpy as np

# ============================================================
# Eikonal / Snell's law demo (two-media refraction)
#
# Geometry:
#   Source S = (0, 1)   (medium 1: y>0)
#   Target T = (2,-1)   (medium 2: y<0)
#   Interface: y = 0
#
# Refractive indices (or "slowness") n1, n2 > 0
# Travel time functional (c=1 units):
#   Tau(x) = n1 * |S-P| + n2 * |P-T|,  P=(x,0)
# Minimizer satisfies Snell law:
#   n1 sin(theta1) = n2 sin(theta2)
# where theta_i is the angle to the interface normal.
# ============================================================

S = np.array([0.0,  1.0])
T = np.array([2.0, -1.0])

X_MIN, X_MAX = -0.5, 2.5
Y_MIN, Y_MAX = -1.5, 1.5

def _tau_and_deriv(x, n1, n2):
    x = float(x)
    n1 = float(n1); n2 = float(n2)
    d1 = np.sqrt((x - S[0])**2 + (0.0 - S[1])**2)   # sqrt(x^2 + 1)
    d2 = np.sqrt((T[0] - x)**2 + (T[1] - 0.0)**2)   # sqrt((2-x)^2 + 1)

    tau = n1 * d1 + n2 * d2
    # derivative wrt x: n1*(x)/d1 + n2*(x-2)/d2
    f = n1 * (x - S[0]) / d1 + n2 * (x - T[0]) / d2
    return tau, f, d1, d2

def _find_minimizer(n1, n2):
    """
    Find x* minimizing Tau(x) using a robust bracket + bisection on Tau'(x)=0.
    """
    n1 = float(n1); n2 = float(n2)

    def f(x):
        return _tau_and_deriv(x, n1, n2)[1]

    # Bracket search
    a, b = -10.0, 12.0
    fa, fb = f(a), f(b)

    # Expand if needed (rare)
    k = 0
    while fa * fb > 0 and k < 10:
        a -= 10.0
        b += 10.0
        fa, fb = f(a), f(b)
        k += 1

    if fa * fb > 0:
        # Fallback: minimize by sampling (shouldn't happen for this setup)
        xs = np.linspace(-10, 12, 2001)
        taus = np.array([_tau_and_deriv(x, n1, n2)[0] for x in xs])
        return float(xs[np.argmin(taus)])

    # Bisection
    for _ in range(80):
        m = 0.5 * (a + b)
        fm = f(m)
        if fa * fm <= 0:
            b, fb = m, fm
        else:
            a, fa = m, fm
    return float(0.5 * (a + b))

def _angles_and_snell(x_star, n1, n2):
    """
    Return theta1, theta2 (angles to normal), and Snell residual.
    Normal is along +y axis.
    """
    P = np.array([x_star, 0.0])
    v1 = P - S
    v2 = T - P

    # angle to normal: sin(theta) = |horizontal component| / |segment|
    d1 = np.linalg.norm(v1)
    d2 = np.linalg.norm(v2)
    sin1 = abs(v1[0]) / d1
    sin2 = abs(v2[0]) / d2

    # guard (numerics)
    sin1 = min(1.0, max(0.0, float(sin1)))
    sin2 = min(1.0, max(0.0, float(sin2)))

    theta1 = float(np.arcsin(sin1))
    theta2 = float(np.arcsin(sin2))

    residual = float(n1 * sin1 - n2 * sin2)
    return theta1, theta2, residual, float(sin1), float(sin2)

def _piecewise_param(S, P, T, n1, n2, t_emit, npts=400):
    """
    Build arrays (t, x(t), y(t)) along the broken ray with correct speeds:
      speed in medium i = 1 / n_i  (c=1)
      time in medium i = n_i * distance_i
    """
    S = np.array(S, dtype=float)
    P = np.array(P, dtype=float)
    T = np.array(T, dtype=float)

    d1 = float(np.linalg.norm(P - S))
    d2 = float(np.linalg.norm(T - P))

    t1 = float(t_emit) + n1 * d1
    t2 = t1 + n2 * d2

    # allocate points proportionally
    n1p = max(2, int(npts * (n1*d1) / max(1e-9, (n1*d1 + n2*d2))))
    n2p = max(2, npts - n1p + 1)

    # segment 1
    s1 = np.linspace(0.0, 1.0, n1p)
    x1 = (1 - s1) * S[0] + s1 * P[0]
    y1 = (1 - s1) * S[1] + s1 * P[1]
    t_seg1 = float(t_emit) + s1 * (n1 * d1)

    # segment 2
    s2 = np.linspace(0.0, 1.0, n2p)
    x2 = (1 - s2) * P[0] + s2 * T[0]
    y2 = (1 - s2) * P[1] + s2 * T[1]
    t_seg2 = t1 + s2 * (n2 * d2)

    t = np.concatenate([t_seg1, t_seg2[1:]])
    x = np.concatenate([x1, x2[1:]])
    y = np.concatenate([y1, y2[1:]])
    return t, x, y, t1, t2, d1, d2

def compute_plot_data(n1, n2, t_emit):
    """
    Returns everything needed by JS/Plotly.

    Output tuple:
      Xray, Yray,
      Xtau, Ttau, x_star, tau_star,
      t, xt, yt,
      meta dict:
        {theta1, theta2, sin1, sin2, snell_residual, t_interface, t_arrive,
         d1, d2, n1, n2}
      axis bounds: X_MIN, X_MAX, Y_MIN, Y_MAX
    """
    n1 = max(1e-6, float(n1))
    n2 = max(1e-6, float(n2))
    t_emit = float(t_emit)

    x_star = _find_minimizer(n1, n2)
    P = np.array([x_star, 0.0])

    tau_star, _, d1, d2 = _tau_and_deriv(x_star, n1, n2)
    theta1, theta2, resid, sin1, sin2 = _angles_and_snell(x_star, n1, n2)

    # Ray path coordinates
    Xray = [float(S[0]), float(P[0]), float(T[0])]
    Yray = [float(S[1]), float(P[1]), float(T[1])]

    # Travel-time function for diagnostics plot
    xs = np.linspace(-1.0, 3.0, 600)
    taus = np.array([_tau_and_deriv(x, n1, n2)[0] for x in xs])

    # Time-parametrized trajectory
    t, xt, yt, t_interface, t_arrive, d1, d2 = _piecewise_param(S, P, T, n1, n2, t_emit, npts=420)

    meta = {
        "theta1": float(theta1),
        "theta2": float(theta2),
        "sin1": float(sin1),
        "sin2": float(sin2),
        "snell_residual": float(resid),
        "t_interface": float(t_interface),
        "t_arrive": float(t_arrive),
        "d1": float(d1),
        "d2": float(d2),
        "n1": float(n1),
        "n2": float(n2),
        "tau_star": float(tau_star),
        "x_star": float(x_star),
        "t_emit": float(t_emit),
    }

    return (
        Xray, Yray,
        xs.tolist(), taus.tolist(), float(x_star), float(tau_star),
        t.tolist(), xt.tolist(), yt.tolist(),
        meta,
        float(X_MIN), float(X_MAX), float(Y_MIN), float(Y_MAX)
    )
