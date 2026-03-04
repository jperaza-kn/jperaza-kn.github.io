import numpy as np

# We parse A(x), B(x) using sympy (inside Pyodide).
from sympy import Symbol, E, pi
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
)
from sympy import lambdify

x = Symbol("x", real=True)

TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)

# Safe-ish locals: common functions/constants; unknown names will raise.
import sympy as sp
SAFE_LOCALS = {
    "x": x,
    "E": E,
    "pi": pi,
    "sin": sp.sin,
    "cos": sp.cos,
    "tan": sp.tan,
    "exp": sp.exp,
    "log": sp.log,
    "sqrt": sp.sqrt,
    "abs": sp.Abs,
}

def _parse_to_callable(expr_str):
    expr_str = (expr_str or "").strip()
    if expr_str == "":
        expr_str = "0"

    locals_map = dict(SAFE_LOCALS)
    locals_map["e"] = E  # allow e^x

    try:
        expr = parse_expr(expr_str, local_dict=locals_map, transformations=TRANSFORMS, evaluate=True)
    except Exception as e:
        raise ValueError(f"Could not parse expression: {expr_str}\n{e}")

    try:
        f = lambdify(x, expr, modules=["numpy"])
    except Exception as e:
        raise ValueError(f"Could not compile expression: {expr_str}\n{e}")

    return f, expr

def _f_factory(A_str, B_str, n):
    A_fun, A_expr = _parse_to_callable(A_str)
    B_fun, B_expr = _parse_to_callable(B_str)
    n = float(n)

    def f(X, Y):
        AX = A_fun(X)
        BX = B_fun(X)
        return BX * np.power(Y, n) - AX * Y

    return f, A_expr, B_expr, n

def compute_field_data(A_str, B_str, n, m,
                       x_min=-3.0, x_max=3.0, y_min=-3.0, y_max=3.0,
                       nx=33, ny=33, seg_len=0.22):
    """
    Returns:
      xvec, yvec, z_iso (f-m on grid), seg_x, seg_y
    """
    m = float(m)
    f, _, _, _ = _f_factory(A_str, B_str, n)

    xvec = np.linspace(x_min, x_max, nx)
    yvec = np.linspace(y_min, y_max, ny)
    X, Y = np.meshgrid(xvec, yvec, indexing="xy")

    F = f(X, Y)
    F_clamped = np.clip(F, -25.0, 25.0)
    Z_iso = F - m

    denom = np.sqrt(1.0 + F_clamped**2)
    dx = seg_len / denom
    dy = (seg_len * F_clamped) / denom

    seg_x = []
    seg_y = []
    for j in range(ny):
        for i in range(nx):
            x0 = X[j, i]
            y0 = Y[j, i]
            seg_x += [float(x0 - dx[j, i]), float(x0 + dx[j, i]), None]
            seg_y += [float(y0 - dy[j, i]), float(y0 + dy[j, i]), None]

    return (
        xvec.tolist(),
        yvec.tolist(),
        Z_iso.tolist(),
        seg_x,
        seg_y
    )

def solve_curve(A_str, B_str, n, x0, y0, x_min=-3.0, x_max=3.0, h=0.02, max_steps=20000):
    """
    RK4 integrate forward + backward in x. Stops if y blows up.
    """
    f, _, _, _ = _f_factory(A_str, B_str, n)
    x0 = float(x0); y0 = float(y0)
    x_min = float(x_min); x_max = float(x_max)
    h = float(h)

    def rk4_step(x, y, step):
        k1 = f(x, y)
        k2 = f(x + 0.5*step, y + 0.5*step*k1)
        k3 = f(x + 0.5*step, y + 0.5*step*k2)
        k4 = f(x + step, y + step*k3)
        return y + (step/6.0)*(k1 + 2*k2 + 2*k3 + k4)

    xs_f = [x0]; ys_f = [y0]
    x = x0; y = y0
    for _ in range(max_steps):
        if x >= x_max: break
        if not np.isfinite(y): break
        if abs(y) > 50: break
        y = rk4_step(x, y, h)
        x = x + h
        xs_f.append(float(x)); ys_f.append(float(y))

    xs_b = []; ys_b = []
    x = x0; y = y0
    for _ in range(max_steps):
        if x <= x_min: break
        if not np.isfinite(y): break
        if abs(y) > 50: break
        y = rk4_step(x, y, -h)
        x = x - h
        xs_b.append(float(x)); ys_b.append(float(y))

    xs = xs_b[::-1] + xs_f
    ys = ys_b[::-1] + ys_f
    return xs, ys
