import numpy as np

TWOPI = 2 * np.pi
X_MIN, X_MAX = -2 * np.pi, 4 * np.pi

def f_saw(x):
    """
    2π-periodic sawtooth in [0,1):
      f(x) = (x mod 2π) / (2π)
    Jump discontinuity at multiples of 2π.
    """
    t = np.mod(x, TWOPI)
    return t / TWOPI

def fourier_partial_sum(x, N):
    """
    Partial sum:
      S_N(x) = 1/2 - (1/π) * sum_{n=1..N} (1/n) sin(n x)
    """
    s = 0.5 * np.ones_like(x)
    for n in range(1, N + 1):
        s -= (1.0 / (np.pi * n)) * np.sin(n * x)
    return s

# Precompute grid & exact function for fast updates
x_grid = np.linspace(X_MIN, X_MAX, 2000)
base_f = f_saw(x_grid)

def compute_series_data(N: int):
    """
    Returns Plotly-friendly lists (x, f, S_N) for the selected N.
    """
    N = int(N)
    N = max(1, min(10, N))
    approx = fourier_partial_sum(x_grid, N)
    return x_grid.tolist(), base_f.tolist(), approx.tolist()