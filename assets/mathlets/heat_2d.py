import numpy as np

# ============================================================
# 2D Heat equation on [0,1]x[0,1] with time-independent Dirichlet BC
#   u_t = Δu,   u|_{∂Ω} = g(x,y) (fixed in time)
#
# We provide BCs parameterized by a,b,c,d:
#   Left  (x=0): u(0,y) = y^2 + a y + b
#   Right (x=1): u(1,y) = y^2 + c y + d
#   Bottom(y=0): linear from b (x=0) to d (x=1)
#   Top   (y=1): linear from (1+a+b) to (1+c+d)
#
# Initial condition u(x,y,0) must match boundary values.
# We build it as:
#   u0 = "boundary blend" + bump * sin(pi x) sin(pi y)
# where bump vanishes at boundary, so u0 satisfies BCs exactly.
# Then heat flow relaxes towards the harmonic steady state.
#
# Time stepping: ADI Crank–Nicolson (Douglas) scheme, stable for large dt.
# ============================================================

STATE = None  # global state for Pyodide session


def _tridiag_solve(a, b, c, d):
    """
    Solve tridiagonal system with vectors:
      a: sub-diagonal (n-1)
      b: diagonal (n)
      c: super-diagonal (n-1)
      d: RHS (n)
    Returns x (n).
    """
    n = b.size
    cp = np.empty(n-1, dtype=float)
    dp = np.empty(n, dtype=float)

    # forward sweep
    beta = b[0]
    dp[0] = d[0] / beta
    for i in range(n-1):
        cp[i] = c[i] / beta
        beta = b[i+1] - a[i] * cp[i]
        dp[i+1] = (d[i+1] - a[i] * dp[i]) / beta

    # back substitution
    x = np.empty(n, dtype=float)
    x[-1] = dp[-1]
    for i in range(n-2, -1, -1):
        x[i] = dp[i] - cp[i] * x[i+1]
    return x


def _bc_arrays(a, b, c, d, X, Y):
    """
    Return boundary arrays:
      left(y), right(y), bottom(x), top(x)
    with corner consistency.
    """
    left = Y**2 + a*Y + b
    right = Y**2 + c*Y + d
    bottom = b + (d - b) * X
    top = (1 + a + b) + ((1 + c + d) - (1 + a + b)) * X
    return left, right, bottom, top


def _apply_bc(U, left, right, bottom, top):
    U[0, :] = left
    U[-1, :] = right
    U[:, 0] = bottom
    U[:, -1] = top


def _boundary_blend(Xg, Yg, left, right, bottom, top):
    """
    A smooth-ish blend that matches all 4 edges exactly (standard Coons patch).
    """
    X = Xg
    Y = Yg
    # bilinear corner interpolation
    f00 = bottom[0]
    f10 = bottom[-1]
    f01 = top[0]
    f11 = top[-1]
    bilinear = (1-X)*(1-Y)*f00 + X*(1-Y)*f10 + (1-X)*Y*f01 + X*Y*f11

    # edge blends
    blend = (1-X)*left[None, :] + X*right[None, :] + (1-Y)*bottom[:, None] + Y*top[:, None] - bilinear
    return blend


