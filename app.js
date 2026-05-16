import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ══ FIREBASE ══ */
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
const COL_REG     = "calidad-romero";
const COL_SCORING = "calidad-scoring";

/* ══ ROLES CON PERMISO CRUD ══ */
const ROLES_CRUD = ['admin', 'calidad'];

/* ══ USUARIOS ══ */
const USERS = {
  "calidad1":  { password: "Calidad.2026",  role: "calidad",      nombre: "Mili" },
  "calidad2":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad" },
  "pasanteM":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TM" },
  "pasanteT":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TT" },
  "admin":     { password: "Admin.2026",    role: "admin",        nombre: "Administrador" },
  "viewer":    { password: "Viewer.2026",   role: "visualizador", nombre: "Visualizador" },
};

/* ══ PRODUCTOS SCORING ══ */
const PRODUCTOS_BOLLERIA = ['Pancho', 'Hamburguesa', 'Super', 'Max'];
const PRODUCTOS_MOLDE    = [
  'Lacteado Familiar', 'Lacteado Chico',
  'Salvado Familiar',  'Salvado Chico',
  'Integral',          'Multicereal'
];

/* ══ STATE ══ */
const state = {
  role: null, currentUser: '',
  registros: [], scorings: [],
  turnoActivo: null,
  turnoScoringActivo: null,
  categoriaActiva: 'bolleria',
  historialTipo: 'registros',
  transportes: { t1: null, t2: null, t3: null },
  unsubReg: null, unsubSco: null,
  editandoId: null,
  editandoColeccion: null,
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

function leerCampo(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function leerRadio(name) {
  const sel = document.querySelector(`input[name="${name}"]:checked`);
  return sel ? sel.value : '';
}

function leerEstadoEnSec(secId, fieldIndex) {
  const campos = document.querySelectorAll(`#${secId} .field`);
  if (!campos[fieldIndex]) return '';
  const sel = campos[fieldIndex].querySelector('.estado-check-btn.selected');
  return sel ? sel.dataset.val : '';
}

function canCRUD() {
  return ROLES_CRUD.includes(state.role);
}

/* ══ FIRESTORE ══ */
function suscribirRegistros() {
  const q = query(collection(db, COL_REG), orderBy('timestamp', 'desc'));
  state.unsubReg = onSnapshot(q, snap => {
    state.registros = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    refrescarVistas();
  }, err => showToast('Error Firestore registros: ' + err.message, true));
}

function suscribirScoring() {
  const q = query(collection(db, COL_SCORING), orderBy('timestamp', 'desc'));
  state.unsubSco = onSnapshot(q, snap => {
    state.scorings = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    refrescarVistas();
  }, err => showToast('Error Firestore scoring: ' + err.message, true));
}

/* ══ REFRESCAR VISTAS ══ */
function refrescarVistas() {
  if (document.getElementById('historial-list'))     renderHistorial();
  if (document.getElementById('vis-historial-list')) renderHistorialVis();
  if (document.getElementById('vis-scoring-list'))   renderScoringVis();
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
  document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
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
    const tagLabels = { admin:'ADMIN', calidad:'CALIDAD', pasante:'PASANTE' };
    tag.textContent = tagLabels[state.role] || state.role.toUpperCase();
    tag.className   = 'role-tag ' + state.role;

    if (state.role === 'pasante') {
      const tabHist = document.querySelector('#tabs-main .vis-tab[data-tab="tab-historial"]');
      if (tabHist) tabHist.style.display = 'none';
    }
    actualizarFechas();
    setInterval(actualizarFechas, 60000);
  }
  suscribirRegistros();
  suscribirScoring();
}

window.doLogout = function() {
  if (state.unsubReg) state.unsubReg();
  if (state.unsubSco) state.unsubSco();
  Object.assign(state, {
    role:null, currentUser:'', registros:[], scorings:[],
    turnoActivo:null, turnoScoringActivo:null,
    editandoId:null, editandoColeccion:null
  });
  document.getElementById('screen-main').style.display = 'none';
  document.getElementById('screen-vis').style.display  = 'none';
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
};

function actualizarFechas() {
  const ahora = new Date();
  const txt = ahora.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }) +
              ' · ' + ahora.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  ['fecha-actual','fecha-scoring'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  });
}

/* ══ TABS MAIN ══ */
document.querySelectorAll('#tabs-main .vis-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'tab-historial') renderHistorial();
  });
});

/* ══ TABS VISUALIZADOR ══ */
document.querySelectorAll('#screen-vis .vis-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#screen-vis .vis-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#screen-vis .vis-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.tab);
    if (target) {
      target.classList.add('active');
      if (tab.dataset.tab === 'tab-vis-partes')  renderHistorialVis();
      if (tab.dataset.tab === 'tab-vis-scoring') renderScoringVis();
    }
  });
});

/* ══ TURNO (registro) ══ */
document.querySelectorAll('.turno-btn:not(.turno-scoring)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.turno-btn:not(.turno-scoring)').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.turnoActivo = btn.dataset.turno;
  });
});

