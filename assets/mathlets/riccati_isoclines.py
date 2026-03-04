import numpy as np

# Riccati ODE:
#   y' + A(x) y + B(x) y^2 = C(x)
# => y' = C(x) - A(x) y - B(x) y^2
#
# This file is designed for Pyodide execution in-browser.

# ---------- Expression parsing (LaTeX-ish) ----------
# We use sympy to safely parse expressions like:
#   e^x, sin(x), 1/(1+x^2), pi, sqrt(x)
# and then lambdify to numpy for fast evaluation.

def _make_callable(expr_str: str):
    import sympy as sp
    from sympy.parsing.sympy_parser import (
        parse_expr, standard_transformations, implicit_multiplication_application
    )

    s = (expr_str or "").strip()
    if s == "":
        s = "0"

    # light "latex-ish" normalization
    s = s.replace("^", "**")
    # common aliases
    s = s.replace("ln(", "log(")

    x = sp.Symbol("x")
    transformations = standard_transformations + (implicit_multiplication_application,)

    # local dictionary: allow exp, sin, cos, tan, sqrt, pi, E, etc.
    local_dict = {
        "x": x,
        "e": sp.E,
        "E": sp.E,
        "pi": sp.pi,
        "exp": sp.exp,
        "sin": sp.sin,
        "cos": sp.cos,
        "tan": sp.tan,
        "asin": sp.asin,
        "acos": sp.acos,
        "atan": sp.atan,
        "sinh": sp.sinh,
        "cosh": sp.cosh,
        "tanh": sp.tanh,
        "sqrt": sp.sqrt,
        "log": sp.log,
        "abs": sp.Abs,
    }

    try:
        expr = parse_expr(s, local_dict=local_dict, transformations=transformations, evaluate=True)
    except Exception as e:
        raise ValueError(f"Could not parse expression: {expr_str!r}\n{e}")

    f = sp.lambdify(x, expr, modules=["numpy"])
    return f, str(expr)


# ---------- Numerical helpers ----------
def _rhs_factory(Af, Bf, Cf):
    def f(x, y):
        return Cf(x) - Af(x) * y - Bf(x) * (y ** 2)
    return f


def _rk4_step(f, x, y, h):
    k1 = f(x, y)
    k2 = f(x + 0.5*h, y + 0.5*h*k1)
    k3 = f(x + 0.5*h, y + 0.5*h*k2)
    k4 = f(x + h, y + h*k3)
    return y + (h/6.0)*(k1 + 2*k2 + 2*k3 + k4)


def solve_curve(A_expr, B_expr, C_expr, x0, y0, x_min, x_max, h=0.01, y_clip=50.0):
    """
    Integrate from (x0,y0) forward to x_max and backward to x_min using RK4.

    Returns:
      xs (list), ys (list)
    """
    Af, _ = _make_callable(A_expr)
    Bf, _ = _make_callable(B_expr)
    Cf, _ = _make_callable(C_expr)
    f = _rhs_factory(Af, Bf, Cf)

    x0 = float(x0); y0 = float(y0)
    x_min = float(x_min); x_max = float(x_max)
    h = float(h)

    # forward
    xs_f = [x0]; ys_f = [y0]
    x = x0; y = y0
    while x < x_max - 1e-12:
        step = min(h, x_max - x)
        y = _rk4_step(f, x, y, step)
        x = x + step
        if not np.isfinite(y) or abs(y) > y_clip:
            break
        xs_f.append(x); ys_f.append(float(y))

    # backward
    xs_b = []; ys_b = []
    x = x0; y = y0
    while x > x_min + 1e-12:
        step = min(h, x - x_min)
        y = _rk4_step(f, x, y, -step)
        x = x - step
        if not np.isfinite(y) or abs(y) > y_clip:
            break
        xs_b.append(x); ys_b.append(float(y))

    xs = list(reversed(xs_b)) + xs_f
    ys = list(reversed(ys_b)) + ys_f
    return xs, ys


def compute_field(A_expr, B_expr, C_expr, x_min, x_max, y_min, y_max,
                  nx=41, ny=41, seglen=0.08, m=0.0):
    """
    Build data for:
      - slope segments (direction field) for y' = f(x,y)
      - isocline for y' = m (single orange line via contour of f-m=0)

    Returns:
      xgrid (list), ygrid (list), F (2D list) where F = f(x,y) - m  (for contour)
      segs: list of segments as [x0,x1,y0,y1]
    """
    Af, _ = _make_callable(A_expr)
    Bf, _ = _make_callable(B_expr)
    Cf, _ = _make_callable(C_expr)
    f = _rhs_factory(Af, Bf, Cf)

    x_min = float(x_min); x_max = float(x_max)
    y_min = float(y_min); y_max = float(y_max)
    nx = int(nx); ny = int(ny)
    seglen = float(seglen)
    m = float(m)

    xs = np.linspace(x_min, x_max, nx)
    ys = np.linspace(y_min, y_max, ny)
    X, Y = np.meshgrid(xs, ys, indexing="xy")

    # slope field
    S = f(X, Y)
    # avoid insane slopes
    S = np.clip(S, -50.0, 50.0)
    # direction vectors (dx,dy) normalized, using dy/dx = S
    dx = 1.0 / np.sqrt(1.0 + S*S)
    dy = S * dx

    segs = []
    for j in range(ny):
        for i in range(nx):
            x0 = float(X[j, i])
            y0 = float(Y[j, i])
            x1 = x0 + 0.5*seglen*float(dx[j, i])
            y1 = y0 + 0.5*seglen*float(dy[j, i])
            x2 = x0 - 0.5*seglen*float(dx[j, i])
            y2 = y0 - 0.5*seglen*float(dy[j, i])
            segs.append([x2, x1, y2, y1])

    F = (S - m).tolist()  # for contour: F=0 is isocline y'=m
    return xs.tolist(), ys.tolist(), F, segs
