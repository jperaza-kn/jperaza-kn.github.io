import numpy as np

def f(x, y, r1, K1, a12, r2, K2, a21):
    dx = r1 * x * (1.0 - (x + a12 * y) / K1)
    dy = r2 * y * (1.0 - (y + a21 * x) / K2)
    return dx, dy

def rk4_step(x, y, dt, r1, K1, a12, r2, K2, a21):
    k1x, k1y = f(x, y, r1, K1, a12, r2, K2, a21)
    k2x, k2y = f(x + 0.5*dt*k1x, y + 0.5*dt*k1y, r1, K1, a12, r2, K2, a21)
    k3x, k3y = f(x + 0.5*dt*k2x, y + 0.5*dt*k2y, r1, K1, a12, r2, K2, a21)
    k4x, k4y = f(x + dt*k3x, y + dt*k3y, r1, K1, a12, r2, K2, a21)
    xn = x + (dt/6.0)*(k1x + 2*k2x + 2*k3x + k4x)
    yn = y + (dt/6.0)*(k1y + 2*k2y + 2*k3y + k4y)
    return xn, yn

def simulate(r1, K1, a12, r2, K2, a21, x0, y0, T=30.0, dt=0.01):
    r1 = float(r1); K1 = float(K1); a12 = float(a12)
    r2 = float(r2); K2 = float(K2); a21 = float(a21)
    x0 = float(x0); y0 = float(y0)
    T = float(T); dt = float(dt)

    n = int(max(2, np.floor(T/dt) + 1))
    t = np.linspace(0.0, T, n)

    x = np.empty(n, dtype=float)
    y = np.empty(n, dtype=float)
    x[0] = max(x0, 0.0)
    y[0] = max(y0, 0.0)

    for i in range(n-1):
        xn, yn = rk4_step(x[i], y[i], dt, r1, K1, a12, r2, K2, a21)
        x[i+1] = max(xn, 0.0)
        y[i+1] = max(yn, 0.0)

    return t, x, y

def compute_plot_data(r1, K1, a12, r2, K2, a21, x0, y0, T=30.0, dt=0.01):
    t, x, y = simulate(r1, K1, a12, r2, K2, a21, x0, y0, T=T, dt=dt)

    x_max = max(np.max(x), float(K1), 1e-9)
    y_max = max(np.max(y), float(K2), 1e-9)

    xlim = (0.0, 1.10 * x_max)
    ylim = (0.0, 1.10 * y_max)

    return (
        t.tolist(),
        x.tolist(),
        y.tolist(),
        [float(xlim[0]), float(xlim[1])],
        [float(ylim[0]), float(ylim[1])],
        float(T),
        float(dt),
    )