/* ══ TURNO (scoring) ══ */
document.querySelectorAll('.turno-btn.turno-scoring').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.turno-btn.turno-scoring').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.turnoScoringActivo = btn.dataset.turno;
  });
});

/* ══ CATEGORÍA SCORING ══ */
document.querySelectorAll('.categoria-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.categoriaActiva = btn.dataset.cat;
    ['bolleria','molde'].forEach(cat => {
      const gEl = document.getElementById(`scoring-productos-${cat}`);
      const fEl = document.getElementById(`scoring-form-${cat}`);
      if (gEl) gEl.classList.toggle('active', cat === btn.dataset.cat);
      if (fEl) fEl.classList.toggle('active', cat === btn.dataset.cat);
    });
  });
});

/* ══ BUSCADOR PRODUCTO SCORING ══ */
function initBuscadorProducto(inputId, listId, productos) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  if (!input || !list) return;

  function renderOpciones(filtro) {
    const filtrados = productos.filter(p => p.toLowerCase().includes(filtro.toLowerCase()));
    list.innerHTML = filtrados.map(p =>
      `<div class="producto-option" data-val="${p}">${p}</div>`
    ).join('');
    list.style.display = filtrados.length ? 'block' : 'none';
  }

  input.addEventListener('input',  () => renderOpciones(input.value));
  input.addEventListener('focus',  () => renderOpciones(input.value));
  list.addEventListener('mousedown', e => {
    const opt = e.target.closest('.producto-option');
    if (opt) {
      input.value = opt.dataset.val;
      list.style.display = 'none';
    }
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !list.contains(e.target)) list.style.display = 'none';
  });
}

initBuscadorProducto('sc-bol-producto-input', 'sc-bol-producto-list', PRODUCTOS_BOLLERIA);
initBuscadorProducto('sc-mol-producto-input', 'sc-mol-producto-list', PRODUCTOS_MOLDE);

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

