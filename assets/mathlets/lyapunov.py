import numpy as np
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
)

# ==========================================
# Lyapunov / Phase portrait mathlet utilities
# ==========================================
# Default system:
#   x' = x**2 - y
#   y' = 2*x**3 - 2*x*y
# Detects a conserved quantity H=y-x**2 => V=H**2
# ==========================================

x, y = sp.symbols('x y', real=True)

_TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)

_ALLOWED = {
    'x': x, 'y': y,
    'pi': sp.pi, 'E': sp.E, 'e': sp.E,
    'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
    'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan,
    'sinh': sp.sinh, 'cosh': sp.cosh, 'tanh': sp.tanh,
    'exp': sp.exp, 'log': sp.log, 'ln': sp.log,
    'sqrt': sp.sqrt, 'abs': sp.Abs,
}

def _to_expr(s: str) -> sp.Expr:
    s = (s or '').strip()
    if s == '':
        return sp.Integer(0)
    return parse_expr(s, local_dict=_ALLOWED, transformations=_TRANSFORMS, evaluate=True)

def compile_system(f_str: str, g_str: str):
    f_expr = _to_expr(f_str)
    g_expr = _to_expr(g_str)
    f_num = sp.lambdify((x, y), f_expr, modules=['numpy'])
    g_num = sp.lambdify((x, y), g_expr, modules=['numpy'])
    return f_expr, g_expr, f_num, g_num, sp.latex(f_expr), sp.latex(g_expr)

def integrate_rk4(f_num, g_num, x0, y0, T=4.0, dt=0.01, max_steps=20000):
    T = float(T); dt = float(dt)
    steps = int(min(max_steps, max(1, round(T / dt))))
    t = np.linspace(0.0, steps*dt, steps+1)
    X = np.empty(steps+1); Y = np.empty(steps+1)
    X[0] = float(x0); Y[0] = float(y0)

    for i in range(steps):
        xi, yi = X[i], Y[i]

        k1x = f_num(xi, yi); k1y = g_num(xi, yi)
        k2x = f_num(xi + 0.5*dt*k1x, yi + 0.5*dt*k1y); k2y = g_num(xi + 0.5*dt*k1x, yi + 0.5*dt*k1y)
        k3x = f_num(xi + 0.5*dt*k2x, yi + 0.5*dt*k2y); k3y = g_num(xi + 0.5*dt*k2x, yi + 0.5*dt*k2y)
        k4x = f_num(xi + dt*k3x, yi + dt*k3y); k4y = g_num(xi + dt*k3x, yi + dt*k3y)

        X[i+1] = xi + (dt/6.0)*(k1x + 2*k2x + 2*k3x + k4x)
        Y[i+1] = yi + (dt/6.0)*(k1y + 2*k2y + 2*k3y + k4y)

        if not np.isfinite(X[i+1]) or not np.isfinite(Y[i+1]):
            X = X[:i+2]; Y = Y[:i+2]; t = t[:i+2]
            break

    return t, X, Y

def phase_portrait(f_num, g_num, T=4.0, dt=0.02, grid_n=5, xlim=(-2.5, 2.5), ylim=(-2.5, 2.5)):
    x0s = np.linspace(xlim[0], xlim[1], grid_n)
    y0s = np.linspace(ylim[0], ylim[1], grid_n)
    trajs = []
    for x0 in x0s:
        for y0 in y0s:
            t, X, Y = integrate_rk4(f_num, g_num, x0, y0, T=T, dt=dt)
            trajs.append({'x': X.tolist(), 'y': Y.tolist()})
    return trajs

def _is_zero(expr):
    try:
        return sp.simplify(expr) == 0
    except Exception:
        return False

def find_lyapunov_candidate(f_expr, g_expr):
    # Candidate #1: dy/dx depends only on x
    try:
        q = sp.simplify(g_expr / f_expr)
        if not q.has(y):
            gx = sp.integrate(q, x)
            H = sp.simplify(y - gx)
            V = sp.simplify(H**2)
            return {
                'found': True,
                'type': 'first_integral',
                'V_latex': sp.latex(V),
                'V_expr_str': str(V),
                'notes': 'Detected dy/dx = q(x); H=y-∫q(x)dx is conserved, so V=H^2.'
            }
    except Exception:
        pass

    # Candidate #2: gradient flow (curl=0)
    try:
        curl = sp.simplify(sp.diff(f_expr, y) - sp.diff(g_expr, x))
        if _is_zero(curl):
            Vx = -f_expr
            Vy = -g_expr
            V_part = sp.integrate(Vx, x)
            hprime = sp.simplify(Vy - sp.diff(V_part, y))
            if not hprime.has(x):
                h = sp.integrate(hprime, y)
                V = sp.simplify(V_part + h)
                return {
                    'found': True,
                    'type': 'gradient',
                    'V_latex': sp.latex(V),
                    'V_expr_str': str(V),
                    'notes': 'Detected zero curl; reconstructed potential V with (f,g)=-∇V.'
                }
    except Exception:
        pass

    return {'found': False}

def eval_V_on_grid(V_expr_str, xlim=(-2.5,2.5), ylim=(-2.5,2.5), n=140):
    V_expr = sp.sympify(V_expr_str, locals=_ALLOWED)
    V_num = sp.lambdify((x,y), V_expr, modules=['numpy'])
    xs = np.linspace(xlim[0], xlim[1], n)
    ys = np.linspace(ylim[0], ylim[1], n)
    X, Y = np.meshgrid(xs, ys)
    Z = np.array(V_num(X, Y), dtype=float)
    Z = np.clip(Z, -1e6, 1e6)
    return xs.tolist(), ys.tolist(), Z.tolist()

def compute_all(f_str, g_str, T, dt, grid_n, xlim, ylim, x0, y0, want_solution=True):
    f_expr, g_expr, f_num, g_num, f_ltx, g_ltx = compile_system(f_str, g_str)
    trajs = phase_portrait(f_num, g_num, T=float(T), dt=float(dt), grid_n=int(grid_n),
                           xlim=tuple(xlim), ylim=tuple(ylim))
    sol = None
    if want_solution:
        t, X, Y = integrate_rk4(f_num, g_num, x0, y0, T=float(T), dt=float(dt))
        sol = {'t': t.tolist(), 'x': X.tolist(), 'y': Y.tolist()}

    ly = find_lyapunov_candidate(f_expr, g_expr)
    Vgrid = None
    if ly.get('found'):
        xs, ys, Z = eval_V_on_grid(ly['V_expr_str'], xlim=tuple(xlim), ylim=tuple(ylim), n=140)
        Vgrid = {'x': xs, 'y': ys, 'z': Z}

    return {
        'f_latex': f_ltx,
        'g_latex': g_ltx,
        'trajs': trajs,
        'solution': sol,
        'lyapunov': ly,
        'Vgrid': Vgrid
    }
