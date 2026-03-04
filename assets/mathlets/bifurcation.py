import numpy as np

# ==========================================
# Bifurcation Explorer (Pyodide-friendly)
# Two 1D ODEs:
#  (A) Supercritical pitchfork: x' = r x - x^3
#  (B) Logistic (transcritical at r=0): x' = r x (1-x)
# Provides:
#  - bifurcation_branches(model, rmin, rmax, n)
#  - integrate_rk4(model, r, x0, T, dt)
#  - compute_all(...)
# ==========================================

def f(model: str, x: float, r: float) -> float:
    if model == "pitchfork":
        return r*x - x**3
    elif model == "logistic":
        return r*x*(1.0 - x)
    else:
        # fallback
        return r*x - x**3

def df_dx(model: str, x: float, r: float) -> float:
    if model == "pitchfork":
        return r - 3.0*x**2
    elif model == "logistic":
        return r*(1.0 - 2.0*x)
    else:
        return r - 3.0*x**2

def equilibria(model: str, r: float):
    if model == "pitchfork":
        eq = [0.0]
        if r > 0:
            s = np.sqrt(r)
            eq += [s, -s]
        return eq
    elif model == "logistic":
        return [0.0, 1.0]
    else:
        eq = [0.0]
        if r > 0:
            s = np.sqrt(r)
            eq += [s, -s]
        return eq

def integrate_rk4(model: str, r: float, x0: float, T: float = 10.0, dt: float = 0.01, max_steps: int = 50000):
    r = float(r); x0 = float(x0); T = float(T); dt = float(dt)
    steps = int(min(max_steps, max(1, round(T/dt))))
    t = np.linspace(0.0, steps*dt, steps+1)
    X = np.empty(steps+1)
    X[0] = x0
    for i in range(steps):
        xi = X[i]
        k1 = f(model, xi, r)
        k2 = f(model, xi + 0.5*dt*k1, r)
        k3 = f(model, xi + 0.5*dt*k2, r)
        k4 = f(model, xi + dt*k3, r)
        X[i+1] = xi + (dt/6.0)*(k1 + 2*k2 + 2*k3 + k4)
        if not np.isfinite(X[i+1]) or abs(X[i+1]) > 1e6:
            t = t[:i+2]
            X = X[:i+2]
            break
    return t, X

def bifurcation_branches(model: str, rmin: float=-2.0, rmax: float=2.0, n: int=500):
    rs = np.linspace(float(rmin), float(rmax), int(n))

    # We'll return two sets of curves: stable and unstable (as separate polylines)
    stable_curves = []
    unstable_curves = []

    # Helper: append point to polyline list (break on nan)
    def add_point(curves, r, x, key):
        curves[key].append((r, x))

    # For these analytic models, we can build branches explicitly for clarity.
    if model == "pitchfork":
        # Branch x=0 for all r (stable for r<0, unstable for r>0)
        r_neg = rs[rs <= 0]
        r_pos = rs[rs >= 0]
        stable_curves.append({"r": r_neg.tolist(), "x": (0*r_neg).tolist(), "name": "x*=0 (stable)"})
        unstable_curves.append({"r": r_pos.tolist(), "x": (0*r_pos).tolist(), "name": "x*=0 (unstable)"})
        # Branches x=±sqrt(r) for r>0 (stable)
        rp = r_pos
        xp = np.sqrt(np.maximum(rp, 0))
        stable_curves.append({"r": rp.tolist(), "x": xp.tolist(), "name": "+sqrt(r) (stable)"})
        stable_curves.append({"r": rp.tolist(), "x": (-xp).tolist(), "name": "-sqrt(r) (stable)"})

    elif model == "logistic":
        # x=0 branch: stable for r<0, unstable for r>0
        r_neg = rs[rs <= 0]
        r_pos = rs[rs >= 0]
        stable_curves.append({"r": r_neg.tolist(), "x": (0*r_neg).tolist(), "name": "x*=0 (stable)"})
        unstable_curves.append({"r": r_pos.tolist(), "x": (0*r_pos).tolist(), "name": "x*=0 (unstable)"})
        # x=1 branch: unstable for r<0, stable for r>0
        unstable_curves.append({"r": r_neg.tolist(), "x": (0*r_neg + 1).tolist(), "name": "x*=1 (unstable)"})
        stable_curves.append({"r": r_pos.tolist(), "x": (0*r_pos + 1).tolist(), "name": "x*=1 (stable)"})

    else:
        # generic numeric: sample equilibria and classify by df/dx
        st_r=[]; st_x=[]; un_r=[]; un_x=[]
        for r in rs:
            for xeq in equilibria(model, float(r)):
                s = df_dx(model, xeq, float(r))
                if s < 0:
                    st_r.append(float(r)); st_x.append(float(xeq))
                else:
                    un_r.append(float(r)); un_x.append(float(xeq))
        stable_curves.append({"r": st_r, "x": st_x, "name": "stable eq"})
        unstable_curves.append({"r": un_r, "x": un_x, "name": "unstable eq"})

    return rs.tolist(), stable_curves, unstable_curves

def compute_all(model: str, r: float, x0: float, T: float, dt: float,
                rmin: float=-2.0, rmax: float=2.0, nbranch: int=600):
    # branches
    rs, stable, unstable = bifurcation_branches(model, rmin=rmin, rmax=rmax, n=nbranch)
    # equilibria at current r
    eqs = equilibria(model, float(r))
    eq_info = []
    for xe in eqs:
        stab = df_dx(model, xe, float(r)) < 0
        eq_info.append({"x": float(xe), "stable": bool(stab)})
    # solution
    t, X = integrate_rk4(model, float(r), float(x0), T=float(T), dt=float(dt))
    # y values for click-capture at t=0 (dense invisible)
    ygrid = np.linspace(-3.0, 3.0, 401)
    t0 = np.zeros_like(ygrid)
    return {
        "rs": rs,
        "stable": stable,
        "unstable": unstable,
        "r": float(r),
        "model": model,
        "eq": eq_info,
        "sol": {"t": t.tolist(), "x": X.tolist(), "x0": float(x0)},
        "clickline": {"t": t0.tolist(), "x": ygrid.tolist()},  # x-axis of time plot is t, y is state
    }
