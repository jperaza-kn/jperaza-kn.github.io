import numpy as np

# 2-periodic extension of f(x)=x^2 on [-1,1]
# Period = 2 => L = 1, basis cos(n*pi*x)

X_MIN, X_MAX = -2.0, 4.0  # show multiple periods
PI = np.pi

def reduce_to_interval(x):
    """
    Map x to t in [-1,1) using period 2:
      t = ((x + 1) mod 2) - 1
    Works with numpy arrays.
    """
    return np.mod(x + 1.0, 2.0) - 1.0

def f_periodic_x2(x):
    t = reduce_to_interval(x)
    return t**2

def fourier_partial_sum(x, N):
    """
    Fourier series for the 2-periodic extension:
      f(x) ~ 1/3 + sum_{n>=1} [4(-1)^n/(n^2*pi^2)] cos(n*pi*x)
    Partial sum uses n=1..N.
    """
    x = np.asarray(x)
    N = int(N)
    N = max(1, min(10, N))

    s = (1.0/3.0) * np.ones_like(x, dtype=float)
    for n in range(1, N+1):
        coeff = 4.0 * ((-1.0)**n) / ( (n*n) * (PI*PI) )
        s += coeff * np.cos(n * PI * x)
    return s

# precompute grid & exact periodic function (fast updates)
x_grid = np.linspace(X_MIN, X_MAX, 2000)
base_f = f_periodic_x2(x_grid)

def compute_series_data(N: int):
    """
    Returns Plotly-friendly lists (x, f, S_N) for the selected N.
    """
    approx = fourier_partial_sum(x_grid, int(N))
    return x_grid.tolist(), base_f.tolist(), approx.tolist()