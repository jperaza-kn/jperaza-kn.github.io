import numpy as np

# =====================================================
# 1D Wave equation on [0, L] with fixed ends (Dirichlet)
#   u_tt = k u_xx,   u(0,t)=u(L,t)=0
#
# Sine-series eigen-expansion:
#   u(x,t) = sum_{n>=1} [ a_n cos(ω_n t) + (b_n/ω_n) sin(ω_n t) ] sin(nπx/L)
#   ω_n = c * nπ/L,  c = sqrt(k)
#
# ICs:
#   u(x,0)   = u0(x)  -> a_n = (2/L) ∫ u0 sin(nπx/L) dx
#   u_t(x,0) = v0(x)  -> b_n = (2/L) ∫ v0 sin(nπx/L) dx
#
# To get an (approximately) right-moving Gaussian pulse at speed c, we set
#   v0(x) = -c * d/dx u0(x)
# (Reflections appear due to the fixed boundaries.)
# =====================================================

L = 10.0
NX = 900
N_COEFF = 400
N_SHOW = 10

X = np.linspace(0.0, L, NX)

# Fixed axis range (matches your other mathlets)
Y_MIN, Y_MAX = -5.5, 5.5

MODE_COLORS = [
    "#e8f7e8", "#d5f0d5", "#bfe8bf", "#a6dfa6", "#89d589",
    "#6bca6b", "#4fbe4f", "#3aa63a", "#2f8a2f", "#256f25"
]

def gaussian(x, A, x0, sigma):
    return A * np.exp(-0.5 * ((x - x0) / sigma) ** 2)

def initial_data(A, x0, sigma, kappa):
    """
    Returns (u0, v0, c) for the pulse.
    """
    kappa = float(kappa)
    c = np.sqrt(max(kappa, 0.0))
    u0 = gaussian(X, float(A), float(x0), float(sigma))

    # derivative of Gaussian: d/dx u0 = u0 * (-(x-x0)/sigma^2)
    du0dx = u0 * (-(X - float(x0)) / (float(sigma) ** 2))
    v0 = -c * du0dx  # right-moving

    return u0, v0, c

def sine_matrix(nmax):
    n = np.arange(1, nmax + 1)[:, None]               # (nmax,1)
    S = np.sin(n * np.pi * X[None, :] / L)            # (nmax,NX)
    return n, S

def project_to_sines(fx, S):
    # (2/L) ∫ f(x) sin(nπx/L) dx  for all n; integrate along X
    return (2.0 / L) * np.trapz(fx * S, X, axis=1)    # (nmax,)

def reconstruct(u0, v0, t, kappa, nmax=N_COEFF):
    t = float(t)
    kappa = float(kappa)
    c = np.sqrt(max(kappa, 0.0))

    n, S = sine_matrix(nmax)
    a = project_to_sines(u0, S)                        # (nmax,)
    b = project_to_sines(v0, S)                        # (nmax,)

    omega = c * np.pi * n / L                          # (nmax,1)
    ct = np.cos(omega * t)                             # (nmax,1)
    st = np.sin(omega * t)                             # (nmax,1)

    # Σ [ a_n cos + (b_n/ω_n) sin ] sin(nπx/L)
    # omega is never zero for n>=1; safe division
    u = ((a[:, None] * ct + (b[:, None] / omega) * st) * S).sum(axis=0)
    return u, a, b, S, omega, c

def compute_plot_data(t, kappa, A, x0, sigma, show_modes):
    """
    Returns data for Plotly:
      X, u, baseline, modes, L, Y_MIN, Y_MAX, c

    modes is a list of [y_mode, color, name] for n=1..10 if enabled.
    """
    t = float(t)
    kappa = float(kappa)
    A = float(A); x0 = float(x0); sigma = float(sigma)
    show_modes = int(show_modes)

    u0, v0, c0 = initial_data(A, x0, sigma, kappa)
    u, a, b, S, omega, c = reconstruct(u0, v0, t, kappa, nmax=N_COEFF)

    baseline = np.zeros_like(X)

    modes_out = []
    if show_modes == 1:
        ct = np.cos(omega[:N_SHOW] * t)[:, 0]          # (N_SHOW,)
        st = np.sin(omega[:N_SHOW] * t)[:, 0]          # (N_SHOW,)
        for i in range(N_SHOW):
            y_mode = (a[i] * ct[i] + (b[i] / omega[i, 0]) * st[i]) * S[i]
            modes_out.append([y_mode.tolist(), MODE_COLORS[i], f"harmonic n={i+1}"])

    return (
        X.tolist(),
        u.tolist(),
        baseline.tolist(),
        modes_out,
        float(L),
        float(Y_MIN),
        float(Y_MAX),
        float(c),
    )