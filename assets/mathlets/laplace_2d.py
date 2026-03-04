import numpy as np

# ============================================================
# 2D Laplace equation on the unit square:
#   Δu = u_xx + u_yy = 0  on (0,1)x(0,1)
#
# Dirichlet boundary conditions (y is the vertical coordinate):
#   u(0,y) = y^2 + a y + b
#   u(1,y) = y^2 + c y + d
#
# and we choose linear boundary data on y=0 and y=1 that matches
# the corner values (so the boundary is continuous at corners):
#   u(x,0) = (1-x)*b + x*d
#   u(x,1) = (1-x)*(1+a+b) + x*(1+c+d)
#
# Numerical solve: Gauss–Seidel SOR (stable for 0<omega<2).
# NOTE: the previous version used a "weighted Jacobi" formula with
# omega>1, which diverges. This version fixes that.
# ============================================================


def _apply_boundary(U, x, y, a, b, c, d):
    # Left/right: functions of y
    U[0, :] = y**2 + a * y + b
    U[-1, :] = y**2 + c * y + d

    # Bottom/top: linear in x, matching corners
    U[:, 0] = (1.0 - x) * b + x * d
    U[:, -1] = (1.0 - x) * (1.0 + a + b) + x * (1.0 + c + d)
    return U


def solve_laplace(a, b, c, d, N=31, iters=600, omega=1.85, tol=1e-6):
    """Return (x, y, U) with U.shape=(N,N), U[i,j]=u(x_i,y_j)."""

    a = float(a)
    b = float(b)
    c = float(c)
    d = float(d)
    N = int(N)
    iters = int(iters)
    omega = float(omega)
    tol = float(tol)

    if not (0.0 < omega < 2.0):
        # keep it safe
        omega = 1.5

    x = np.linspace(0.0, 1.0, N)
    y = np.linspace(0.0, 1.0, N)

    U = np.zeros((N, N), dtype=float)
    U = _apply_boundary(U, x, y, a, b, c, d)

    # Initial guess: bilinear interpolation of corners (helps speed)
    X, Y = np.meshgrid(x, y, indexing="ij")
    u00 = b
    u10 = d
    u01 = 1.0 + a + b
    u11 = 1.0 + c + d
    U0 = (1 - X) * (1 - Y) * u00 + X * (1 - Y) * u10 + (1 - X) * Y * u01 + X * Y * u11
    U[1:-1, 1:-1] = U0[1:-1, 1:-1]
    U = _apply_boundary(U, x, y, a, b, c, d)

    # SOR sweep
    for _ in range(iters):
        max_delta = 0.0

        for i in range(1, N - 1):
            Ui = U[i]  # view
            for j in range(1, N - 1):
                old = Ui[j]
                new_gs = 0.25 * (U[i + 1, j] + U[i - 1, j] + Ui[j + 1] + Ui[j - 1])
                Ui[j] = (1.0 - omega) * old + omega * new_gs
                dlt = abs(Ui[j] - old)
                if dlt > max_delta:
                    max_delta = dlt

        U = _apply_boundary(U, x, y, a, b, c, d)

        if max_delta < tol:
            break

    return x, y, U


def compute_plot_data(a, b, c, d, N=31, iters=600):
    """Return (x, y, Z, zmin, zmax) JSON-friendly for Plotly."""

    x, y, U = solve_laplace(a, b, c, d, N=N, iters=iters)

    zmin = float(np.min(U))
    zmax = float(np.max(U))
    pad = 0.04 * (zmax - zmin + 1e-12)
    zmin -= pad
    zmax += pad

    return (x.tolist(), y.tolist(), U.tolist(), zmin, zmax)
