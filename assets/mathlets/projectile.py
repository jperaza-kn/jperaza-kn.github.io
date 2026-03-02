import numpy as np

# =======================================
# ---- Constants, parameters, and helpers
# =======================================
G = 6.67430e-11
M_E = 5.97219e24
MU = G * M_E
R_E = 6_371_000.0

DEFAULT_g = 9.80665
DT_DEFAULT = 0.01
TMAX_DEFAULT = 300.0

# ------------------
# Physics
# ------------------
# State s = [x, y, vx, vy]
def deriv_uniform(s, k, g):
    x, y, vx, vy = s
    ax = -k * vx
    ay = -g - k * vy
    return np.array([vx, vy, ax, ay], dtype=float)

def deriv_newton(s, k):
    x, y, vx, vy = s
    r_vec = np.array([x, y + R_E], dtype=float)
    r = np.linalg.norm(r_vec)
    if r == 0.0:
        a_g = np.array([0.0, 0.0], dtype=float)
    else:
        a_g = -MU * r_vec / (r**3)
    ax = a_g[0] - k * vx
    ay = a_g[1] - k * vy
    return np.array([vx, vy, ax, ay], dtype=float)

def rk4_step(s, dt, f, *fargs):
    k1 = f(s, *fargs)
    k2 = f(s + 0.5 * dt * k1, *fargs)
    k3 = f(s + 0.5 * dt * k2, *fargs)
    k4 = f(s + dt * k3, *fargs)
    return s + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)

def simulate_full(v0, theta_deg, h0, k_drag, use_newton=False, g=DEFAULT_g, dt=DT_DEFAULT, tmax=TMAX_DEFAULT):
    theta = np.deg2rad(theta_deg)
    vx0 = v0 * np.cos(theta)
    vy0 = v0 * np.sin(theta)

    s = np.array([0.0, h0, vx0, vy0], dtype=float)

    if use_newton:
        f = lambda st, kd: deriv_newton(st, kd)
    else:
        f = lambda st, kd: deriv_uniform(st, kd, g)

    xs, ys, vxs, vys, ts = [s[0]], [s[1]], [s[2]], [s[3]], [0.0]
    t = 0.0

    y_prev = s[1]
    s_prev = s.copy()

    while t < tmax:
        s = rk4_step(s, dt, f, k_drag)
        t += dt

        xs.append(s[0]); ys.append(s[1]); vxs.append(s[2]); vys.append(s[3]); ts.append(t)

        if s[1] <= 0.0 and t > 0.0:
            # interpolate to ground crossing
            y_curr = s[1]; x_curr = s[0]; t_curr = t
            y1, y2 = y_prev, y_curr
            x1, x2 = s_prev[0], x_curr
            t1, t2 = t - dt, t_curr
            if y2 != y1:
                frac = (0.0 - y1) / (y2 - y1)
                x_land = x1 + frac * (x2 - x1)
                t_land = t1 + frac * (t2 - t1)
            else:
                x_land, t_land = x_curr, t_curr

            xs[-1] = x_land
            ys[-1] = 0.0
            ts[-1] = t_land
            break

        s_prev = s.copy()
        y_prev = s[1]

    xs = np.array(xs); ys = np.array(ys); vxs = np.array(vxs); vys = np.array(vys); ts = np.array(ts)
    speed = np.sqrt(vxs**2 + vys**2)

    apogee_idx = int(np.argmax(ys))
    h_max = float(ys[apogee_idx])
    x_at_hmax = float(xs[apogee_idx])

    tof = float(ts[-1])
    range_ = float(xs[-1])
    final_speed = float(speed[-1])

    return {
        "t": ts, "x": xs, "y": ys, "vx": vxs, "vy": vys, "speed": speed,
        "h_max": h_max, "x_hmax": x_at_hmax, "tof": tof, "range": range_, "final_speed": final_speed
    }

def _metrics(sim):
    return {
        "tof": float(sim["tof"]),
        "range": float(sim["range"]),
        "h_max": float(sim["h_max"]),
        "x_hmax": float(sim["x_hmax"]),
        "final_speed": float(sim["final_speed"]),
    }

def compute_all(v0A, thetaA, kA, v0B, thetaB, kB, use_newton, g_val):
    # fixed initial height
    h0 = 0.0
    use_newton = bool(use_newton)
    g_val = float(g_val)

    # simulations
    sim_refA = simulate_full(v0=v0A, theta_deg=thetaA, h0=h0, k_drag=0.0,
                             use_newton=use_newton, g=g_val)
    sim_A = simulate_full(v0=v0A, theta_deg=thetaA, h0=h0, k_drag=kA,
                          use_newton=use_newton, g=g_val)
    sim_B = simulate_full(v0=v0B, theta_deg=thetaB, h0=h0, k_drag=kB,
                          use_newton=use_newton, g=g_val)

    # bounds for trajectory plot
    all_x = np.concatenate([sim_refA["x"], sim_A["x"], sim_B["x"]])
    all_y = np.concatenate([sim_refA["y"], sim_A["y"], sim_B["y"]])

    x_min, x_max = float(np.min(all_x)), float(np.max(all_x))
    y_min, y_max = float(np.min(all_y)), float(np.max(all_y))

    pad_x = 0.05 * max(1.0, x_max - x_min)
    pad_y = 0.10 * max(1.0, y_max - y_min)

    traj_x = [x_min - pad_x, x_max + pad_x]
    traj_y = [max(-50.0, y_min - pad_y), y_max + pad_y]

    # payload
    payload = {
        "params": {"kA": float(kA), "kB": float(kB)},
        "model": ("Newtonian GM/r^2" if use_newton else f"Uniform g = {g_val:.3f} m/s^2"),
        "bounds": {"traj_x": traj_x, "traj_y": traj_y},
        "traj": {
            "refA": {"x": sim_refA["x"].tolist(), "y": sim_refA["y"].tolist()},
            "A": {"x": sim_A["x"].tolist(), "y": sim_A["y"].tolist()},
            "B": {"x": sim_B["x"].tolist(), "y": sim_B["y"].tolist()},
        },
        "yt": {
            "A": {"t": sim_A["t"].tolist(), "y": sim_A["y"].tolist()},
            "B": {"t": sim_B["t"].tolist(), "y": sim_B["y"].tolist()},
        },
        "metrics": {
            "refA": _metrics(sim_refA),
            "A": _metrics(sim_A),
            "B": _metrics(sim_B),
        }
    }

    return payload