class Heat2DState:
    def __init__(self, a, b, c, d, N=61, dt=0.01):
        self.N = int(N)
        self.dt = float(dt)
        self.t = 0.0

        self.x = np.linspace(0.0, 1.0, self.N)
        self.y = np.linspace(0.0, 1.0, self.N)
        self.dx = self.x[1] - self.x[0]
        self.dy = self.y[1] - self.y[0]

        self.Xg, self.Yg = np.meshgrid(self.x, self.y, indexing="ij")  # (N,N)

        self.set_bc(a, b, c, d)
        self.reset_ic()

        # Precompute ADI coefficients for interior points
        self._setup_adi()

    def set_bc(self, a, b, c, d):
        self.a = float(a); self.b = float(b); self.c = float(c); self.d = float(d)
        left, right, bottom, top = _bc_arrays(self.a, self.b, self.c, self.d, self.x, self.y)
        self.left = left
        self.right = right
        self.bottom = bottom
        self.top = top

    def reset_ic(self):
        # boundary-matching base field
        base = _boundary_blend(self.Xg, self.Yg, self.left, self.right, self.bottom, self.top)

        # interior bump (vanishes on boundary)
        bump_shape = (np.sin(np.pi * self.Xg) * np.sin(np.pi * self.Yg) - np.sin(2*np.pi * self.Xg) * np.sin(2 *np.pi * self.Yg))**2

        # amplitude scales with boundary magnitude for visibility
        scale = max(1.0, np.max(np.abs(base)))
        amp = 0.55 * scale
        self.U = base + amp * bump_shape

        _apply_bc(self.U, self.left, self.right, self.bottom, self.top)
        self.t = 0.0

    def _setup_adi(self):
        # r_x = dt/(2 dx^2), r_y = dt/(2 dy^2)
        self.rx = self.dt / (2.0 * self.dx * self.dx)
        self.ry = self.dt / (2.0 * self.dy * self.dy)

        n_int = self.N - 2
        # x-direction tridiagonal coefficients for lines at fixed j
        self.ax = -self.rx * np.ones(n_int-1)
        self.bx = (1.0 + 2.0*self.rx) * np.ones(n_int)
        self.cx = -self.rx * np.ones(n_int-1)

        # y-direction tridiagonal coefficients for lines at fixed i
        self.ay = -self.ry * np.ones(n_int-1)
        self.by = (1.0 + 2.0*self.ry) * np.ones(n_int)
        self.cy = -self.ry * np.ones(n_int-1)

    def step(self, nsteps=1):
        """
        Advance by nsteps using ADI Crank–Nicolson (Douglas):
          (I - rx Dxx) U* = (I + ry Dyy) U^n
          (I - ry Dyy) U^{n+1} = (I + rx Dxx) U*
        Dirichlet BC enforced each substep.
        """
        nsteps = int(nsteps)
        N = self.N
        n_int = N - 2

        for _ in range(nsteps):
            U = self.U
            # Enforce BC each step (they are time-independent here)
            _apply_bc(U, self.left, self.right, self.bottom, self.top)

            # ---- Step 1: solve along x for each interior y-index j
            Ustar = U.copy()

            # RHS = (I + ry Dyy) U^n for interior
            # For each (i,j): RHS = U[i,j] + ry*(U[i,j-1] -2U[i,j] + U[i,j+1])
            # then solve (I - rx Dxx) Ustar[:,j] = RHS[:,j]
            for j in range(1, N-1):
                rhs = U[1:-1, j].copy()
                rhs += self.ry * (U[1:-1, j-1] - 2.0*U[1:-1, j] + U[1:-1, j+1])

                # add Dirichlet contributions from x-boundaries due to -rx Dxx
                # equation for first interior i=1 includes +rx*U[0,j] on RHS; last includes +rx*U[N-1,j]
                rhs[0] += self.rx * U[0, j]
                rhs[-1] += self.rx * U[-1, j]

                sol = _tridiag_solve(self.ax, self.bx, self.cx, rhs)
                Ustar[1:-1, j] = sol

            _apply_bc(Ustar, self.left, self.right, self.bottom, self.top)

            # ---- Step 2: solve along y for each interior x-index i
            Unew = Ustar.copy()
            for i in range(1, N-1):
                rhs = Ustar[i, 1:-1].copy()
                rhs += self.rx * (Ustar[i-1, 1:-1] - 2.0*Ustar[i, 1:-1] + Ustar[i+1, 1:-1])

                # Dirichlet contributions from y-boundaries
                rhs[0] += self.ry * Ustar[i, 0]
                rhs[-1] += self.ry * Ustar[i, -1]

                sol = _tridiag_solve(self.ay, self.by, self.cy, rhs)
                Unew[i, 1:-1] = sol

            _apply_bc(Unew, self.left, self.right, self.bottom, self.top)

            self.U = Unew
            self.t += self.dt

        return self.t


def reset_state(a, b, c, d, N=61, dt=0.01):
    global STATE
    STATE = Heat2DState(a, b, c, d, N=N, dt=dt)
    return STATE


def step_state(nsteps=1):
    if STATE is None:
        raise RuntimeError("State not initialized. Call reset_state first.")
    return STATE.step(nsteps=nsteps)


def get_plot_data():
    if STATE is None:
        raise RuntimeError("State not initialized. Call reset_state first.")

    # Use a refined grid for the surface by simple upsampling (bilinear via kron)
    U = STATE.U
    # Up-sample factor (2 gives nicer mesh; keep modest for browser)
    f = 2
    Uref = np.kron(U, np.ones((f, f)))
    xref = np.linspace(0.0, 1.0, Uref.shape[0])
    yref = np.linspace(0.0, 1.0, Uref.shape[1])
    Xr, Yr = np.meshgrid(xref, yref, indexing="ij")

    # ranges
    umin = float(np.min(Uref))
    umax = float(np.max(Uref))
    pad = 0.12 * max(1e-9, (umax - umin))
    zmin = umin - pad
    zmax = umax + pad

    return (
        Xr.tolist(),
        Yr.tolist(),
        Uref.tolist(),
        STATE.t,
        zmin,
        zmax
    )
