
import numpy as np

# ============================================================
# Stationary scattering on a rectangular potential barrier
# (time-independent Schrödinger equation, 1D)
#
# Barrier: V(x)=V0 for x0 < x < x0+a, and 0 otherwise.
# We assume incidence from the left.
#
# Region I  (x<x0):      ψ = e^{ik0(x-x0)} + r e^{-ik0(x-x0)}
# Region II (x0<x<x0+a): ψ = Br e^{ik1(x-x0)} + Bl e^{-ik1(x-x0)}
# Region III(x>x0+a):    ψ = t e^{ik0(x-x0)}
#
# Boundary conditions: ψ and ψ' continuous at x=x0 and x=x0+a.
# (Matches the standard derivation on the "Rectangular potential barrier" page.)
#
# Units: choose ħ=1 and 2m=1, so k0 = sqrt(E), k1 = sqrt(E - V0).
# For E < V0, k1 is imaginary => exponential decay in the barrier.
# ============================================================

# Fixed geometry
X0 = 1.0  # barrier starts at x=1
X_MIN, X_MAX = -4.0, 6.0

# Fixed particle energy (can be made a slider later if you want)
E0 = 1.0

def _solve_coeffs(a, V0, E=E0):
    """
    Solve for (r, Br, Bl, t) for incidence from the left with Ar=1, Cl=0.

    Returns complex coefficients and wavenumbers (k0, k1).
    """
    a = float(a)
    V0 = float(V0)
    E = float(E)

    # k0 outside, k1 inside
    k0 = np.sqrt(max(E, 0.0)) + 0j
    k1 = np.sqrt(E - V0 + 0j)   # may be imaginary

    # Unknowns: [r, Br, Bl, t]
    # Equations at x'=0:
    # 1 + r = Br + Bl
    # k0(1 - r) = k1(Br - Bl)
    #
    # Equations at x'=a:
    # Br e^{ik1 a} + Bl e^{-ik1 a} = t e^{ik0 a}
    # k1(Br e^{ik1 a} - Bl e^{-ik1 a}) = k0 t e^{ik0 a}
    #
    # (We drop the common factor i in derivatives because it cancels.)
    e1 = np.exp(1j * k1 * a)
    e2 = np.exp(-1j * k1 * a)
    e0a = np.exp(1j * k0 * a)

    A = np.zeros((4, 4), dtype=complex)
    b = np.zeros((4,), dtype=complex)

    # 1 + r - Br - Bl = 0
    A[0, 0] = 1.0        # r
    A[0, 1] = -1.0       # Br
    A[0, 2] = -1.0       # Bl
    A[0, 3] = 0.0        # t
    b[0] = -1.0

    # k0(1 - r) - k1(Br - Bl) = 0  => -k0 r - k1 Br + k1 Bl = -k0
    A[1, 0] = -k0
    A[1, 1] = -k1
    A[1, 2] = +k1
    A[1, 3] = 0.0
    b[1] = -k0

    # Br e^{ik1 a} + Bl e^{-ik1 a} - t e^{ik0 a} = 0
    A[2, 0] = 0.0
    A[2, 1] = e1
    A[2, 2] = e2
    A[2, 3] = -e0a
    b[2] = 0.0

    # k1(Br e^{ik1 a} - Bl e^{-ik1 a}) - k0 t e^{ik0 a} = 0
    A[3, 0] = 0.0
    A[3, 1] = k1 * e1
    A[3, 2] = -k1 * e2
    A[3, 3] = -k0 * e0a
    b[3] = 0.0

    sol = np.linalg.solve(A, b)
    r, Br, Bl, t = sol
    return r, Br, Bl, t, k0, k1

def _psi_profile(a, V0, phase, E=E0, npts=1400):
    """
    Build ψ(x) on a grid and return x, |ψ|^2 and V(x).
    `phase` is used only as a horizontal shift of the displayed x-axis
    to make the standing-wave pattern visually "move".
    """
    a = float(a)
    V0 = float(V0)
    phase = float(phase)

    r, Br, Bl, t, k0, k1 = _solve_coeffs(a, V0, E=E)

    # grid
    x = np.linspace(X_MIN, X_MAX, int(npts))
    xp = x - X0  # shifted coordinate so barrier is [0, a] in xp
    psi = np.zeros_like(x, dtype=complex)

    # Regions
    left = xp < 0
    mid = (xp >= 0) & (xp <= a)
    right = xp > a

    psi[left] = np.exp(1j * k0 * xp[left]) + r * np.exp(-1j * k0 * xp[left])
    psi[mid]  = Br * np.exp(1j * k1 * xp[mid]) + Bl * np.exp(-1j * k1 * xp[mid])
    psi[right]= t * np.exp(1j * k0 * xp[right])

    prob = (psi * np.conjugate(psi)).real

    # Potential
    V = np.zeros_like(x)
    V[(xp >= 0) & (xp <= a)] = V0

    # Apply visual phase shift as translation in x (does NOT change |psi|^2 shape)
    # Choose shift in "wavelength units": shift = phase/k0
    k0_real = float(np.real(k0)) if np.real(k0) > 1e-12 else 1.0
    x_shift = phase / k0_real
    x_disp = x + x_shift

    return x_disp, prob, V, r, t, k0, k1, x_shift

def compute_plot_data(a, V0, phase):
    """
    Returns:
      X, P=|psi|^2, Vscaled_for_overlay, meta
    meta includes a few diagnostics (k0,kappa,etc.)
    """
    X, P, V, r, t, k0, k1, x_shift = _psi_profile(a, V0, phase)

    # Scale V so it fits in the same axis range for a subtle overlay
    pmax = float(np.max(P))
    if pmax <= 1e-12:
        scale = 1.0
    else:
        scale = 0.65 * pmax / max(float(V0), 1e-12)

    Vplot = V * scale

    # decay rate for E<V0
    if (E0 - float(V0)) < 0:
        kappa = float(np.sqrt(float(V0) - E0))
    else:
        kappa = 0.0

    meta = {
        "E": float(E0),
        "k0": float(np.real(k0)),
        "k1_re": float(np.real(k1)),
        "k1_im": float(np.imag(k1)),
        "kappa": float(kappa),
        "x0": float(X0),
        "x1": float(X0 + float(a)),
        "x_shift": float(x_shift),
        "R": float((r*np.conjugate(r)).real),
        "T_amp": float((t*np.conjugate(t)).real),
    }

    return X.tolist(), P.tolist(), Vplot.tolist(), meta
