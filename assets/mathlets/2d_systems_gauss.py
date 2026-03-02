import numpy as np

# ---- Matrix Construction: A = F D E ----
def A_matrix(e: float, f: float, d1: float, d2: float):
    F = np.array([[1.0, f], [0.0, 1.0]], dtype=float)
    D = np.diag([d1, d2]).astype(float)
    E = np.array([[1.0, 0.0], [e, 1.0]], dtype=float)
    return F @ D @ E

# ---- Vector field (dx, dy) = A(x, y) ----
def f_factory(e: float, f: float, d1: float, d2: float):
    A = A_matrix(e, f, d1, d2)
    def vf(x, y):
        dx = A[0, 0] * x + A[0, 1] * y
        dy = A[1, 0] * x + A[1, 1] * y
        return dx, dy
    return vf

# ---- Vector field for arrows ----
def slope_field(
    e: float, f: float, d1: float, d2: float,
    x_range=(-4.0, 4.0), y_range=(-4.0, 4.0),
    n: int = 20, scale: float = 0.4, eps: float = 1e-12
):
    vf = f_factory(e, f, d1, d2)

    xs = np.linspace(x_range[0], x_range[1], n)
    ys = np.linspace(y_range[0], y_range[1], n)
    X, Y = np.meshgrid(xs, ys)

    DX, DY = vf(X, Y)
    norm = np.sqrt(DX**2 + DY**2)

    # avoid division by zero
    norm = np.where(norm < eps, 1.0, norm)
    DXn = DX / norm
    DYn = DY / norm

    x0 = X - 0.5 * scale * DXn
    x1 = X + 0.5 * scale * DXn
    y0 = Y - 0.5 * scale * DYn
    y1 = Y + 0.5 * scale * DYn

    xsf = np.stack([x0, x1, np.full_like(x0, np.nan)], axis=-1).ravel()
    ysf = np.stack([y0, y1, np.full_like(y0, np.nan)], axis=-1).ravel()

    return xsf.tolist(), ysf.tolist()

# ---- RK4 integrator in time ----
def rk4_path(
    e: float, f: float, d1: float, d2: float,
    x0: float, y0: float, t_end: float,
    h: float = 0.02, clip: float = 10.0
):
    vf = f_factory(e, f, d1, d2)

    h = abs(h) * (1.0 if t_end >= 0 else -1.0)
    x, y = float(x0), float(y0)
    xs, ys = [x], [y]

    t = 0.0
    while (t_end - t) * h > 0:
        if abs(t_end - t) < abs(h):
            h = (t_end - t)

        dx1, dy1 = vf(x, y)
        dx2, dy2 = vf(x + 0.5*h*dx1, y + 0.5*h*dy1)
        dx3, dy3 = vf(x + 0.5*h*dx2, y + 0.5*h*dy2)
        dx4, dy4 = vf(x + h*dx3, y + h*dy3)

        x += (h/6.0) * (dx1 + 2.0*dx2 + 2.0*dx3 + dx4)
        y += (h/6.0) * (dy1 + 2.0*dy2 + 2.0*dy3 + dy4)
        t += h

        if (not np.isfinite(x)) or (not np.isfinite(y)) or abs(x) > clip or abs(y) > clip:
            break

        xs.append(x)
        ys.append(y)

    return xs, ys

# ---- Arrowhead polyline at a given time along trajectory ----
def arrow_at_time(
    e: float, f: float, d1: float, d2: float,
    x0: float, y0: float, t_arrow: float,
    h: float = 0.02
):
    """
    Returns (ax, ay) for a small triangular arrow polyline at time t_arrow
    starting from initial condition (x0,y0).

    If we cannot compute a stable arrow, returns ([], []).
    """
    vf = f_factory(e, f, d1, d2)

    xs, ys = rk4_path(e, f, d1, d2, x0, y0, t_arrow, h=h, clip=1e9)
    if len(xs) < 2:
        return [], []

    x_arrow, y_arrow = xs[-1], ys[-1]
    dx, dy = vf(x_arrow, y_arrow)
    norm = float(np.hypot(dx, dy))
    if (not np.isfinite(norm)) or norm < 1e-8:
        return [], []

    dx /= norm
    dy /= norm

    # same geometry as your Dash code
    ax = [
        x_arrow - 0.15*dx + 0.05*dy,
        x_arrow,
        x_arrow - 0.15*dx - 0.05*dy
    ]
    ay = [
        y_arrow - 0.15*dy - 0.05*dx,
        y_arrow,
        y_arrow - 0.15*dy + 0.05*dx
    ]
    return ax, ay