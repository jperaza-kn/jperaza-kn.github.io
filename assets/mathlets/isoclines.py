import numpy as np

XRANGE = (-4.0, 4.0)
YRANGE = (-4.0, 4.0)

def f_factory(a: float):
    return lambda x, y: y**3 - a*y - x

def slope_field(a: float, x_range=XRANGE, y_range=YRANGE, n=20, seg_len=0.30):
    f = f_factory(a)
    xs = np.linspace(x_range[0], x_range[1], n)
    ys = np.linspace(y_range[0], y_range[1], n)
    X, Y = np.meshgrid(xs, ys)
    S = f(X, Y)
    U = 1.0 / np.sqrt(1.0 + S**2)
    V = S / np.sqrt(1.0 + S**2)
    X0 = X - 0.5 * seg_len * U
    X1 = X + 0.5 * seg_len * U
    Y0 = Y - 0.5 * seg_len * V
    Y1 = Y + 0.5 * seg_len * V

    xsf = np.stack([X0, X1, np.full_like(X0, np.nan)], axis=-1).ravel()
    ysf = np.stack([Y0, Y1, np.full_like(Y0, np.nan)], axis=-1).ravel()
    return xsf.tolist(), ysf.tolist()

def isocline_grid(a: float, x_range=XRANGE, y_range=YRANGE, n=120):
    f = f_factory(a)
    x = np.linspace(x_range[0], x_range[1], n)
    y = np.linspace(y_range[0], y_range[1], n)
    X, Y = np.meshgrid(x, y)
    Z = f(X, Y)
    # Plotly wants z as 2D array (list of rows)
    return x.tolist(), y.tolist(), Z.tolist()

def rk4_path(a: float, x0: float, y0: float, x_end: float, h=0.02, y_clip=20.0):
    f = f_factory(a)
    h = abs(h) * (1.0 if x_end >= x0 else -1.0)
    xs = [x0]; ys = [y0]
    x, y = x0, y0
    while (x_end - x) * h > 0:
        if abs(x_end - x) < abs(h):
            h = (x_end - x)
        k1 = f(x, y)
        k2 = f(x + 0.5*h, y + 0.5*h*k1)
        k3 = f(x + 0.5*h, y + 0.5*h*k2)
        k4 = f(x + h, y + h*k3)
        y = y + (h/6.0)*(k1 + 2*k2 + 2*k3 + k4)
        x = x + h
        if (not np.isfinite(y)) or abs(y) > y_clip:
            break
        xs.append(x); ys.append(y)
    return xs, ys
