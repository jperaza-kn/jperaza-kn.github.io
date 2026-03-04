import numpy as np

def u0_profile(x, kind: str):
    x = np.asarray(x)
    if kind == "sawtooth":
        xmin, xmax = x.min(), x.max()
        L = xmax - xmin
        s = ((x - xmin) / L) % 1.0
        return 2.0*s - 1.0
    if kind == "gaussian":
        return np.exp(-((x + 0.8)**2) / (0.18**2))
    if kind == "step":
        return (x < 0.0).astype(float)
    return np.exp(-((x + 0.8)**2) / (0.18**2))

def flux(u):
    return 0.5*u*u

def godunov_flux(ul, ur):
    if ul <= ur:
        if ul >= 0.0:
            return flux(ul)
        elif ur <= 0.0:
            return flux(ur)
        else:
            return 0.0
    else:
        s = 0.5*(ul + ur)
        return flux(ul) if s >= 0.0 else flux(ur)

def simulate(kind: str, nx: int = 401, xmin: float = -2.0, xmax: float = 2.0,
             T: float = 1.5, dt: float = 0.004):
    x = np.linspace(xmin, xmax, int(nx))
    dx = x[1] - x[0]
    u = u0_profile(x, kind).astype(float)

    nt = int(np.floor(T / dt)) + 1
    times = np.linspace(0.0, (nt-1)*dt, nt)

    U = np.empty((nt, nx), dtype=float)
    U[0] = u

    for n in range(1, nt):
        un = U[n-1].copy()
        F = np.empty(nx, dtype=float)
        for i in range(nx):
            ul = un[i]
            ur = un[(i+1) % nx]
            F[i] = godunov_flux(ul, ur)
        U[n] = un - (dt/dx) * (F - np.roll(F, 1))

    m = 33
    x0s = np.linspace(xmin, xmax, m)
    u0s = u0_profile(x0s, kind)
    Xchars = []
    Tchars = times
    L = xmax - xmin
    for x0, u00 in zip(x0s, u0s):
        xx = x0 + u00*Tchars
        xx = ((xx - xmin) % L) + xmin
        Xchars.append(xx.tolist())

    return {
        "x": x.tolist(),
        "times": times.tolist(),
        "U": U.tolist(),
        "x0": x0s.tolist(),
        "u0": u0s.tolist(),
        "Xchars": Xchars,
        "Tchars": Tchars.tolist(),
        "xmin": float(xmin),
        "xmax": float(xmax),
        "dt": float(dt),
    }

def sample_at_time(sim, t_query: float):
    times = np.array(sim["times"], dtype=float)
    U = np.array(sim["U"], dtype=float)
    x = np.array(sim["x"], dtype=float)

    t = float(t_query)
    if t <= times[0]:
        return x.tolist(), U[0].tolist(), 0
    if t >= times[-1]:
        return x.tolist(), U[-1].tolist(), len(times)-1

    idx = int(np.searchsorted(times, t))
    if idx <= 0:
        return x.tolist(), U[0].tolist(), 0
    t0, t1 = times[idx-1], times[idx]
    w = (t - t0) / (t1 - t0 + 1e-12)
    u = (1-w)*U[idx-1] + w*U[idx]
    return x.tolist(), u.tolist(), idx
