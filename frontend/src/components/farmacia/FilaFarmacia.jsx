import React, { useCallback, useState } from 'react';
import { CheckCircle2, ClipboardList, Megaphone, PauseCircle, SkipForward, Undo2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { useEventoEnVivo } from '../../lib/tiempoReal';
import { Aviso, BotonAccion, IndicadorEnVivo, useAccion } from './comunes';
import {
  Boton, Campo, Cargando, Cuerpo, Encabezado, Entrada, EstadoBadge, EstadoVacio, Fila, Panel, Segmentado,
  Selector, Tabla, Td, Th, TituloPantalla,
} from '../ui';
import DispensarTurno from './DispensarTurno';

const PRIORIDADES = {
  ninguna: 'Sin prioridad',
  adulto_mayor: 'Adulto mayor',
  embarazada: 'Embarazada',
  discapacidad: 'Discapacidad',
};

const ESTADOS = {
  reservado: 'Reservado',
  en_camino: 'En camino',
  presente: 'Presente',
  llamado: 'Llamado',
  en_pausa: 'En pausa',
};

const hora = (fecha) =>
  fecha ? new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

function EtiquetaPrioridad({ prioridad }) {
  if (prioridad === 'ninguna') return <span className="text-tinta-tenue">—</span>;
  return <EstadoBadge>{PRIORIDADES[prioridad] ?? prioridad}</EstadoBadge>;
}

export default function FilaFarmacia() {
  const [datos, setDatos] = useState({ turno_actual: null, presentes: 0, fila: [] });
  const [cargando, setCargando] = useState(true);
  const [dispensando, setDispensando] = useState(null); // id del turno con la entrega abierta

  const cargar = useCallback(async () => {
    try {
      setDatos(await api('/fila'));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  const { ocupado, aviso, setAviso, ejecutar } = useAccion(cargar);

  // Tiempo real: el backend avisa "fila_actualizada" y el panel vuelve a pedir la fila
  useEventoEnVivo('fila_actualizada', cargar);

  const llamarSiguiente = () =>
    ejecutar(
      () => api('/fila/llamar-siguiente', { metodo: 'POST' }),
      (r) => `Llamando al turno ${r.turno.numero}`
    );

  const accionTurno = (turno, accion, texto) =>
    ejecutar(() => api(`/fila/${turno.id}/${accion}`, { metodo: 'POST' }), `Turno ${turno.numero}: ${texto}`);

  const llamado = datos.fila.find((t) => t.estado === 'llamado');
  // La entrega solo sigue abierta mientras ese mismo turno esté en ventanilla
  const entregaAbierta = llamado && dispensando === llamado.id;
  const presentes = datos.fila.filter((t) => t.estado === 'presente');
  const enPausa = datos.fila.filter((t) => t.estado === 'en_pausa');
  const porLlegar = datos.fila.filter((t) => t.estado === 'reservado' || t.estado === 'en_camino');

  return (
    <div>
      <TituloPantalla
        titulo="Fila de hoy"
        descripcion={`${presentes.length} en espera · ${enPausa.length} en pausa · ${porLlegar.length} por llegar`}
        acciones={<IndicadorEnVivo />}
      />

      <div className="space-y-5">
        <Aviso aviso={aviso} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            {/* Ventanilla: turno llamado o botón para llamar al siguiente (RF-21, RF-22) */}
            <Panel titulo="En ventanilla">
              {llamado ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-6 flex-wrap">
                    <p className="text-5xl font-bold text-tinta cifras leading-none">{llamado.numero}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-tinta-suave">Paciente</dt>
                      <dd className="font-bold text-tinta">{llamado.paciente ?? 'Sin nombre'}</dd>
                      <dt className="text-tinta-suave">Fórmula</dt>
                      <dd className="cifras">{llamado.formula ?? 'Sin fórmula vinculada'}</dd>
                      <dt className="text-tinta-suave">Llamado</dt>
                      <dd className="cifras">{hora(llamado.hora_llamado)}</dd>
                      {llamado.prioridad !== 'ninguna' && (
                        <>
                          <dt className="text-tinta-suave">Prioridad</dt>
                          <dd><EtiquetaPrioridad prioridad={llamado.prioridad} /></dd>
                        </>
                      )}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {llamado.formula && !entregaAbierta && (
                      <BotonAccion color="verde" icono={ClipboardList} ocupado={ocupado}
                        onClick={() => setDispensando(llamado.id)}>
                        Dispensar
                      </BotonAccion>
                    )}
                    <BotonAccion color={llamado.formula ? 'gris' : 'verde'} icono={CheckCircle2} ocupado={ocupado}
                      onClick={() => accionTurno(llamado, 'atender', 'atendido')}>
                      {llamado.formula ? 'Atendido sin entrega' : 'Marcar atendido'}
                    </BotonAccion>
                    <BotonAccion color="gris" icono={PauseCircle} ocupado={ocupado}
                      onClick={() => accionTurno(llamado, 'pausar', 'en pausa')}>
                      No se presentó (pausar)
                    </BotonAccion>
                    <BotonAccion color="gris" icono={SkipForward} ocupado={ocupado}
                      onClick={() => accionTurno(llamado, 'saltar', 'enviado al final de la fila')}>
                      Saltar
                    </BotonAccion>
                  </div>
                  {entregaAbierta && (
                    <DispensarTurno
                      key={llamado.id}
                      turno={llamado}
                      ocupado={ocupado}
                      ejecutar={ejecutar}
                      alCerrar={() => setDispensando(null)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-tinta-suave">
                    No hay nadie en ventanilla.{' '}
                    <strong className="text-tinta cifras">{presentes.length}</strong>{' '}
                    {presentes.length === 1 ? 'persona espera' : 'personas esperan'}.
                  </p>
                  <Boton variante="primario" tamano="lg" icono={Megaphone}
                    onClick={llamarSiguiente} disabled={ocupado || presentes.length === 0}>
                    Llamar siguiente
                  </Boton>
                </div>
              )}
            </Panel>

            {/* Presentes, en el orden en que serán llamados */}
            <Panel titulo="Esperando en la farmacia" descripcion="En el orden en que serán llamados" sinRelleno>
              {cargando ? (
                <Cargando texto="Cargando la fila…" />
              ) : presentes.length === 0 ? (
                <EstadoVacio titulo="Nadie está esperando">Los turnos aparecen aquí cuando el paciente llega.</EstadoVacio>
              ) : (
                <Tabla etiqueta="Turnos esperando en la farmacia">
                  <Encabezado>
                    <Th numero className="w-12">#</Th>
                    <Th>Turno</Th>
                    <Th>Paciente</Th>
                    <Th>Tipo</Th>
                    <Th numero>Llegó</Th>
                    <Th>Prioridad</Th>
                    <Th oculto>Acciones</Th>
                  </Encabezado>
                  <Cuerpo>
                    {presentes.map((t, i) => (
                      <Fila key={t.id}>
                        <Td numero className="text-tinta-tenue">{i + 1}</Td>
                        <Td className="font-bold text-base cifras">{t.numero}</Td>
                        <Td>
                          {t.paciente ?? 'Sin nombre'}
                          {t.veces_pausado > 0 && (
                            <span className="block text-xs text-tinta-tenue">
                              Pausado {t.veces_pausado} vez{t.veces_pausado > 1 ? 'es' : ''}
                            </span>
                          )}
                        </Td>
                        <Td className="text-tinta-suave">{t.tipo === 'fisico' ? 'Físico' : 'Virtual'}</Td>
                        <Td numero>{hora(t.hora_llegada)}</Td>
                        <Td><EtiquetaPrioridad prioridad={t.prioridad} /></Td>
                        <Td className="text-right">
                          <BotonAccion color="gris" icono={PauseCircle} ocupado={ocupado}
                            onClick={() => accionTurno(t, 'pausar', 'en pausa')}>
                            Pausar
                          </BotonAccion>
                        </Td>
                      </Fila>
                    ))}
                  </Cuerpo>
                </Tabla>
              )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel titulo="En pausa" descripcion="Llamados que no se presentaron" sinRelleno>
                {cargando ? (
                  <Cargando />
                ) : enPausa.length === 0 ? (
                  <EstadoVacio titulo="No hay turnos en pausa" />
                ) : (
                  <Tabla etiqueta="Turnos en pausa">
                    <Encabezado>
                      <Th>Turno</Th>
                      <Th>Paciente</Th>
                      <Th oculto>Acciones</Th>
                    </Encabezado>
                    <Cuerpo>
                      {enPausa.map((t) => (
                        <Fila key={t.id}>
                          <Td className="font-bold cifras">{t.numero}</Td>
                          <Td>{t.paciente ?? 'Sin nombre'}</Td>
                          <Td className="text-right">
                            <BotonAccion color="gris" icono={Undo2} ocupado={ocupado}
                              onClick={() => accionTurno(t, 'reubicar', 'devuelto a la fila')}>
                              Llegó
                            </BotonAccion>
                          </Td>
                        </Fila>
                      ))}
                    </Cuerpo>
                  </Tabla>
                )}
              </Panel>

              <Panel titulo="Por llegar" descripcion="Turnos virtuales que aún no llegan" sinRelleno>
                {cargando ? (
                  <Cargando />
                ) : porLlegar.length === 0 ? (
                  <EstadoVacio titulo="No hay turnos virtuales pendientes" />
                ) : (
                  <Tabla etiqueta="Turnos por llegar">
                    <Encabezado>
                      <Th>Turno</Th>
                      <Th>Paciente</Th>
                      <Th>Estado</Th>
                    </Encabezado>
                    <Cuerpo>
                      {porLlegar.map((t) => (
                        <Fila key={t.id}>
                          <Td className="font-bold cifras">{t.numero}</Td>
                          <Td>{t.paciente ?? 'Sin nombre'}</Td>
                          <Td><EstadoBadge>{ESTADOS[t.estado]}</EstadoBadge></Td>
                        </Fila>
                      ))}
                    </Cuerpo>
                  </Tabla>
                )}
              </Panel>
            </div>
          </div>

          {/* Columna lateral: registrar turno físico */}
          <RegistrarFisico ocupado={ocupado} ejecutar={ejecutar} />
        </div>
      </div>
    </div>
  );
}

// Registro de turno físico (RN-17): con la fórmula del paciente o solo con su nombre
function RegistrarFisico({ ocupado, ejecutar }) {
  const [conFormula, setConFormula] = useState(true);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [documento, setDocumento] = useState('');
  const [prioridad, setPrioridad] = useState('ninguna');

  const enviar = (e) => {
    e.preventDefault();
    const cuerpo = conFormula ? { codigo, documento, prioridad } : { nombre, prioridad };
    ejecutar(
      async () => {
        const r = await api('/fila/fisico', { metodo: 'POST', cuerpo });
        setNombre('');
        setCodigo('');
        setDocumento('');
        setPrioridad('ninguna');
        return r;
      },
      (r) => `Turno ${r.turno.numero} registrado`
    );
  };

  return (
    <Panel titulo="Registrar turno físico" descripcion="Para quien llega sin turno virtual">
      <form onSubmit={enviar} className="space-y-4">
        <Segmentado
          etiqueta="Tipo de registro"
          ancho
          valor={conFormula}
          onChange={setConFormula}
          opciones={[
            { valor: true, texto: 'Con fórmula' },
            { valor: false, texto: 'Solo nombre' },
          ]}
        />

        {conFormula ? (
          <>
            <Campo id="f-codigo" etiqueta="Código de la fórmula">
              <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)}
                placeholder="F-2026-0001" className="uppercase cifras" />
            </Campo>
            <Campo id="f-documento" etiqueta="Documento del paciente">
              <Entrada value={documento} onChange={(e) => setDocumento(e.target.value)}
                inputMode="numeric" className="cifras" />
            </Campo>
          </>
        ) : (
          <Campo id="f-nombre" etiqueta="Nombre del paciente">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
        )}

        <Campo id="f-prioridad" etiqueta="Prioridad">
          <Selector value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            {Object.entries(PRIORIDADES).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </Selector>
        </Campo>

        <Boton type="submit" variante="primario" icono={UserPlus} disabled={ocupado} ancho>
          Dar turno
        </Boton>
      </form>
    </Panel>
  );
}