/* ══ ESTADO CHECK ══ */
document.querySelectorAll('.estado-check-grid').forEach(grid => {
  grid.querySelectorAll('.estado-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.estado-check-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
});

/* ══ TRANSPORTES ══ */
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.t;
    document.querySelectorAll(`.transport-btn[data-t="${t}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.transportes[t] = btn.dataset.v;
  });
});

/* ══ CÁMARA — producto "Otro" ══ */
document.getElementById('cam-producto')?.addEventListener('change', function() {
  const wrap = document.getElementById('cam-producto-otro-wrap');
  if (wrap) wrap.style.display = this.value === 'Otro' ? 'block' : 'none';
});

/* ══ HORNO — producto "Otro" ══ */
document.getElementById('horn-producto')?.addEventListener('change', function() {
  const wrap = document.getElementById('horn-producto-otro-wrap');
  if (wrap) wrap.style.display = this.value === 'Otro' ? 'block' : 'none';
});

/* ══ LEER FORMULARIO REGISTRO ══ */
function leerFormulario() {
  const camProd  = leerCampo('cam-producto')  === 'Otro' ? leerCampo('cam-producto-otro')  : leerCampo('cam-producto');
  const hornProd = leerCampo('horn-producto') === 'Otro' ? leerCampo('horn-producto-otro') : leerCampo('horn-producto');
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
      set_temp:     leerCampo('cam-set-temp'),
      temp:         leerCampo('cam-temp'),
      set_hum:      leerCampo('cam-set-hum'),
      hum:          leerCampo('cam-hum'),
      producto:     camProd,
      hora_entrada: leerCampo('cam-hora-entrada'),
      hora_salida:  leerCampo('cam-hora-salida'),
      obs:          leerCampo('cam-obs'),
    },
    horno: {
      set_z1:        leerCampo('horn-set-z1'),
      z1:            leerCampo('horn-z1'),
      set_z2:        leerCampo('horn-set-z2'),
      z2:            leerCampo('horn-z2'),
      producto:      hornProd,
      tiempo_min:    leerCampo('horn-tiempo'),
      t1:            state.transportes.t1 || '',
      t2:            state.transportes.t2 || '',
      t3:            state.transportes.t3 || '',
      transport_obs: leerCampo('horn-transport-obs'),
    },
    enfriador: {
      receta:       leerCampo('enf-receta'),
      desmoldeador: leerCampo('enf-desmoldeador'),
    },
    detector: {
      receta:       leerCampo('det-receta'),
      sensibilidad: leerCampo('det-sensibilidad'),
      hora_cambio:  leerCampo('det-hora-cambio'),
      patrones:     leerCampo('det-patrones'),
    },
    envase: {
      producto: leerCampo('env-producto'),
      paquete:  leerCampo('env-paquete'),
      lote:     leerCampo('env-lote'),
      vto:      leerCampo('env-vto'),
      obs:      leerCampo('env-obs'),
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
  document.querySelectorAll('#tab-nuevo input[type="text"], #tab-nuevo input[type="number"], #tab-nuevo input[type="time"], #tab-nuevo textarea, #tab-nuevo select')
    .forEach(el => el.value = '');
  document.querySelectorAll('#tab-nuevo input[type="radio"]').forEach(el => el.checked = false);
  document.querySelectorAll('.estado-check-btn.selected, .turno-btn:not(.turno-scoring).selected')
    .forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.transport-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('#cam-producto-otro-wrap, #horn-producto-otro-wrap').forEach(el => el.style.display = 'none');
  state.turnoActivo = null;
  state.transportes = { t1: null, t2: null, t3: null };
  state.editandoId = null;
  state.editandoColeccion = null;
  const btn = document.getElementById('btn-guardar-registro');
  if (btn) btn.textContent = 'GUARDAR REGISTRO ✓';
  irSeccion('sec-recepcion');
}

/* ══ GUARDAR / ACTUALIZAR REGISTRO ══ */
document.getElementById('btn-guardar-registro').addEventListener('click', async () => {
  if (!state.turnoActivo) { showToast('Seleccioná el turno antes de guardar', true); return; }
  const datos = leerFormulario();
  const tieneDatos = Object.values(datos).some(sec =>
    Object.values(sec).some(v => v && v.trim && v.trim() !== '')
  );
  if (!tieneDatos) { showToast('Completá al menos una sección antes de guardar', true); return; }

  const secLabels = {
    recepcion:'Recepción MP', formulacion:'Formulación', fabricacion:'Fabricación',
    camara:'Cámara', horno:'Horno', enfriador:'Enfriador',
    detector:'Detector', envase:'Envase', bolsas:'Bolsas'
  };
  const seccionesConDatos = [];
  Object.entries(datos).forEach(([key, sec]) => {
    if (Object.values(sec).some(v => v && v.trim && v.trim() !== ''))
      seccionesConDatos.push(secLabels[key] || key);
  });

  const btn = document.getElementById('btn-guardar-registro');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';

  try {
    if (state.editandoId && state.editandoColeccion === COL_REG) {
      const ahora = new Date();
      await updateDoc(doc(db, COL_REG, state.editandoId), {
        turno: state.turnoActivo,
        secciones: seccionesConDatos,
        editado: true,
        fechaEdicion: ahora.toISOString(),
        ...datos,
      });
      showToast('✓ Registro actualizado correctamente');
    } else {
      const ahora = new Date();
      await addDoc(collection(db, COL_REG), {
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        turno: state.turnoActivo, usuario: state.currentUser, rol: state.role,
        secciones: seccionesConDatos, tipo: 'registro', ...datos,
      });
      showToast('✓ Registro guardado correctamente');
    }
    limpiarFormulario();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
    btn.disabled = false;
    btn.textContent = state.editandoId ? 'ACTUALIZAR REGISTRO ✓' : 'GUARDAR REGISTRO ✓';
  }
});

/* ══ LEER SCORING ══ */
function leerScoring() {
  const cat = state.categoriaActiva;
  if (cat === 'bolleria') {
    return { categoria: cat,
      producto:  document.getElementById('sc-bol-producto-input')?.value.trim() || '',
      lote:      leerCampo('sc-bol-lote'),
      vto:       leerCampo('sc-bol-vto'),
      peso:      leerCampo('sc-bol-peso'),
      color:     leerCampo('sc-bol-color'),
      base_:     leerCampo('sc-bol-base'),
      altura:    leerCampo('sc-bol-altura'),
      desgarro:  leerCampo('sc-bol-desgarro'),
      manchas:   leerCampo('sc-bol-manchas'),
      harina:    leerCampo('sc-bol-harina'),
      estrias:   leerCampo('sc-bol-estrias'),
      estivado:  leerCampo('sc-bol-estivado'),
      miga:      leerCampo('sc-bol-miga'),
    };
  }
  if (cat === 'molde') {
    return { categoria: cat,
      producto:  document.getElementById('sc-mol-producto-input')?.value.trim() || '',
      lote:      leerCampo('sc-mol-lote'),
      vto:       leerCampo('sc-mol-vto'),
      peso:      leerCampo('sc-mol-peso'),
      color:     leerCampo('sc-mol-color'),
      altura:    leerCampo('sc-mol-altura'),
      forma:     leerCampo('sc-mol-forma'),
      estivado:  leerCampo('sc-mol-estivado'),
      miga:      leerCampo('sc-mol-miga'),
      reb_c:     leerCampo('sc-mol-reb-c'),
      reb_g:     leerCampo('sc-mol-reb-g'),
      coccion:   leerCampo('sc-mol-coccion'),
      embollado: leerCampo('sc-mol-embollado'),
      desgarro:  leerCampo('sc-mol-desgarro'),
    };
  }
  return { categoria: cat };
}

function limpiarScoring() {
  document.querySelectorAll('#tab-scoring input[type="text"]').forEach(el => el.value = '');
  document.querySelectorAll('.turno-btn.turno-scoring.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.producto-dropdown').forEach(el => el.style.display = 'none');
  state.turnoScoringActivo = null;
  state.editandoId = null;
  state.editandoColeccion = null;
  const btn = document.getElementById('btn-guardar-scoring');
  if (btn) btn.textContent = 'GUARDAR SCORING ✓';
}

/* ══ GUARDAR / ACTUALIZAR SCORING ══ */
document.getElementById('btn-guardar-scoring').addEventListener('click', async () => {
  if (!state.turnoScoringActivo) { showToast('Seleccioná el turno', true); return; }
  const datos = leerScoring();
  if (!datos.producto) { showToast('Seleccioná un producto', true); return; }
  const tieneDatos = Object.entries(datos)
    .filter(([k]) => !['categoria','producto'].includes(k))
    .some(([, v]) => v && v.trim && v.trim() !== '');
  if (!tieneDatos) { showToast('Completá al menos un campo del scoring', true); return; }

  const btn = document.getElementById('btn-guardar-scoring');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';

  try {
    if (state.editandoId && state.editandoColeccion === COL_SCORING) {
      const ahora = new Date();
      await updateDoc(doc(db, COL_SCORING, state.editandoId), {
        turno: state.turnoScoringActivo,
        editado: true,
        fechaEdicion: ahora.toISOString(),
        ...datos,
      });
      showToast('✓ Scoring actualizado correctamente');
    } else {
      const ahora = new Date();
      await addDoc(collection(db, COL_SCORING), {
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        turno: state.turnoScoringActivo, usuario: state.currentUser, rol: state.role,
        tipo: 'scoring', ...datos,
      });
      showToast('✓ Scoring guardado correctamente');
    }
    limpiarScoring();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
    btn.disabled = false;
    btn.textContent = state.editandoId ? 'ACTUALIZAR SCORING ✓' : 'GUARDAR SCORING ✓';
  }
});

/* ══ HISTORIAL TIPO ══ */
document.querySelectorAll('.filtro-tipo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-tipo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.historialTipo = btn.dataset.tipo;
    renderHistorial();
  });
});

/* ══ FILTROS ══ */
document.getElementById('btn-filtrar')?.addEventListener('click', renderHistorial);
document.getElementById('btn-limpiar')?.addEventListener('click', () => {
  ['filtro-desde','filtro-hasta','filtro-turno','filtro-usuario'].forEach(id => { document.getElementById(id).value = ''; });
  renderHistorial();
});
document.getElementById('vis-btn-filtrar')?.addEventListener('click', renderHistorialVis);
document.getElementById('vis-btn-limpiar')?.addEventListener('click', () => {
  ['vis-filtro-desde','vis-filtro-hasta','vis-filtro-turno','vis-filtro-usuario'].forEach(id => { document.getElementById(id).value = ''; });
  renderHistorialVis();
});

/* ══ HELPERS RENDER ══ */
function getFilters(prefix = '') {
  const p = prefix ? prefix + '-' : '';
  return {
    desde:   document.getElementById(`${p}filtro-desde`)?.value   || '',
    hasta:   document.getElementById(`${p}filtro-hasta`)?.value   || '',
    turno:   document.getElementById(`${p}filtro-turno`)?.value   || '',
    usuario: (document.getElementById(`${p}filtro-usuario`)?.value || '').toLowerCase().trim(),
  };
}

function filtrarItems(arr, f) {
  let items = [...arr];
  if (f.desde)   items = items.filter(r => r.fecha?.slice(0,10) >= f.desde);
  if (f.hasta)   items = items.filter(r => r.fecha?.slice(0,10) <= f.hasta);
  if (f.turno)   items = items.filter(r => r.turno === f.turno);
  if (f.usuario) items = items.filter(r => r.usuario?.toLowerCase().includes(f.usuario));
  return items;
}

function renderHistorial() {
  const list = document.getElementById('historial-list');
  if (!list) return;
  const f = getFilters();
  if (state.historialTipo === 'registros') {
    const items = filtrarItems(state.registros, f);
    list.innerHTML = items.length ? items.map(r => buildRegistroCard(r, true)).join('') : emptyMsg();
  } else {
    const items = filtrarItems(state.scorings, f);
    list.innerHTML = items.length ? items.map(s => buildScoringCard(s, true)).join('') : emptyMsg();
  }
}

function renderHistorialVis() {
  const list = document.getElementById('vis-historial-list');
  if (!list) return;
  const items = filtrarItems(state.registros, getFilters('vis'));
  list.innerHTML = items.length ? items.map(r => buildRegistroCard(r, false)).join('') : emptyMsg();
}

function renderScoringVis() {
  const list = document.getElementById('vis-scoring-list');
  if (!list) return;
  list.innerHTML = state.scorings.length ? state.scorings.map(s => buildScoringCard(s, false)).join('') : emptyMsg();
}

const turnoLabel = { 'mañana':'MAÑANA', 'tarde':'TARDE', 'noche':'NOCHE' };
const catLabel   = { 'bolleria':'BOLLERÍA', 'molde':'PAN DE MOLDE' };

function buildRegistroCard(r, showCrud) {
  const crudHtml = (showCrud && canCRUD()) ? `
    <div class="crud-btns" onclick="event.stopPropagation()">
      <button class="crud-btn edit" onclick="editarRegistro('${r.firestoreId}')">✏️ Editar</button>
      <button class="crud-btn del"  onclick="confirmarEliminar('${r.firestoreId}','${COL_REG}')">🗑️ Eliminar</button>
    </div>` : '';
  const editTag = r.editado ? `<span class="badge-editado">editado</span>` : '';
  return `
    <div class="registro-card" onclick="verRegistro('${r.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">Registro de Calidad ${editTag}</div>
        <span class="badge-turno ${r.turno}">${turnoLabel[r.turno] || r.turno}</span>
      </div>
      <div class="registro-meta">${formatFecha(r.fecha)} · ${r.usuario}</div>
      <div class="secciones-completadas">
        ${(r.secciones||[]).map(s => `<span class="sec-tag">${s}</span>`).join('')}
      </div>
      ${crudHtml}
    </div>`;
}

function buildScoringCard(s, showCrud) {
  const crudHtml = (showCrud && canCRUD()) ? `
    <div class="crud-btns" onclick="event.stopPropagation()">
      <button class="crud-btn edit" onclick="editarScoring('${s.firestoreId}')">✏️ Editar</button>
      <button class="crud-btn del"  onclick="confirmarEliminar('${s.firestoreId}','${COL_SCORING}')">🗑️ Eliminar</button>
    </div>` : '';
  const editTag = s.editado ? `<span class="badge-editado">editado</span>` : '';
  return `
    <div class="registro-card scoring-card" onclick="verScoring('${s.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">${s.producto || 'Scoring'} ${editTag}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge-turno ${s.turno}">${turnoLabel[s.turno] || s.turno}</span>
          <span class="badge-cat">${catLabel[s.categoria] || s.categoria}</span>
        </div>
      </div>
      <div class="registro-meta">${formatFecha(s.fecha)} · ${s.usuario}</div>
      ${crudHtml}
    </div>`;
}

function emptyMsg() {
  return '<div class="empty-msg">No hay registros para los filtros aplicados.</div>';
}

/* ══ CRUD — EDITAR REGISTRO ══ */
window.editarRegistro = function(firestoreId) {
  const r = state.registros.find(x => x.firestoreId === firestoreId);
  if (!r) return;

  // Ir al tab nuevo registro
  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#tabs-main .vis-tab[data-tab="tab-nuevo"]').classList.add('active');
  document.getElementById('tab-nuevo').classList.add('active');

  // Turno
  state.turnoActivo = r.turno;
  document.querySelectorAll('.turno-btn:not(.turno-scoring)').forEach(b => {
    b.classList.toggle('selected', b.dataset.turno === r.turno);
  });

  function setEstado(secId, fieldIndex, val) {
    const campos = document.querySelectorAll(`#${secId} .field`);
    if (!campos[fieldIndex]) return;
    campos[fieldIndex].querySelectorAll('.estado-check-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.val === val);
    });
  }

  // Recepción
  setEstado('sec-recepcion', 0, r.recepcion?.empaque_estado);
  setEstado('sec-recepcion', 2, r.recepcion?.vto_estado);
  [['rec-empaque-obs', r.recepcion?.empaque_obs], ['rec-vto-obs', r.recepcion?.vto_obs]].forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val || '';
  });

  // Formulación
  setEstado('sec-formulacion', 0, r.formulacion?.stock_estado);
  setEstado('sec-formulacion', 2, r.formulacion?.sector_estado);
  [['form-stock-obs', r.formulacion?.stock_obs], ['form-sector-obs', r.formulacion?.sector_obs], ['form-pesos', r.formulacion?.pesos]].forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val || '';
  });

  // Fabricación
  if (r.fabricacion?.molino) {
    document.querySelectorAll(`input[name="fab-molino"]`).forEach(el => { el.checked = el.value === r.fabricacion.molino; });
  }
  Object.entries({ 'fab-gluten':r.fabricacion?.gluten, 'fab-silo1':r.fabricacion?.silo1, 'fab-silo2':r.fabricacion?.silo2,
    'fab-aceite1':r.fabricacion?.aceite1, 'fab-aceite2':r.fabricacion?.aceite2, 'fab-frio':r.fabricacion?.frio,
    'fab-balanza':r.fabricacion?.balanza, 'fab-tagua':r.fabricacion?.tagua, 'fab-producto':r.fabricacion?.producto, 'fab-obs':r.fabricacion?.obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Cámara
  Object.entries({ 'cam-set-temp':r.camara?.set_temp, 'cam-temp':r.camara?.temp, 'cam-set-hum':r.camara?.set_hum,
    'cam-hum':r.camara?.hum, 'cam-hora-entrada':r.camara?.hora_entrada, 'cam-hora-salida':r.camara?.hora_salida, 'cam-obs':r.camara?.obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  const camProd = document.getElementById('cam-producto');
  if (camProd && r.camara?.producto) {
    const exists = [...camProd.options].some(o => o.value === r.camara.producto);
    if (exists) { camProd.value = r.camara.producto; }
    else { camProd.value = 'Otro'; document.getElementById('cam-producto-otro-wrap').style.display = 'block'; document.getElementById('cam-producto-otro').value = r.camara.producto; }
  }

  // Horno
  Object.entries({ 'horn-set-z1':r.horno?.set_z1, 'horn-z1':r.horno?.z1, 'horn-set-z2':r.horno?.set_z2,
    'horn-z2':r.horno?.z2, 'horn-tiempo':r.horno?.tiempo_min, 'horn-transport-obs':r.horno?.transport_obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  const hornProd = document.getElementById('horn-producto');
  if (hornProd && r.horno?.producto) {
    const exists = [...hornProd.options].some(o => o.value === r.horno.producto);
    if (exists) { hornProd.value = r.horno.producto; }
    else { hornProd.value = 'Otro'; document.getElementById('horn-producto-otro-wrap').style.display = 'block'; document.getElementById('horn-producto-otro').value = r.horno.producto; }
  }
  ['t1','t2','t3'].forEach(t => {
    state.transportes[t] = r.horno?.[t] || null;
    document.querySelectorAll(`.transport-btn[data-t="${t}"]`).forEach(b => { b.classList.toggle('selected', b.dataset.v === r.horno?.[t]); });
  });

  // Enfriador
  Object.entries({ 'enf-receta':r.enfriador?.receta, 'enf-desmoldeador':r.enfriador?.desmoldeador })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Detector
  Object.entries({ 'det-receta':r.detector?.receta, 'det-sensibilidad':r.detector?.sensibilidad,
    'det-hora-cambio':r.detector?.hora_cambio, 'det-patrones':r.detector?.patrones })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Envase
  Object.entries({ 'env-producto':r.envase?.producto, 'env-paquete':r.envase?.paquete,
    'env-lote':r.envase?.lote, 'env-vto':r.envase?.vto, 'env-obs':r.envase?.obs })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Bolsas
  Object.entries({ 'bol-producto':r.bolsas?.producto, 'bol-bobinado':r.bolsas?.bobinado,
    'bol-taco':r.bolsas?.taco, 'bol-corte-circ':r.bolsas?.corte_circ, 'bol-corte-rect':r.bolsas?.corte_rect })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  state.editandoId = firestoreId;
  state.editandoColeccion = COL_REG;
  document.getElementById('btn-guardar-registro').textContent = 'ACTUALIZAR REGISTRO ✓';
  irSeccion('sec-recepcion');
  showToast('Editando registro — modificá y guardá');
};

/* ══ CRUD — EDITAR SCORING ══ */
window.editarScoring = function(firestoreId) {
  const s = state.scorings.find(x => x.firestoreId === firestoreId);
  if (!s) return;

  // Ir al tab scoring
  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#tabs-main .vis-tab[data-tab="tab-scoring"]').classList.add('active');
  document.getElementById('tab-scoring').classList.add('active');

  // Turno
  state.turnoScoringActivo = s.turno;
  document.querySelectorAll('.turno-btn.turno-scoring').forEach(b => {
    b.classList.toggle('selected', b.dataset.turno === s.turno);
  });

  // Categoría
  state.categoriaActiva = s.categoria;
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === s.categoria));
  ['bolleria','molde'].forEach(cat => {
    document.getElementById(`scoring-productos-${cat}`)?.classList.toggle('active', cat === s.categoria);
    document.getElementById(`scoring-form-${cat}`)?.classList.toggle('active', cat === s.categoria);
  });

  // Campos bollería
  if (s.categoria === 'bolleria') {
    const inp = document.getElementById('sc-bol-producto-input');
    if (inp) inp.value = s.producto || '';
    Object.entries({ 'sc-bol-lote':s.lote, 'sc-bol-vto':s.vto, 'sc-bol-peso':s.peso, 'sc-bol-color':s.color,
      'sc-bol-base':s.base_, 'sc-bol-altura':s.altura, 'sc-bol-desgarro':s.desgarro, 'sc-bol-manchas':s.manchas,
      'sc-bol-harina':s.harina, 'sc-bol-estrias':s.estrias, 'sc-bol-estivado':s.estivado, 'sc-bol-miga':s.miga })
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }

  // Campos molde
  if (s.categoria === 'molde') {
    const inp = document.getElementById('sc-mol-producto-input');
    if (inp) inp.value = s.producto || '';
    Object.entries({ 'sc-mol-lote':s.lote, 'sc-mol-vto':s.vto, 'sc-mol-peso':s.peso, 'sc-mol-color':s.color,
      'sc-mol-altura':s.altura, 'sc-mol-forma':s.forma, 'sc-mol-estivado':s.estivado, 'sc-mol-miga':s.miga,
      'sc-mol-reb-c':s.reb_c, 'sc-mol-reb-g':s.reb_g, 'sc-mol-coccion':s.coccion, 'sc-mol-embollado':s.embollado, 'sc-mol-desgarro':s.desgarro })
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }

  state.editandoId = firestoreId;
  state.editandoColeccion = COL_SCORING;
  document.getElementById('btn-guardar-scoring').textContent = 'ACTUALIZAR SCORING ✓';
  showToast('Editando scoring — modificá y guardá');
};

/* ══ CRUD — CONFIRMAR ELIMINAR ══ */
window.confirmarEliminar = function(firestoreId, coleccion) {
  const overlay = document.getElementById('confirm-overlay');
  const msg     = document.getElementById('confirm-msg');
  if (!overlay || !msg) return;
  const tipo = coleccion === COL_REG ? 'registro' : 'scoring';
  msg.textContent = `¿Eliminás este ${tipo}? Esta acción no se puede deshacer.`;
  overlay.style.display = 'flex';
  document.getElementById('confirm-si').onclick = async () => {
    overlay.style.display = 'none';
    try {
      await deleteDoc(doc(db, coleccion, firestoreId));
      showToast('✓ Eliminado correctamente');
    } catch (e) {
      showToast('Error al eliminar: ' + e.message, true);
    }
  };
  document.getElementById('confirm-no').onclick = () => { overlay.style.display = 'none'; };
};

/* ══ MODAL VER REGISTRO ══ */
window.verRegistro = function(firestoreId) {
  const r = state.registros.find(x => x.firestoreId === firestoreId);
  if (!r) return;

  document.getElementById('modal-titulo').textContent = 'Registro de Calidad';
  document.getElementById('modal-meta').textContent   =
    `${formatFecha(r.fecha)} · ${r.usuario} · Turno ${r.turno}${r.editado ? ' · (editado)' : ''}`;

  const colorVal = (v) => {
    if (!v) return 'modal-campo-valor';
    if (['Bueno','OK','A largo plazo'].includes(v)) return 'modal-campo-valor ok';
    if (['Regular','Bajo','Próximo'].includes(v))   return 'modal-campo-valor warn';
    if (['Malo','Sin stock','Vencido'].includes(v)) return 'modal-campo-valor danger';
    return 'modal-campo-valor';
  };
  const tColor = (v) => {
    if (!v) return 'modal-campo-valor';
    if (v === 'OK')    return 'modal-campo-valor ok-t';
    if (v === 'NO OK') return 'modal-campo-valor nok-t';
    return 'modal-campo-valor';
  };
  const campo = (label, val, cls) => val
    ? `<div class="modal-campo"><div class="modal-campo-label">${label}</div><div class="${cls || colorVal(val)}">${val}</div></div>` : '';
  const seccion = (titulo, cs) => {
    const c = cs.filter(Boolean).join('');
    return c ? `<div class="modal-seccion"><div class="modal-seccion-title">${titulo}</div>${c}</div>` : '';
  };

  document.getElementById('modal-body').innerHTML = [
    seccion('📦 Recepción MP', [
      campo('Empaque', r.recepcion?.empaque_estado),
      campo('Obs. empaque', r.recepcion?.empaque_obs, 'modal-campo-valor'),
      campo('Vencimiento', r.recepcion?.vto_estado),
      campo('Obs. vto.', r.recepcion?.vto_obs, 'modal-campo-valor'),
    ]),
    seccion('Formulación', [
      campo('Stock', r.formulacion?.stock_estado),
      campo('Obs. stock', r.formulacion?.stock_obs, 'modal-campo-valor'),
      campo('Estado sector', r.formulacion?.sector_estado),
      campo('Obs. sector', r.formulacion?.sector_obs, 'modal-campo-valor'),
      campo('Pesos pesadas', r.formulacion?.pesos, 'modal-campo-valor'),
    ]),
    seccion('🏭 Fabricación', [
      campo('Molino', r.fabricacion?.molino, 'modal-campo-valor'),
      campo('Gluten', r.fabricacion?.gluten, 'modal-campo-valor'),
      campo('Silo 1', r.fabricacion?.silo1, 'modal-campo-valor'),
      campo('Silo 2', r.fabricacion?.silo2, 'modal-campo-valor'),
      campo('Aceite 1', r.fabricacion?.aceite1, 'modal-campo-valor'),
      campo('Aceite 2', r.fabricacion?.aceite2, 'modal-campo-valor'),
      campo('Equipo frío', r.fabricacion?.frio, 'modal-campo-valor'),
      campo('Balanza tolva', r.fabricacion?.balanza, 'modal-campo-valor'),
      campo('Tº agua', r.fabricacion?.tagua, 'modal-campo-valor'),
      campo('Producto/bollo', r.fabricacion?.producto, 'modal-campo-valor'),
      campo('Observaciones', r.fabricacion?.obs, 'modal-campo-valor'),
    ]),
    seccion('🌡️ Cámara de Fermento', [
      campo('Producto', r.camara?.producto, 'modal-campo-valor'),
      campo('Set temperatura', r.camara?.set_temp, 'modal-campo-valor'),
      campo('Temperatura', r.camara?.temp, 'modal-campo-valor'),
      campo('Set humedad', r.camara?.set_hum, 'modal-campo-valor'),
      campo('Humedad', r.camara?.hum, 'modal-campo-valor'),
      campo('Entrada', r.camara?.hora_entrada, 'modal-campo-valor'),
      campo('Salida', r.camara?.hora_salida, 'modal-campo-valor'),
      campo('Observaciones', r.camara?.obs, 'modal-campo-valor'),
    ]),
    seccion('🔥 Horno', [
      campo('Producto', r.horno?.producto, 'modal-campo-valor'),
      campo('Set zona 1', r.horno?.set_z1, 'modal-campo-valor'),
      campo('Zona 1', r.horno?.z1, 'modal-campo-valor'),
      campo('Set zona 2', r.horno?.set_z2, 'modal-campo-valor'),
      campo('Zona 2', r.horno?.z2, 'modal-campo-valor'),
      campo('Tiempo cocción', r.horno?.tiempo_min ? r.horno.tiempo_min + ' min' : '', 'modal-campo-valor'),
      campo('Transporte 1', r.horno?.t1, tColor(r.horno?.t1)),
      campo('Transporte 2', r.horno?.t2, tColor(r.horno?.t2)),
      campo('Transporte 3', r.horno?.t3, tColor(r.horno?.t3)),
      campo('Obs. transportes', r.horno?.transport_obs, 'modal-campo-valor'),
    ]),
    seccion('❄️ Enfriador', [
      campo('Receta', r.enfriador?.receta, 'modal-campo-valor'),
      campo('Desmoldeador', r.enfriador?.desmoldeador, 'modal-campo-valor'),
    ]),
    seccion('🔍 Detector de Metales', [
      campo('Receta', r.detector?.receta, 'modal-campo-valor'),
      campo('Sensibilidad', r.detector?.sensibilidad, 'modal-campo-valor'),
      campo('Hora de cambio', r.detector?.hora_cambio, 'modal-campo-valor'),
      campo('Patrones', r.detector?.patrones, 'modal-campo-valor'),
    ]),
    seccion('📦 Envase', [
      campo('Producto', r.envase?.producto, 'modal-campo-valor'),
      campo('Paquete', r.envase?.paquete, 'modal-campo-valor'),
      campo('Lote', r.envase?.lote, 'modal-campo-valor'),
      campo('Vencimiento', r.envase?.vto, 'modal-campo-valor'),
      campo('Observaciones', r.envase?.obs, 'modal-campo-valor'),
    ]),
    seccion('Bolsas y Rollos', [
      campo('Producto', r.bolsas?.producto, 'modal-campo-valor'),
      campo('Bobinado', r.bolsas?.bobinado, 'modal-campo-valor'),
      campo('Taco', r.bolsas?.taco, 'modal-campo-valor'),
      campo('Corte circular', r.bolsas?.corte_circ, 'modal-campo-valor'),
      campo('Corte recto', r.bolsas?.corte_rect, 'modal-campo-valor'),
    ]),
  ].join('');

  document.getElementById('modal-overlay').style.display = 'flex';
};

/* ══ MODAL VER SCORING ══ */
window.verScoring = function(firestoreId) {
  const s = state.scorings.find(x => x.firestoreId === firestoreId);
  if (!s) return;

  document.getElementById('modal-titulo').textContent = `Scoring — ${catLabel[s.categoria] || s.categoria}`;
  document.getElementById('modal-meta').textContent =
    `${formatFecha(s.fecha)} · ${s.usuario} · Turno ${s.turno} · ${s.producto}${s.editado ? ' · (editado)' : ''}`;

  const campo = (label, val) => val
    ? `<div class="modal-campo"><div class="modal-campo-label">${label}</div><div class="modal-campo-valor">${val}</div></div>` : '';

  const mapBolleria = { lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color', base_:'Base', altura:'Altura',
    desgarro:'Desgarro', manchas:'Manchas', harina:'Harina', estrias:'Estrías', estivado:'Estivado', miga:'Miga' };
  const mapMolde = { lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color', altura:'Altura', forma:'Forma',
    estivado:'Estivado', miga:'Miga', reb_c:'Rebanadas chicas', reb_g:'Rebanadas grandes',
    coccion:'Cocción', embollado:'Embollado', desgarro:'Desgarro' };

  const map = s.categoria === 'molde' ? mapMolde : mapBolleria;
  const campos = Object.entries(map).map(([k, l]) => campo(l, s[k])).join('');

  document.getElementById('modal-body').innerHTML =
    `<div class="modal-seccion"><div class="modal-seccion-title">${s.producto}</div>${campos}</div>`;

  document.getElementById('modal-overlay').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal();
});
