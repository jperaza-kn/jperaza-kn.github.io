import numpy as np

XYZ_RANGE = (-4.0, 4.0)

def A_matrix(a11, a12, a13, a21, a22, a23, a31, a32, a33):
    return np.array([[a11, a12, a13],
                     [a21, a22, a23],
                     [a31, a32, a33]], dtype=float)

def f_factory(A):
    def f(x, y, z):
        dx = A[0,0]*x + A[0,1]*y + A[0,2]*z
        dy = A[1,0]*x + A[1,1]*y + A[1,2]*z
        dz = A[2,0]*x + A[2,1]*y + A[2,2]*z
        return dx, dy, dz
    return f

def rk4_path(f, x0, y0, z0, t_end, h=0.05, clip=15.0):
    h = abs(h) * (1.0 if t_end >= 0 else -1.0)
    x, y, z = float(x0), float(y0), float(z0)
    xs, ys, zs = [x], [y], [z]
    t = 0.0
    while (t_end - t) * h > 0:
        if abs(t_end - t) < abs(h):
            h = (t_end - t)
        dx1, dy1, dz1 = f(x, y, z)
        dx2, dy2, dz2 = f(x + 0.5*h*dx1, y + 0.5*h*dy1, z + 0.5*h*dz1)
        dx3, dy3, dz3 = f(x + 0.5*h*dx2, y + 0.5*h*dy2, z + 0.5*h*dz2)
        dx4, dy4, dz4 = f(x + h*dx3, y + h*dy3, z + h*dz3)
        x += (h/6.0)*(dx1 + 2*dx2 + 2*dx3 + dx4)
        y += (h/6.0)*(dy1 + 2*dy2 + 2*dy3 + dy4)
        z += (h/6.0)*(dz1 + 2*dz2 + 2*dz3 + dz4)

        if (not np.isfinite(x)) or (not np.isfinite(y)) or (not np.isfinite(z)) or np.linalg.norm([x,y,z]) > clip:
            break

        xs.append(x); ys.append(y); zs.append(z)
        t += h

    return np.array(xs), np.array(ys), np.array(zs)

def compute_flow_traces(pars, T, forward_only=False, show_eig=False):
    """
    Returns:
      traces: list[dict] for Plotly (Scatter3d traces)
      eig_info: string (markdown-ish; JS will render directly in a div)
      eig_shown: bool
    """
    pars = [float(p) for p in pars]
    A = A_matrix(*pars)
    f = f_factory(A)

    base_colors = ["#a8e8ff", "#7fdcff", "#54cfff", "#31c4f0", "#2dbcc3",
                   "#3bbf9f", "#4fc389", "#6acd76", "#8ee874", "#b5ff80"]

    traces = []
    seeds = [(x,y,z) for x in range(-2,3) for y in range(-2,3) for z in range(-2,3)]

    for i, (x0,y0,z0) in enumerate(seeds, start=1):
        xf, yf, zf = rk4_path(f, x0, y0, z0, t_end=T)

        if forward_only:
            xx, yy, zz = xf, yf, zf
        else:
            xb, yb, zb = rk4_path(f, x0, y0, z0, t_end=-T)
            xx = np.concatenate((xb[::-1], xf[1:]))
            yy = np.concatenate((yb[::-1], yf[1:]))
            zz = np.concatenate((zb[::-1], zf[1:]))

        color = base_colors[(i-1) % len(base_colors)]

        traces.append({
            "type": "scatter3d",
            "mode": "lines",
            "x": xx.tolist(), "y": yy.tolist(), "z": zz.tolist(),
            "line": {"color": color, "width": 2},
            "showlegend": False,
            "hoverinfo": "skip"
        })

        traces.append({
            "type": "scatter3d",
            "mode": "markers",
            "x": [float(x0)], "y": [float(y0)], "z": [float(z0)],
            "marker": {"size": 3, "color": color, "line": {"color": "#000", "width": 0.5}},
            "showlegend": False,
            "hoverinfo": "skip"
        })

    eig_info = "_(Haz clic en la casilla para mostrar los autovalores.)_"
    eig_shown = False

    if show_eig:
        eigvals, eigvecs = np.linalg.eig(A)
        eig_texts = []
        for i in range(3):
            v = np.real(eigvecs[:, i])
            nrm = np.linalg.norm(v)
            if nrm > 1e-8:
                v = v / nrm

            color = "red" if np.isreal(eigvals[i]) else "blue"

            traces.append({
                "type": "scatter3d",
                "mode": "lines+markers",
                "x": [0.0, float(v[0])],
                "y": [0.0, float(v[1])],
                "z": [0.0, float(v[2])],
                "line": {"color": color, "width": 5},
                "marker": {"size": 3, "color": color},
                "showlegend": False,
                "hoverinfo": "skip"
            })

            eig_texts.append(f"λ{i+1} = {eigvals[i]:.3f}")

        eig_info = "\n".join(eig_texts)
        eig_shown = True

    return traces, eig_info, eig_shown