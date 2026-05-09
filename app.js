import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ══ FIREBASE CONFIG ══ */
const firebaseConfig = {
  apiKey:            "AIzaSyAQthtgF_PkDRq6M918ZBawK0wqfGjNfR8",
  authDomain:        "calidad-8b098.firebaseapp.com",
  projectId:         "calidad-8b098",
  storageBucket:     "calidad-8b098.firebasestorage.app",
  messagingSenderId: "240923478785",
  appId:             "1:240923478785:web:400495e393c98001f3a900"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = "calidad-romero";   // colección visible en Firestore

/* ══ USUARIOS ══ */
const USERS = {
  "calidad1":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad 1" },
  "calidad2":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad 2" },
  "pasante1":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante 1" },
  "pasante2":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante 2" },
  "Admin":     { password: "Admin.2026",    role: "admin",        nombre: "Administrador" },
  "viewer":    { password: "Viewer.2026",   role: "visualizador", nombre: "Visualizador" },
};

/* ══ STATE ══ */
const state = {
  role:           null,
  currentUser:    '',
  registros:      [],
  turnoActivo:    null,
  unsubRegistros: null,
};

/* ══ UTILS ══ */
function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ══ FIRESTORE ══ */
function suscribirRegistros() {
  const q = query(collection(db, COL), orderBy('timestamp', 'desc'));
  state.unsubRegistros = onSnapshot(q, snap => {
    state.registros = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    refrescarVistas();
  }, err => showToast('Error Firestore: ' + err.message, true));
}

function refrescarVistas() {
  const tabH    = document.getElementById('tab-historial');
  const tabVisH = document.getElementById('tab-vis-partes');
  if (tabH    && tabH.classList.contains('active'))
    renderHistorial('historial-list', 'filtro-desde', 'filtro-hasta', 'filtro-turno', 'filtro-usuario');
  if (tabVisH && tabVisH.classList.contains('active'))
    renderHistorial('vis-historial-list', 'vis-filtro-desde', 'vis-filtro-hasta', 'vis-filtro-turno', 'vis-filtro-usuario');
}

/* ══ LOGIN ══ */
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.role = btn.dataset.role;
  });
});

['login-user', 'login-pass'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

document.getElementById('login-btn').addEventListener('click', doLogin);

function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  if (!username || !password) { showToast('Ingresá usuario y contraseña', true); return; }
  if (!state.role)            { showToast('Seleccioná un rol', true); return; }

  const user = USERS[username];
  if (!user || user.password !== password) { showToast('Usuario o contraseña incorrectos', true); return; }
  if (user.role !== state.role) { showToast(`Este usuario es "${user.role}"`, true); return; }

  state.currentUser = user.nombre;
  document.getElementById('screen-login').style.display = 'none';

  if (state.role === 'visualizador') {
    document.getElementById('screen-vis').style.display = 'flex';
    document.getElementById('vis-nombre').textContent   = user.nombre;
  } else {
    document.getElementById('screen-main').style.cssText =
      'display:flex;flex-direction:column;min-height:100vh;width:100%';
    document.getElementById('main-nombre').textContent = user.nombre;
    const tag = document.getElementById('main-role-tag');
    const tagLabels = { admin: 'ADMIN', calidad: 'CALIDAD', pasante: 'PASANTE' };
    tag.textContent = tagLabels[state.role] || state.role.toUpperCase();
    tag.className   = 'role-tag ' + state.role;

    if (state.role === 'pasante') {
      const tabHist = document.querySelector('#tabs-main .vis-tab[data-tab="tab-historial"]');
      if (tabHist) tabHist.style.display = 'none';
    }

    actualizarFecha();
    setInterval(actualizarFecha, 60000);
  }
  suscribirRegistros();
}

window.doLogout = function() {
  if (state.unsubRegistros) state.unsubRegistros();
  state.role        = null;
  state.currentUser = '';
  state.registros   = [];
  state.turnoActivo = null;
  document.getElementById('screen-main').style.display = 'none';
  document.getElementById('screen-vis').style.display  = 'none';
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
};

function actualizarFecha() {
  const el = document.getElementById('fecha-actual');
  if (!el) return;
  const ahora = new Date();
  el.textContent =
    ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ══ TABS ══ */
document.querySelectorAll('#tabs-main .vis-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'tab-historial')
      renderHistorial('historial-list', 'filtro-desde', 'filtro-hasta', 'filtro-turno', 'filtro-usuario');
  });
});

/* ══ TURNO ══ */
document.querySelectorAll('.turno-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.turno-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.turnoActivo = btn.dataset.turno;
  });
});

/* ══ SECCIONES ══ */
document.querySelectorAll('.seccion-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => irSeccion(btn.dataset.sec));
});

