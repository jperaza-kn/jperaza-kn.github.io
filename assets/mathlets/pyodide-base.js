/* assets/mathlets/pyodide-base.js
 *
 * Minimal Pyodide loader for GitHub Pages mathlets.
 * Provides:
 *   - initPyodideBase({ packages?: string[], stdout?: (s)=>void, stderr?: (s)=>void })
 *   - loadPythonFile(py, url)  -> loads and executes a .py file from the repo
 *
 * Usage:
 *   const py = await initPyodideBase({ packages: ["numpy"] });
 */

(() => {
  const PYODIDE_VERSION = "0.26.2";
  const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

  let _pyodidePromise = null;

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function _ensurePyodideLoader() {
    // Adds global `loadPyodide` if not present
    if (typeof window.loadPyodide === "function") return;
    await _loadScript(`${PYODIDE_INDEX_URL}pyodide.js`);
    if (typeof window.loadPyodide !== "function") {
      throw new Error("Pyodide loader did not initialize (loadPyodide missing).");
    }
  }

  async function initPyodideBase(options = {}) {
    const {
      packages = [],
      stdout = null,
      stderr = null
    } = options;

    if (!_pyodidePromise) {
      _pyodidePromise = (async () => {
        await _ensurePyodideLoader();

        const py = await window.loadPyodide({
          indexURL: PYODIDE_INDEX_URL
        });

        // Optional output routing
        if (stdout || stderr) {
          py.setStdout({
            batched: (s) => stdout && stdout(String(s))
          });
          py.setStderr({
            batched: (s) => stderr && stderr(String(s))
          });
        }

        return py;
      })();
    }

    const pyodide = await _pyodidePromise;

    if (packages && packages.length) {
      await pyodide.loadPackage(packages);
    }

    return pyodide;
  }

  async function loadPythonFile(pyodide, url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to fetch python file: ${url} (${r.status})`);
    const code = await r.text();
    pyodide.runPython(code);
  }

  // Expose globally
  window.initPyodideBase = initPyodideBase;
  window.loadPythonFile = loadPythonFile;
})();
