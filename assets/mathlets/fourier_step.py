import numpy as np

# -----------------------------
# Fourier step function
# -----------------------------
TWOPI = 2 * np.pi
X_MIN, X_MAX = -2 * np.pi, 4 * np.pi

def f_square(x):
    t = np.mod(x, TWOPI)
    return (t > np.pi).astype(float)

def fourier_partial_sum(x, N):
    s = 0.5 * np.ones_like(x)
    for k in range(N):
        n = 2 * k + 1
        s -= (2.0 / (np.pi * n)) * np.sin(n * x)
    return s

# precompute grid & exact function (fast updates)
x_grid = np.linspace(X_MIN, X_MAX, 2000)
base_f = f_square(x_grid)

def compute_series_data(N: int):
    """
    Returns Plotly-friendly lists (x, f, S_N) for the selected N.
    """
    N = int(N)
    N = max(1, min(10, N))
    approx = fourier_partial_sum(x_grid, N)
    return x_grid.tolist(), base_f.tolist(), approx.tolist()