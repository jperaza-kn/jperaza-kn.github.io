import numpy as np

# =====================================================
# Heat equation on [0, L] with Dirichlet boundary values
#   u_t = k u_xx,   u(0,t)=U0,  u(L,t)=UL
# u = u_s + v, with u_s(x) = U0 + (UL-U0) x/L
# v has homogeneous Dirichlet BC and sine-series solution.
# =====================================================

L = 10.0
NX = 800
N_COEFF = 200
N_SHOW = 5

X = np.linspace(0.0, L, NX)

# fixed y-scale
Y_MIN, Y_MAX = -5.5, 5.5

MODE_COLORS = ["#d2f8d2", "#9ee9a1", "#66d36e", "#2fb94a", "#128c2b"]

def steady_state(X, U0, UL):
    return U0 + (UL - U0) * (X / L)

def u0_uniform(X, C):
    return C * np.ones_like(X)

def u0_gaussian(X, A, x0, sigma):
    return A * np.exp(-0.5 * ((X - x0) / sigma) ** 2)

def u0_linear(X, U0, UL):
    return steady_state(X, U0, UL)

def fourier_coeffs(gx, nmax):
    # S shape: (nmax, NX)
    S = np.sin(np.outer(np.arange(1, nmax + 1), np.pi * X / L))
    bn = (2.0 / L) * np.trapz(gx * S, X, axis=1)
    return bn

def solution_profile(t, k, U0, UL, ic_kind, C, A, x0, sigma, n_coeff=N_COEFF):
    if ic_kind == "uniform":
        u0 = u0_uniform(X, C)
    elif ic_kind == "gaussian":
        u0 = u0_gaussian(X, A, x0, sigma)
    elif ic_kind == "linear":
        u0 = u0_linear(X, U0, UL)
    else:
        u0 = u0_uniform(X, 0.0)

    us = steady_state(X, U0, UL)
    gx = u0 - us
    bn = fourier_coeffs(gx, n_coeff)

    n = np.arange(1, n_coeff + 1)[:, None]              # (n_coeff, 1)
    lam = (np.pi * n / L) ** 2                          # (n_coeff, 1)
    decay = np.exp(-k * lam * t)                        # (n_coeff, 1)
    S = np.sin(n * np.pi * X[None, :] / L)              # (n_coeff, NX)
    v = (bn[:, None] * decay * S).sum(axis=0)           # (NX,)

    return (us + v), us, bn

def compute_plot_data(ic_kind, show_modes, t, U0, UL, kappa, C, A, x0, sigma):
    """
    Returns data for Plotly:
      X, u, us, modes, L, Y_MIN, Y_MAX

    modes is a list of [y_mode, color, name] for n=1..5 if enabled.
    """
    t = float(t)
    U0 = float(U0); UL = float(UL)
    kappa = float(kappa)
    C = float(C); A = float(A)
    x0 = float(x0); sigma = float(sigma)

    u, us, bn = solution_profile(t, kappa, U0, UL, ic_kind, C, A, x0, sigma, n_coeff=N_COEFF)

    modes_out = []
    if int(show_modes) == 1:
        n = np.arange(1, N_SHOW + 1)
        lam = (np.pi * n / L) ** 2
        decay = np.exp(-kappa * lam * t)
        for i in range(N_SHOW):
            y_mode = us + bn[i] * decay[i] * np.sin((i + 1) * np.pi * X / L)
            modes_out.append([y_mode.tolist(), MODE_COLORS[i], f"mode n={i+1}"])

    return X.tolist(), u.tolist(), us.tolist(), modes_out, float(L), float(Y_MIN), float(Y_MAX)