window.irSeccion = function(id) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.seccion-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector(`.seccion-nav-btn[data-sec="${id}"]`).classList.add('active');
  document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ══ ESTADO CHECK BUTTONS ══ */
document.querySelectorAll('.estado-check-grid').forEach(grid => {
  grid.querySelectorAll('.estado-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.estado-check-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
});

/* ══ LEER FORMULARIO ══ */
function leerCampo(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function leerRadio(name) {
  const sel = document.querySelector(`input[name="${name}"]:checked`);
  return sel ? sel.value : '';
}

// Lee el check btn seleccionado dentro de un campo específico por índice dentro de su sección
function leerEstadoEnSec(secId, fieldIndex) {
  const campos = document.querySelectorAll(`#${secId} .field`);
  if (!campos[fieldIndex]) return '';
  const sel = campos[fieldIndex].querySelector('.estado-check-btn.selected');
  return sel ? sel.dataset.val : '';
}

function leerFormulario() {
  return {
    recepcion: {
      empaque_estado: leerEstadoEnSec('sec-recepcion', 0),
      empaque_obs:    leerCampo('rec-empaque-obs'),
      vto_estado:     leerEstadoEnSec('sec-recepcion', 2),
      vto_obs:        leerCampo('rec-vto-obs'),
    },
    formulacion: {
      stock_estado:  leerEstadoEnSec('sec-formulacion', 0),
      stock_obs:     leerCampo('form-stock-obs'),
      sector_estado: leerEstadoEnSec('sec-formulacion', 2),
      sector_obs:    leerCampo('form-sector-obs'),
      pesos:         leerCampo('form-pesos'),
    },
    fabricacion: {
      molino:   leerRadio('fab-molino'),
      gluten:   leerCampo('fab-gluten'),
      silo1:    leerCampo('fab-silo1'),
      silo2:    leerCampo('fab-silo2'),
      aceite1:  leerCampo('fab-aceite1'),
      aceite2:  leerCampo('fab-aceite2'),
      frio:     leerCampo('fab-frio'),
      balanza:  leerCampo('fab-balanza'),
      tagua:    leerCampo('fab-tagua'),
      producto: leerCampo('fab-producto'),
      obs:      leerCampo('fab-obs'),
    },
    camara: {
      set_temp: leerCampo('cam-set-temp'),
      temp:     leerCampo('cam-temp'),
      set_hum:  leerCampo('cam-set-hum'),
      hum:      leerCampo('cam-hum'),
      tiempo:   leerCampo('cam-tiempo'),
      obs:      leerCampo('cam-obs'),
    },
    horno: {
      set_z1:      leerCampo('horn-set-z1'),
      z1:          leerCampo('horn-z1'),
      set_z2:      leerCampo('horn-set-z2'),
      z2:          leerCampo('horn-z2'),
      tiempo:      leerCampo('horn-tiempo'),
      transportes: leerCampo('horn-transportes'),
    },
    enfriador: {
      receta:       leerCampo('enf-receta'),
      desmoldeador: leerCampo('enf-desmoldeador'),
    },
    detector: {
      receta:       leerCampo('det-receta'),
      sensibilidad: leerCampo('det-sensibilidad'),
      patrones:     leerCampo('det-patrones'),
    },
    envase: {
      producto: leerCampo('env-producto'),
      paquete:  leerCampo('env-paquete'),
      lote:     leerCampo('env-lote'),
      vto:      leerCampo('env-vto'),
    },
    bolsas: {
      producto:   leerCampo('bol-producto'),
      bobinado:   leerCampo('bol-bobinado'),
      taco:       leerCampo('bol-taco'),
      corte_circ: leerCampo('bol-corte-circ'),
      corte_rect: leerCampo('bol-corte-rect'),
    },
  };
}

function limpiarFormulario() {
  document.querySelectorAll('#tab-nuevo input[type="text"], #tab-nuevo textarea')
    .forEach(el => el.value = '');
  document.querySelectorAll('#tab-nuevo input[type="radio"]')
    .forEach(el => el.checked = false);
  document.querySelectorAll('.estado-check-btn.selected, .turno-btn.selected')
    .forEach(el => el.classList.remove('selected'));
  state.turnoActivo = null;
  irSeccion('sec-recepcion');
}

/* ══ GUARDAR REGISTRO ══ */
document.getElementById('btn-guardar-registro').addEventListener('click', async () => {
  if (!state.turnoActivo) { showToast('Seleccioná el turno antes de guardar', true); return; }

  const datos = leerFormulario();

  const tieneDatos = Object.values(datos).some(sec =>
    Object.values(sec).some(v => v && v.trim && v.trim() !== '')
  );
  if (!tieneDatos) { showToast('Completá al menos una sección antes de guardar', true); return; }

  const secLabels = {
    recepcion: 'Recepción MP', formulacion: 'Formulación',
    fabricacion: 'Fabricación', camara: 'Cámara',
    horno: 'Horno', enfriador: 'Enfriador',
    detector: 'Detector', envase: 'Envase', bolsas: 'Bolsas'
  };
  const seccionesConDatos = [];
  Object.entries(datos).forEach(([key, sec]) => {
    if (Object.values(sec).some(v => v && v.trim && v.trim() !== ''))
      seccionesConDatos.push(secLabels[key] || key);
  });

  const ahora = new Date();
  const registro = {
    timestamp:  ahora.getTime(),
    fecha:      ahora.toISOString(),
    turno:      state.turnoActivo,
    usuario:    state.currentUser,
    rol:        state.role,
    secciones:  seccionesConDatos,
    ...datos,
  };

  const btn = document.getElementById('btn-guardar-registro');
  btn.disabled    = true;
  btn.textContent = 'GUARDANDO...';

  try {
    await addDoc(collection(db, COL), registro);
    showToast('✓ Registro guardado correctamente');
    limpiarFormulario();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
    console.error(e);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'GUARDAR REGISTRO ✓';
  }
});

/* ══ FILTROS ══ */
document.getElementById('btn-filtrar').addEventListener('click', () =>
  renderHistorial('historial-list', 'filtro-desde', 'filtro-hasta', 'filtro-turno', 'filtro-usuario'));

document.getElementById('btn-limpiar').addEventListener('click', () => {
  ['filtro-desde','filtro-hasta','filtro-turno','filtro-usuario']
    .forEach(id => { document.getElementById(id).value = ''; });
  renderHistorial('historial-list', 'filtro-desde', 'filtro-hasta', 'filtro-turno', 'filtro-usuario');
});

document.getElementById('vis-btn-filtrar').addEventListener('click', () =>
  renderHistorial('vis-historial-list', 'vis-filtro-desde', 'vis-filtro-hasta', 'vis-filtro-turno', 'vis-filtro-usuario'));

document.getElementById('vis-btn-limpiar').addEventListener('click', () => {
  ['vis-filtro-desde','vis-filtro-hasta','vis-filtro-turno','vis-filtro-usuario']
    .forEach(id => { document.getElementById(id).value = ''; });
  renderHistorial('vis-historial-list', 'vis-filtro-desde', 'vis-filtro-hasta', 'vis-filtro-turno', 'vis-filtro-usuario');
});

/* ══ HISTORIAL ══ */
function renderHistorial(listId, desdeId, hastaId, turnoId, usuarioId) {
  const list = document.getElementById(listId);
  if (!list) return;

  const desde   = document.getElementById(desdeId)?.value   || '';
  const hasta   = document.getElementById(hastaId)?.value   || '';
  const turno   = document.getElementById(turnoId)?.value   || '';
  const usuario = (document.getElementById(usuarioId)?.value || '').toLowerCase().trim();

  let items = [...state.registros];
  if (desde)   items = items.filter(r => r.fecha.slice(0,10) >= desde);
  if (hasta)   items = items.filter(r => r.fecha.slice(0,10) <= hasta);
  if (turno)   items = items.filter(r => r.turno === turno);
  if (usuario) items = items.filter(r => r.usuario.toLowerCase().includes(usuario));

  if (!items.length) {
    list.innerHTML = '<div class="empty-msg">No hay registros para los filtros aplicados.</div>';
    return;
  }

  const turnoLabel = { 'mañana': 'MAÑANA', 'tarde': 'TARDE', 'noche': 'NOCHE' };

  list.innerHTML = items.map(r => `
    <div class="registro-card" onclick="verRegistro('${r.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">Registro de Calidad</div>
        <span class="badge-turno ${r.turno}">${turnoLabel[r.turno] || r.turno}</span>
      </div>
      <div class="registro-meta">${formatFecha(r.fecha)} · ${r.usuario}</div>
      <div class="secciones-completadas">
        ${(r.secciones||[]).map(s => `<span class="sec-tag">${s}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

/* ══ MODAL VER REGISTRO ══ */
window.verRegistro = function(firestoreId) {
  const r = state.registros.find(x => x.firestoreId === firestoreId);
  if (!r) return;

  document.getElementById('modal-titulo').textContent = 'Registro de Calidad';
  document.getElementById('modal-meta').textContent   =
    `${formatFecha(r.fecha)} · ${r.usuario} · Turno ${r.turno}`;

  const colorVal = (v) => {
    if (!v) return 'modal-campo-valor';
    const ok   = ['Bueno','OK','A largo plazo'];
    const warn = ['Regular','Bajo','Próximo'];
    const bad  = ['Malo','Sin stock','Vencido'];
    if (ok.includes(v))   return 'modal-campo-valor ok';
    if (warn.includes(v)) return 'modal-campo-valor warn';
    if (bad.includes(v))  return 'modal-campo-valor danger';
    return 'modal-campo-valor';
  };

  const campo = (label, val) => val
    ? `<div class="modal-campo">
        <div class="modal-campo-label">${label}</div>
        <div class="${colorVal(val)}">${val}</div>
       </div>`
    : '';

  const seccion = (titulo, campos) => {
    const contenido = campos.filter(Boolean).join('');
    return contenido
      ? `<div class="modal-seccion">
          <div class="modal-seccion-title">${titulo}</div>
          ${contenido}
         </div>`
      : '';
  };

  document.getElementById('modal-body').innerHTML = [
    seccion('📦 Recepción MP', [
      campo('Empaque', r.recepcion?.empaque_estado),
      campo('Obs. empaque', r.recepcion?.empaque_obs),
      campo('Vencimiento', r.recepcion?.vto_estado),
      campo('Obs. vto.', r.recepcion?.vto_obs),
    ]),
    seccion('Formulación', [
      campo('Stock', r.formulacion?.stock_estado),
      campo('Obs. stock', r.formulacion?.stock_obs),
      campo('Estado sector', r.formulacion?.sector_estado),
      campo('Obs. sector', r.formulacion?.sector_obs),
      campo('Pesos pesadas', r.formulacion?.pesos),
    ]),
    seccion('🏭 Fabricación', [
      campo('Molino', r.fabricacion?.molino),
      campo('Gluten', r.fabricacion?.gluten),
      campo('Silo 1', r.fabricacion?.silo1),
      campo('Silo 2', r.fabricacion?.silo2),
      campo('Aceite 1', r.fabricacion?.aceite1),
      campo('Aceite 2', r.fabricacion?.aceite2),
      campo('Equipo frío', r.fabricacion?.frio),
      campo('Balanza tolva', r.fabricacion?.balanza),
      campo('Tº agua', r.fabricacion?.tagua),
      campo('Producto/bollo', r.fabricacion?.producto),
      campo('Observaciones', r.fabricacion?.obs),
    ]),
    seccion('🌡️ Cámara de Fermento', [
      campo('Set temperatura', r.camara?.set_temp),
      campo('Temperatura', r.camara?.temp),
      campo('Set humedad', r.camara?.set_hum),
      campo('Humedad', r.camara?.hum),
      campo('Tiempo fermento', r.camara?.tiempo),
      campo('Observaciones', r.camara?.obs),
    ]),
    seccion('🔥 Horno', [
      campo('Set zona 1', r.horno?.set_z1),
      campo('Zona 1', r.horno?.z1),
      campo('Set zona 2', r.horno?.set_z2),
      campo('Zona 2', r.horno?.z2),
      campo('Tiempo cocción', r.horno?.tiempo),
      campo('Transportes', r.horno?.transportes),
    ]),
    seccion('❄️ Enfriador', [
      campo('Receta', r.enfriador?.receta),
      campo('Desmoldeador', r.enfriador?.desmoldeador),
    ]),
    seccion('🔍 Detector de Metales', [
      campo('Receta', r.detector?.receta),
      campo('Sensibilidad', r.detector?.sensibilidad),
      campo('Patrones', r.detector?.patrones),
    ]),
    seccion('📦 Envase', [
      campo('Producto', r.envase?.producto),
      campo('Paquete', r.envase?.paquete),
      campo('Lote', r.envase?.lote),
      campo('Vencimiento', r.envase?.vto),
    ]),
    seccion('Bolsas y Rollos', [
      campo('Producto', r.bolsas?.producto),
      campo('Bobinado', r.bolsas?.bobinado),
      campo('Taco', r.bolsas?.taco),
      campo('Corte circular', r.bolsas?.corte_circ),
      campo('Corte recto', r.bolsas?.corte_rect),
    ]),
  ].join('');

  document.getElementById('modal-overlay').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal();
});

/* ══ TABS VISUALIZADOR ══ */
document.querySelectorAll('#screen-vis .vis-tab')?.forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#screen-vis .vis-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#screen-vis .vis-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.tab);
    if (target) {
      target.classList.add('active');
      renderHistorial('vis-historial-list', 'vis-filtro-desde', 'vis-filtro-hasta', 'vis-filtro-turno', 'vis-filtro-usuario');
    }
  });
});
