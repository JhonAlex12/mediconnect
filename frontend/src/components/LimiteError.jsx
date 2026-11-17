import React from 'react';

// Pantallas que funcionan sin nadie al frente (entrada y sala): se recargan solas
const DESATENDIDAS = ['/kiosco', '/pantalla'];
const SEGUNDOS_RECARGA = 20;
const CLAVE_RECARGA = 'mediconect_recarga_por_version';

// Tras publicar una versión nueva, una pestaña que seguía abierta pide archivos que ya no existen
const esVersionVieja = (error) =>
  /dynamically imported module|module script failed|unable to preload css/i.test(String(error?.message ?? ''));

// Recarga una sola vez por minuto, para no quedar en un ciclo si el problema sigue
function recargarUnaVez() {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) || 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    return false;   // sin almacenamiento no hay cómo saber si ya se recargó
  }
  window.location.reload();
  return true;
}

// Si una pantalla falla al dibujarse, muestra un aviso en vez de dejar la página en blanco.
// "ruta" (opcional): al cambiar de dirección se vuelve a intentar.
export default class LimiteError extends React.Component {
  state = { error: null, recargando: false, segundos: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[pantalla]', error, info?.componentStack);
    if (esVersionVieja(error) && recargarUnaVez()) {
      this.setState({ recargando: true });
      return;
    }
    if (DESATENDIDAS.some((r) => window.location.pathname.startsWith(r))) {
      this.setState({ segundos: SEGUNDOS_RECARGA });
      this.cuenta = setInterval(() => {
        this.setState(({ segundos }) => {
          if (segundos <= 1) window.location.reload();
          return { segundos: Math.max(0, segundos - 1) };
        });
      }, 1000);
    }
  }

  componentDidUpdate(anterior) {
    if (this.state.error && anterior.ruta !== this.props.ruta) {
      clearInterval(this.cuenta);
      this.setState({ error: null, recargando: false, segundos: null });
    }
  }

  componentWillUnmount() {
    clearInterval(this.cuenta);
  }

  render() {
    const { error, recargando, segundos } = this.state;
    if (!error) return this.props.children;
    // Se está cargando la versión nueva: no hace falta alarmar con un mensaje
    if (recargando) return <div className="min-h-screen bg-slate-100" aria-busy="true" />;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
        <h1 className="font-titulo text-2xl font-bold text-marca-noche">Algo salió mal en esta pantalla</h1>
        <p className="max-w-md text-slate-600">
          {segundos !== null
            ? `La pantalla se cargará de nuevo en ${segundos} s.`
            : 'Vuelva a cargar la página. Lo que ya quedó guardado no se pierde.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()}
            className="bg-marca-azul hover:bg-marca-azul-oscuro text-white font-semibold px-5 py-2.5 rounded-lg cursor-pointer">
            Volver a cargar
          </button>
          {segundos === null && (
            <a href={this.props.inicio ?? '/'} className="font-semibold text-marca-azul hover:underline px-3 py-2.5">
              Ir al inicio
            </a>
          )}
        </div>
      </div>
    );
  }
}
