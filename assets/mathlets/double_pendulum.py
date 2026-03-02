import numpy as np

# Equal masses/lengths, point masses, massless rods
m = 1.0
l = 1.0
g = 1.0

# Plot ranges
TH_RANGE = (-np.pi, np.pi)
PH_RANGE = (-np.pi, np.pi)

def V(theta, phi):
    """
    Potential energy up to additive constant, for equal masses/lengths.
    V = m g l (3 - 2 cos(theta) - cos(phi))
    """
    return m * g * l * (3.0 - 2.0*np.cos(theta) - np.cos(phi))

def energy_grid(n=220):
    th = np.linspace(TH_RANGE[0], TH_RANGE[1], n)
    ph = np.linspace(PH_RANGE[0], PH_RANGE[1], n)
    TH, PH = np.meshgrid(th, ph)
    Z = V(TH, PH)
    return th.tolist(), ph.tolist(), Z.tolist()

def eom(theta, phi, theta_dot, phi_dot):
    """
    Equations of motion derived from the Lagrangian for the equal-parameter point-mass double pendulum:
      T = m l^2 (theta_dot^2 + 1/2 phi_dot^2 + theta_dot*phi_dot*cos(theta-phi))
      V = m g l (3 - 2 cos theta - cos phi)

    Solving:
      [2, cosΔ; cosΔ, 1] [θ¨; φ¨] =
        [ -φ̇^2 sinΔ - 2(g/l) sinθ ;
           θ̇^2 sinΔ -   (g/l) sinφ ]
    """
    d = theta - phi
    cd = np.cos(d)
    sd = np.sin(d)

    rhs1 = - (phi_dot**2) * sd - 2.0*(g/l)*np.sin(theta)
    rhs2 = + (theta_dot**2) * sd - 1.0*(g/l)*np.sin(phi)

    denom = 2.0 - cd*cd  # det of [[2,cd],[cd,1]]
    if abs(denom) < 1e-12:
        denom = 1e-12 if denom >= 0 else -1e-12

    theta_dd = (rhs1 - cd*rhs2) / denom
    phi_dd   = (-cd*rhs1 + 2.0*rhs2) / denom
    return theta_dd, phi_dd

def _wrap_to_2pi_window(a):
    """
    Wrap angle into [-2π, 2π].
    """
    return ((a + 2*np.pi) % (4*np.pi)) - 2*np.pi

def rk4_path(theta0, phi0, t_end=20.0, h=0.01):
    """
    Integrate (theta,phi) with initial angular velocities 0,
    wrapping angles into [-2π,2π] and inserting NaNs when wrapping jumps.
    """
    theta = float(theta0)
    phi   = float(phi0)
    thd = 0.0
    phd = 0.0

    n_steps = int(max(2, np.ceil(abs(t_end)/abs(h))))
    h = (t_end / (n_steps-1))

    TH = [theta]
    PH = [phi]

    prev_th = theta
    prev_ph = phi

    for _ in range(n_steps-1):
        def F(state):
            th, ph, thd_, phd_ = state
            thdd, phdd = eom(th, ph, thd_, phd_)
            return np.array([thd_, phd_, thdd, phdd], dtype=float)

        y = np.array([theta, phi, thd, phd], dtype=float)

        k1 = F(y)
        k2 = F(y + 0.5*h*k1)
        k3 = F(y + 0.5*h*k2)
        k4 = F(y + h*k3)

        y = y + (h/6.0)*(k1 + 2*k2 + 2*k3 + k4)

        theta, phi, thd, phd = float(y[0]), float(y[1]), float(y[2]), float(y[3])

        if not (np.isfinite(theta) and np.isfinite(phi) and np.isfinite(thd) and np.isfinite(phd)):
            break

        # wrap into [-2π,2π]
        th_wrapped = _wrap_to_2pi_window(theta)
        ph_wrapped = _wrap_to_2pi_window(phi)

        # if we jumped due to wrapping, break the line
        if abs(th_wrapped - prev_th) > np.pi or abs(ph_wrapped - prev_ph) > np.pi:
            TH.append(np.nan)
            PH.append(np.nan)

        TH.append(th_wrapped)
        PH.append(ph_wrapped)

        prev_th = th_wrapped
        prev_ph = ph_wrapped

    return TH, PH


def compute_fig_data(theta0, phi0):
    """
    Returns:
      - energy grid for V(theta,phi)  (this equals H at p_theta=p_phi=0)
      - trajectory in (theta,phi)
      - initial point
    """
    th_grid, ph_grid, Z = energy_grid(n=220)
    ths, phs = rk4_path(theta0, phi0, t_end=20.0, h=0.01)

    return {
        "th_grid": th_grid,
        "ph_grid": ph_grid,
        "Z": Z,
        "ths": ths,
        "phs": phs,
        "theta0": float(theta0),
        "phi0": float(phi0),
    }