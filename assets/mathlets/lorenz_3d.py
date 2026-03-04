import numpy as np

# ==========================================================
# Lorenz system
#   dx/dt = sigma (y - x)
#   dy/dt = x (rho - z) - y
#   dz/dt = x y - beta z
#
# Integrated with a fixed-step RK4 scheme.
# Returned arrays are JSON-friendly lists for Plotly.
# ==========================================================

def lorenz_rhs(state, sigma, rho, beta):
    x, y, z = state
    dx = sigma * (y - x)
    dy = x * (rho - z) - y
    dz = x * y - beta * z
    return np.array([dx, dy, dz], dtype=float)

def rk4_trajectory(x0, y0, z0, sigma, rho, beta, tmax=40.0, dt=0.01):
    sigma = float(sigma); rho = float(rho); beta = float(beta)
    tmax = float(tmax); dt = float(dt)

    n = int(np.floor(tmax / dt)) + 1
    t = np.linspace(0.0, dt*(n-1), n, dtype=float)

    traj = np.empty((n, 3), dtype=float)
    state = np.array([float(x0), float(y0), float(z0)], dtype=float)
    traj[0] = state

    for i in range(1, n):
        k1 = lorenz_rhs(state, sigma, rho, beta)
        k2 = lorenz_rhs(state + 0.5*dt*k1, sigma, rho, beta)
        k3 = lorenz_rhs(state + 0.5*dt*k2, sigma, rho, beta)
        k4 = lorenz_rhs(state + dt*k3, sigma, rho, beta)
        state = state + (dt/6.0)*(k1 + 2*k2 + 2*k3 + k4)
        traj[i] = state

    return t, traj[:,0], traj[:,1], traj[:,2]

def compute_plot_data(sigma, rho, beta, x0, y0, z0, tmax, dt):
    """Compute trajectory + padded ranges for plotting.

    Returns:
      t, x, y, z,
      x_min, x_max, y_min, y_max, z_min, z_max
    """
    t, x, y, z = rk4_trajectory(x0, y0, z0, sigma, rho, beta, tmax=tmax, dt=dt)

    def padded_range(a):
        amin = float(np.min(a)); amax = float(np.max(a))
        if np.isclose(amin, amax):
            pad = 1.0
        else:
            pad = 0.08*(amax-amin)
        return amin - pad, amax + pad

    xmn, xmx = padded_range(x)
    ymn, ymx = padded_range(y)
    zmn, zmx = padded_range(z)

    return (
        t.tolist(), x.tolist(), y.tolist(), z.tolist(),
        xmn, xmx, ymn, ymx, zmn, zmx
    )
