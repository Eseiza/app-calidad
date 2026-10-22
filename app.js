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
const COL_PRUEBAS = "calidad-pruebas"; // Informes (los puede hacer calidad, admin y pasante)

// ══ APPS SCRIPT URL — reemplazá con tu URL al publicar ══
const APPS_SCRIPT_URL = ''; // ← pegá acá tu URL

/* ══ ROLES CON PERMISO CRUD ══ */
const ROLES_CRUD = ['admin', 'calidad'];

/* ══ USUARIOS ══ */
const USERS = {
  "calidad1":  { password: "Calidad.2026",  role: "calidad",      nombre: "Mili" },
  "calidad2":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad" },
  "pasanteM":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TM" },
  "pasanteT":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TT" },
  "admin":     { password: "cin>>Eszenay7;",    role: "admin",        nombre: "Administrador" },
  "Romero":    { password: "Romero.2026",   role: "visualizador", nombre: "Romero" },
};

/* ══ PRODUCTOS SCORING ══ */
const PRODUCTOS_BOLLERIA = ['Hamburguesa', 'Max', 'Pancho', 'Super'];
const PRODUCTOS_MOLDE    = ['Multicereal', 'Integral', 'Salvado F', 'Salvado C', 'Lacteado F', 'Lacteado C'];

/* ══ CAMPOS QUE SUMAN PUNTAJE (0-1-2) ══ */
const SCORE_FIELDS_BOLLERIA = ['peso2','envase','color','base_','altura','largo',
  'desgarro','manchas','harina','estrias','estivado','miga','desgrana','descascara'];
const SCORE_FIELDS_MOLDE = ['peso2','color','altura','forma','estivado','miga',
  'reb_cant','reb_grosor','coccion','embollado','desgarro'];

function calcularPuntaje(s) {
  const campos = s.categoria === 'molde' ? SCORE_FIELDS_MOLDE : SCORE_FIELDS_BOLLERIA;
  let total = 0, count = 0;
  campos.forEach(c => {
    const v = s[c];
    if (v !== undefined && v !== null && String(v).trim() !== '' && !isNaN(Number(v))) {
      total += Number(v);
      count++;
    }
  });
  return count ? total : '';
}

/* ══ STATE ══ */
const state = {
  role: null, currentUser: '',
  registros: [], scorings: [], pruebas: [],
  turnoActivo: null,
  turnoScoringActivo: null,
  turnoScoringDiarioActivo: null,
  categoriaActiva: 'bolleria',
  categoriaActivaScd: 'bolleria',
  historialTipo: 'registros',
  // transportes: estado por transporte (OK o OBS)
  transportes: { t1: null, t2: null, t3: null, t4: null },
  // camara: tipo de producto seleccionado
  camaraTipo: null,
  // rollos: marca seleccionada
  rollosMarca: null,
  // ok-obs campos (bobinado, taco)
  okObsState: { bobinado: null, taco: null },
  unsubReg: null, unsubSco: null, unsubPru: null,
  editandoId: null,
  editandoColeccion: null,
  editandoPruebaId: null,
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

// Alarma cámara de combustión: ahora es un valor de temperatura.
// Registros viejos guardaban 'Sin alarma' / 'Con alarma': se ignoran para no mostrarlos como temperatura.
function valorAlarma(v) {
  if (v === undefined || v === null) return '';
  const t = String(v).trim();
  return /^(sin|con) alarma$/i.test(t) ? '' : t;
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

function leerHoraLevado() {
  const hh = leerCampo('cam-hora-levado-hh').padStart(2, '0');
  const mm = leerCampo('cam-hora-levado-mm').padStart(2, '0');
  if (!hh && !mm) return '';
  return `${hh || '00'}:${mm || '00'} hs`;
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

function suscribirPruebas() {
  const q = query(collection(db, COL_PRUEBAS), orderBy('timestamp', 'desc'));
  state.unsubPru = onSnapshot(q, snap => {
    state.pruebas = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    refrescarVistas();
  }, err => showToast('Error Firestore pruebas: ' + err.message, true));
}

/* ══ REFRESCAR VISTAS ══ */
function refrescarVistas() {
  if (document.getElementById('historial-list'))     renderHistorial();
  if (document.getElementById('vis-historial-list')) renderHistorialVis();
  if (document.getElementById('vis-scoring-list'))   renderScoringVis();
  if (document.getElementById('pruebas-list'))       renderPruebas();
  renderAnalisis();
  renderStatsVisibles();
}

/* ══ LOGIN ══ */
['login-user', 'login-pass'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});
document.getElementById('login-btn').addEventListener('click', doLogin);

function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const rolSeleccionado = document.getElementById('login-role').value;
  if (!rolSeleccionado)        { showToast('Seleccioná un rol', true); return; }
  if (!username || !password) { showToast('Ingresá usuario y contraseña', true); return; }
  const user = USERS[username];
  if (!user || user.password !== password) { showToast('Usuario o contraseña incorrectos', true); return; }
  if (user.role !== rolSeleccionado) { showToast(`Este usuario es "${user.role}"`, true); return; }

  state.role = rolSeleccionado;
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
      // Pasante puede ver historial pero solo sus propios registros
    }
    const tabPruebasBtn = document.getElementById('tab-btn-pruebas');
    if (tabPruebasBtn) tabPruebasBtn.style.display = '';
    actualizarFechas();
    setInterval(actualizarFechas, 60000);
  }
  suscribirRegistros();
  suscribirScoring();
  suscribirPruebas();
  suscribirAnalisis();
}

window.doLogout = function() {
  if (state.unsubReg) state.unsubReg();
  if (state.unsubSco) state.unsubSco();
  if (state.unsubPru) state.unsubPru();
  Object.assign(state, {
    role:null, currentUser:'', registros:[], scorings:[], pruebas:[],
    turnoActivo:null, turnoScoringActivo:null, turnoScoringDiarioActivo:null,
    historialTipo:'registros',
    editandoId:null, editandoColeccion:null, editandoPruebaId:null,
    camaraTipo: null, rollosMarca: null,
    transportes: { t1:null, t2:null, t3:null, t4:null },
    okObsState: { bobinado:null, taco:null },
  });
  resetNuevasPestanas();
  document.getElementById('screen-main').style.display = 'none';
  document.getElementById('screen-vis').style.display  = 'none';
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-role').value = '';
};

function actualizarFechas() {
  const ahora = new Date();
  const txt = ahora.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }) +
              ' · ' + ahora.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  ['fecha-actual','fecha-scoring','fecha-scoring-diario','fecha-analisis'].forEach(id => {
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
document.querySelectorAll('.turno-btn:not(.turno-scoring):not(.turno-scoring-diario)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.turno-btn:not(.turno-scoring):not(.turno-scoring-diario)').forEach(b => b.classList.remove('selected'));
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
document.querySelectorAll('#tab-scoring .categoria-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-scoring .categoria-btn').forEach(b => b.classList.remove('active'));
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

/* ══ CÁMARA — selector tipo producto ══ */
document.querySelectorAll('.tipo-producto-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tipo-producto-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.camaraTipo = btn.dataset.tipo;
    document.getElementById('cam-lista-bolleria').style.display = state.camaraTipo === 'bolleria' ? 'block' : 'none';
    document.getElementById('cam-lista-molde').style.display    = state.camaraTipo === 'molde'    ? 'block' : 'none';
  });
});

/* ══ CÁMARA — hora levado: auto-avance de HH a MM ══ */
const hhInput = document.getElementById('cam-hora-levado-hh');
const mmInput = document.getElementById('cam-hora-levado-mm');
if (hhInput && mmInput) {
  hhInput.addEventListener('input', () => {
    if (hhInput.value.length === 2) mmInput.focus();
  });
  // Solo números
  [hhInput, mmInput].forEach(el => {
    el.addEventListener('keypress', e => { if (!/\d/.test(e.key)) e.preventDefault(); });
  });
}

/* ══ TRANSPORTES — 4 transportes con obs expandible ══ */
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.t;
    document.querySelectorAll(`.transport-btn[data-t="${t}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.transportes[t] = btn.dataset.v;
    // Mostrar/ocultar textarea de observación
    const obsWrap = document.getElementById(`transport-obs-wrap-${t}`);
    if (obsWrap) obsWrap.style.display = btn.dataset.v === 'OBS' ? 'block' : 'none';
    if (btn.dataset.v === 'OK') {
      const obsInput = document.getElementById(`transport-obs-${t}`);
      if (obsInput) obsInput.value = '';
    }
  });
});

/* ══ MARCA ROLLOS ══ */
document.querySelectorAll('.marca-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.marca-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.rollosMarca = btn.dataset.marca;
  });
});

/* ══ OK / OBS campos (bobinado, taco) ══ */
document.querySelectorAll('.ok-obs-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const campo = btn.dataset.campo;
    document.querySelectorAll(`.ok-obs-btn[data-campo="${campo}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.okObsState[campo] = btn.dataset.v;
    const detail = document.getElementById(`ok-obs-detail-${campo}`);
    if (detail) detail.style.display = btn.dataset.v === 'OBS' ? 'block' : 'none';
    if (btn.dataset.v === 'OK') {
      const obsInput = document.getElementById(`rol-${campo}-obs`);
      if (obsInput) obsInput.value = '';
    }
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

/* ══ ESTADO CHECK ══ */
document.querySelectorAll('.estado-check-grid').forEach(grid => {
  grid.querySelectorAll('.estado-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.estado-check-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
});

/* ══ HORNO — producto "Otro" ══ */
document.getElementById('horn-producto')?.addEventListener('change', function() {
  const wrap = document.getElementById('horn-producto-otro-wrap');
  if (wrap) wrap.style.display = this.value === 'Otro' ? 'block' : 'none';
});

/* ══ LEER PRODUCTO CÁMARA ══ */
function leerProductoCamara() {
  if (state.camaraTipo === 'bolleria') return leerCampo('cam-producto-bolleria');
  if (state.camaraTipo === 'molde')   return leerCampo('cam-producto-molde');
  return '';
}

/* ══ LEER VALOR TRANSPORTE ══ */
function leerTransporte(t) {
  const estado = state.transportes[t];
  if (!estado) return { estado: '', obs: '' };
  if (estado === 'OK') return { estado: 'OK', obs: '' };
  return { estado: 'OBS', obs: leerCampo(`transport-obs-${t}`) };
}

/* ══ LEER CAMPO OK/OBS ══ */
function leerOkObs(campo) {
  const estado = state.okObsState[campo];
  if (!estado) return { estado: '', obs: '' };
  if (estado === 'OK') return { estado: 'OK', obs: '' };
  return { estado: 'OBS', obs: leerCampo(`rol-${campo}-obs`) };
}

/* ══ LEER FORMULARIO REGISTRO ══ */
function leerFormulario() {
  const hornProd = leerCampo('horn-producto') === 'Otro' ? leerCampo('horn-producto-otro') : leerCampo('horn-producto');
  const t1 = leerTransporte('t1');
  const t2 = leerTransporte('t2');
  const t3 = leerTransporte('t3');
  const t4 = leerTransporte('t4');
  const bobinado = leerOkObs('bobinado');
  const taco     = leerOkObs('taco');

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
      malta:    leerCampo('fab-malta'),
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
      tipo_producto: state.camaraTipo || '',
      producto:     leerProductoCamara(),
      hora_levado:  leerHoraLevado(),
      hora_entrada: leerCampo('cam-hora-entrada'),
      hora_salida:  leerCampo('cam-hora-salida'),
      obs:          leerCampo('cam-obs'),
    },
    horno: {
      set_z1:    leerCampo('horn-set-z1'),
      z1:        leerCampo('horn-z1'),
      set_z2:    leerCampo('horn-set-z2'),
      z2:        leerCampo('horn-z2'),
      comb_z1:        leerCampo('horn-comb-z1'),
      alarma_z1:      leerCampo('horn-alarma-z1'),
      comb_z2:        leerCampo('horn-comb-z2'),
      alarma_z2:      leerCampo('horn-alarma-z2'),
      producto:  hornProd,
      tiempo_min: leerCampo('horn-tiempo'),
      t1_estado: t1.estado, t1_obs: t1.obs,
      t2_estado: t2.estado, t2_obs: t2.obs,
      t3_estado: t3.estado, t3_obs: t3.obs,
      t4_estado: t4.estado, t4_obs: t4.obs,
      obs:       leerCampo('horn-obs'),
    },
    enfriador: {
      receta:       leerCampo('enf-receta'),
      desmoldador:  leerCampo('enf-desmoldador'),
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
    rollos: {
      marca:            state.rollosMarca || '',
      producto:         leerCampo('rol-producto'),
      bobinado_estado:  bobinado.estado,
      bobinado_obs:     bobinado.obs,
      taco_estado:      taco.estado,
      taco_obs:         taco.obs,
    },
    bolsas: {
      producto:   leerCampo('bol-producto'),
      corte_circ: leerCampo('bol-corte-circ'),
      corte_rect: leerCampo('bol-corte-rect'),
    },
  };
}

function limpiarFormulario() {
  document.querySelectorAll('#tab-nuevo input[type="text"], #tab-nuevo input[type="number"], #tab-nuevo input[type="time"], #tab-nuevo textarea, #tab-nuevo select')
    .forEach(el => el.value = '');
  document.querySelectorAll('#tab-nuevo input[type="radio"]').forEach(el => el.checked = false);
  document.querySelectorAll('.estado-check-btn.selected, .turno-btn:not(.turno-scoring):not(.turno-scoring-diario).selected')
    .forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.transport-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.tipo-producto-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.marca-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.ok-obs-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.transport-obs-wrap').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.ok-obs-detail').forEach(el => el.style.display = 'none');
  document.getElementById('horn-producto-otro-wrap').style.display = 'none';
  document.getElementById('cam-lista-bolleria').style.display = 'none';
  document.getElementById('cam-lista-molde').style.display = 'none';
  state.turnoActivo   = null;
  state.camaraTipo    = null;
  state.rollosMarca   = null;
  state.transportes   = { t1: null, t2: null, t3: null, t4: null };
  state.okObsState    = { bobinado: null, taco: null };
  state.editandoId    = null;
  state.editandoColeccion = null;
  swLimpiarEn('#sec-horno');
  const btn = document.getElementById('btn-guardar-registro');
  if (btn) btn.textContent = 'GUARDAR REGISTRO ✓';
  irSeccion('sec-recepcion');
}


/* ══ ENVIAR A GOOGLE SHEETS ══ */
async function sendToSheets(payload) {
  if (!APPS_SCRIPT_URL) return; // Si no hay URL configurada, omitir
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
  } catch (e) {
    console.warn('Google Sheets sync error:', e.message);
  }
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
    detector:'Detector', envase:'Envase', rollos:'Rollos', bolsas:'Bolsas'
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
      btn.disabled = false;
      btn.textContent = 'GUARDAR REGISTRO ✓';
      showToast('✓ Registro actualizado correctamente');
    } else {
      const ahora = new Date();
      const docData = {
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        turno: state.turnoActivo, usuario: state.currentUser, rol: state.role,
        secciones: seccionesConDatos, tipo: 'registro', ...datos,
      };
      await addDoc(collection(db, COL_REG), docData);
      sendToSheets(docData);
      showToast('✓ Registro guardado correctamente');
    }
    btn.disabled = false;
    btn.textContent = 'GUARDAR REGISTRO ✓';
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
  const subtipo = leerCampo('sc-subtipo') === 'diario' ? 'diario' : 'normal';
  if (cat === 'bolleria') {
    return { categoria: cat, subtipo,
      producto:    leerCampo('sc-bol-producto'),
      lote:        leerCampo('sc-bol-lote'),
      vto:         leerCampo('sc-bol-vto'),
      peso:        leerCampo('sc-bol-peso'),
      peso2:       leerCampo('sc-bol-peso2'),
      envase:      leerCampo('sc-bol-envase'),
      color:       leerCampo('sc-bol-color'),
      base_:       leerCampo('sc-bol-base'),
      alto_cm:     leerCampo('sc-bol-alto-cm'),
      altura:      leerCampo('sc-bol-altura'),
      largo_cm:    leerCampo('sc-bol-largo-cm'),
      largo:       leerCampo('sc-bol-largo'),
      desgarro:    leerCampo('sc-bol-desgarro'),
      manchas:     leerCampo('sc-bol-manchas'),
      harina:      leerCampo('sc-bol-harina'),
      estrias:     leerCampo('sc-bol-estrias'),
      estivado:    leerCampo('sc-bol-estivado'),
      miga:        leerCampo('sc-bol-miga'),
      desgrana:    subtipo === 'diario' ? '' : leerCampo('sc-bol-desgrana'),
      descascara:  subtipo === 'diario' ? '' : leerCampo('sc-bol-descascara'),
      obs:         leerCampo('sc-bol-obs'),
    };
  }
  if (cat === 'molde') {
    return { categoria: cat, subtipo,
      producto:  leerCampo('sc-mol-producto'),
      lote:      leerCampo('sc-mol-lote'),
      vto:       leerCampo('sc-mol-vto'),
      peso:      leerCampo('sc-mol-peso'),
      peso2:     leerCampo('sc-mol-peso2'),
      color:     leerCampo('sc-mol-color'),
      forma:     leerCampo('sc-mol-forma'),
      estivado:  leerCampo('sc-mol-estivado'),
      miga:      leerCampo('sc-mol-miga'),
      reb_cant:      leerCampo('sc-mol-reb-cant'),
      alto_cm:       leerCampo('sc-mol-alto-cm'),
      altura:        leerCampo('sc-mol-altura'),
      grosor_cm:     leerCampo('sc-mol-grosor-cm'),
      reb_grosor:    leerCampo('sc-mol-reb-grosor'),
      coccion:   leerCampo('sc-mol-coccion'),
      embollado: leerCampo('sc-mol-embollado'),
      desgarro:  leerCampo('sc-mol-desgarro'),
      obs:       leerCampo('sc-mol-obs'),
    };
  }
  return { categoria: cat };
}

function aplicarSubtipoScoring() {
  const esDiario = document.getElementById('sc-subtipo')?.value === 'diario';
  document.querySelectorAll('#tab-scoring .sc-solo-normal').forEach(el => {
    el.style.display = esDiario ? 'none' : '';
    if (esDiario) el.querySelectorAll('input').forEach(i => { i.value = ''; });
  });
}
document.getElementById('sc-subtipo')?.addEventListener('change', aplicarSubtipoScoring);

function limpiarScoring() {
  document.querySelectorAll('#tab-scoring input[type="text"], #tab-scoring select').forEach(el => el.value = '');
  document.querySelectorAll('.turno-btn.turno-scoring.selected').forEach(el => el.classList.remove('selected'));
  state.turnoScoringActivo = null;
  state.editandoId = null;
  state.editandoColeccion = null;
  const subSel = document.getElementById('sc-subtipo');
  if (subSel) subSel.value = 'normal';
  aplicarSubtipoScoring();
  const btn = document.getElementById('btn-guardar-scoring');
  if (btn) btn.textContent = 'GUARDAR SCORING ✓';
}

/* ══ GUARDAR / ACTUALIZAR SCORING ══ */
document.getElementById('btn-guardar-scoring').addEventListener('click', async () => {
  if (!state.turnoScoringActivo) { showToast('Seleccioná el turno', true); return; }
  const datos = leerScoring();
  if (!datos.producto) { showToast('Seleccioná un producto', true); return; }
  const tieneDatos = Object.entries(datos)
    .filter(([k]) => !['categoria','producto','subtipo'].includes(k))
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
      btn.disabled = false;
      btn.textContent = 'GUARDAR SCORING ✓';
      showToast('✓ Scoring actualizado correctamente');
    } else {
      const ahora = new Date();
      const scoringData = {
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        turno: state.turnoScoringActivo, usuario: state.currentUser, rol: state.role,
        tipo: 'scoring', ...datos,
      };
      await addDoc(collection(db, COL_SCORING), scoringData);
      sendToSheets(scoringData);
      showToast('✓ Scoring guardado correctamente');
    }
    btn.disabled = false;
    btn.textContent = 'GUARDAR SCORING ✓';
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
document.getElementById('filtro-subtipo')?.addEventListener('change', renderHistorial);
document.getElementById('btn-limpiar')?.addEventListener('click', () => {
  ['filtro-desde','filtro-hasta','filtro-turno','filtro-usuario','filtro-subtipo','filtro-categoria'].forEach(id => { document.getElementById(id).value = ''; });
  poblarFiltroProductos();
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

// sub: '' = todos · 'normal' = Scoring · 'diario' = Scoring Diario
function scoringsPorSubtipo(sub) {
  if (sub === 'diario') return state.scorings.filter(s => s.subtipo === 'diario');
  if (sub === 'normal') return state.scorings.filter(s => s.subtipo !== 'diario');
  return state.scorings;
}
function subtipoFiltro() { return document.getElementById('filtro-subtipo')?.value || ''; }

function renderHistorial() {
  const list = document.getElementById('historial-list');
  if (!list) return;
  const bloqueDia = document.getElementById('export-scoring-dia');
  if (bloqueDia) bloqueDia.style.display = state.historialTipo === 'scoring' ? 'block' : 'none';
  const wrapSub = document.getElementById('filtro-subtipo-wrap');
  if (wrapSub) wrapSub.style.display = state.historialTipo === 'scoring' ? 'block' : 'none';
  const wrapProd = document.getElementById('filtro-prod-wrap');
  if (wrapProd) wrapProd.style.display = state.historialTipo === 'scoring' ? '' : 'none';
  const f = getFilters();
  const esPasante = state.role === 'pasante';
  if (state.historialTipo === 'registros') {
    let items = filtrarItems(state.registros, f);
    if (esPasante) items = items.filter(r => r.usuario === state.currentUser);
    list.innerHTML = items.length ? items.map(r => buildRegistroCard(r, !esPasante)).join('') : emptyMsg();
  } else {
    let items = filtrarScoringProd(filtrarItems(scoringsPorSubtipo(subtipoFiltro()), f));
    if (esPasante) items = items.filter(s => s.usuario === state.currentUser);
    list.innerHTML = items.length ? items.map(s => buildScoringCard(s, !esPasante)).join('') : emptyMsg();
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
          ${s.subtipo === 'diario' ? '<span class="badge-cat">DIARIO</span>' : ''}
        </div>
      </div>
      <div class="registro-meta">${formatFecha(s.fecha)} · ${s.usuario}</div>
      <div class="puntaje-total-row">PUNTAJE TOTAL <strong>${calcularPuntaje(s) === '' ? '—' : calcularPuntaje(s)}</strong></div>
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

  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#tabs-main .vis-tab[data-tab="tab-nuevo"]').classList.add('active');
  document.getElementById('tab-nuevo').classList.add('active');

  state.turnoActivo = r.turno;
  document.querySelectorAll('.turno-btn:not(.turno-scoring):not(.turno-scoring-diario)').forEach(b => {
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
  Object.entries({ 'fab-gluten':r.fabricacion?.gluten, 'fab-malta':r.fabricacion?.malta, 'fab-silo1':r.fabricacion?.silo1, 'fab-silo2':r.fabricacion?.silo2,
    'fab-aceite1':r.fabricacion?.aceite1, 'fab-aceite2':r.fabricacion?.aceite2, 'fab-frio':r.fabricacion?.frio,
    'fab-balanza':r.fabricacion?.balanza, 'fab-tagua':r.fabricacion?.tagua, 'fab-producto':r.fabricacion?.producto, 'fab-obs':r.fabricacion?.obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Cámara
  if (r.camara?.tipo_producto) {
    state.camaraTipo = r.camara.tipo_producto;
    document.querySelectorAll('.tipo-producto-btn').forEach(b => b.classList.toggle('selected', b.dataset.tipo === r.camara.tipo_producto));
    document.getElementById('cam-lista-bolleria').style.display = r.camara.tipo_producto === 'bolleria' ? 'block' : 'none';
    document.getElementById('cam-lista-molde').style.display    = r.camara.tipo_producto === 'molde'    ? 'block' : 'none';
    if (r.camara.tipo_producto === 'bolleria') document.getElementById('cam-producto-bolleria').value = r.camara.producto || '';
    if (r.camara.tipo_producto === 'molde')    document.getElementById('cam-producto-molde').value    = r.camara.producto || '';
  }
  // hora levado
  if (r.camara?.hora_levado) {
    const parts = r.camara.hora_levado.replace(' hs','').split(':');
    const hhEl = document.getElementById('cam-hora-levado-hh');
    const mmEl = document.getElementById('cam-hora-levado-mm');
    if (hhEl) hhEl.value = parts[0] || '';
    if (mmEl) mmEl.value = parts[1] || '';
  }
  Object.entries({ 'cam-set-temp':r.camara?.set_temp, 'cam-temp':r.camara?.temp, 'cam-set-hum':r.camara?.set_hum,
    'cam-hum':r.camara?.hum, 'cam-hora-entrada':r.camara?.hora_entrada, 'cam-hora-salida':r.camara?.hora_salida, 'cam-obs':r.camara?.obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Horno
  Object.entries({ 'horn-set-z1':r.horno?.set_z1, 'horn-z1':r.horno?.z1, 'horn-set-z2':r.horno?.set_z2,
    'horn-z2':r.horno?.z2, 'horn-comb-z1':r.horno?.comb_z1, 'horn-comb-z2':r.horno?.comb_z2, 'horn-alarma-z1':valorAlarma(r.horno?.alarma_z1), 'horn-alarma-z2':valorAlarma(r.horno?.alarma_z2), 'horn-tiempo':r.horno?.tiempo_min, 'horn-obs':r.horno?.obs
  }).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  const hornProd = document.getElementById('horn-producto');
  if (hornProd && r.horno?.producto) {
    const exists = [...hornProd.options].some(o => o.value === r.horno.producto);
    if (exists) { hornProd.value = r.horno.producto; }
    else { hornProd.value = 'Otro'; document.getElementById('horn-producto-otro-wrap').style.display = 'block'; document.getElementById('horn-producto-otro').value = r.horno.producto; }
  }
  // Transportes 1-4
  ['t1','t2','t3','t4'].forEach(t => {
    const estado = r.horno?.[`${t}_estado`] || null;
    state.transportes[t] = estado;
    document.querySelectorAll(`.transport-btn[data-t="${t}"]`).forEach(b => b.classList.toggle('selected', b.dataset.v === estado));
    const obsWrap = document.getElementById(`transport-obs-wrap-${t}`);
    if (obsWrap) obsWrap.style.display = estado === 'OBS' ? 'block' : 'none';
    const obsEl = document.getElementById(`transport-obs-${t}`);
    if (obsEl) obsEl.value = r.horno?.[`${t}_obs`] || '';
  });

  // Enfriador
  Object.entries({ 'enf-receta':r.enfriador?.receta, 'enf-desmoldador':r.enfriador?.desmoldador })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Detector
  Object.entries({ 'det-receta':r.detector?.receta, 'det-sensibilidad':r.detector?.sensibilidad,
    'det-hora-cambio':r.detector?.hora_cambio, 'det-patrones':r.detector?.patrones })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Envase
  Object.entries({ 'env-producto':r.envase?.producto, 'env-paquete':r.envase?.paquete,
    'env-lote':r.envase?.lote, 'env-vto':r.envase?.vto, 'env-obs':r.envase?.obs })
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });

  // Rollos
  if (r.rollos?.marca) {
    state.rollosMarca = r.rollos.marca;
    document.querySelectorAll('.marca-btn').forEach(b => b.classList.toggle('selected', b.dataset.marca === r.rollos.marca));
  }
  const rolProd = document.getElementById('rol-producto');
  if (rolProd) rolProd.value = r.rollos?.producto || '';
  ['bobinado','taco'].forEach(campo => {
    const estado = r.rollos?.[`${campo}_estado`] || null;
    state.okObsState[campo] = estado;
    document.querySelectorAll(`.ok-obs-btn[data-campo="${campo}"]`).forEach(b => b.classList.toggle('selected', b.dataset.v === estado));
    const detail = document.getElementById(`ok-obs-detail-${campo}`);
    if (detail) detail.style.display = estado === 'OBS' ? 'block' : 'none';
    const obsEl = document.getElementById(`rol-${campo}-obs`);
    if (obsEl) obsEl.value = r.rollos?.[`${campo}_obs`] || '';
  });

  // Bolsas
  Object.entries({ 'bol-producto':r.bolsas?.producto, 'bol-corte-circ':r.bolsas?.corte_circ, 'bol-corte-rect':r.bolsas?.corte_rect })
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

  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#tabs-main .vis-tab[data-tab="tab-scoring"]').classList.add('active');
  document.getElementById('tab-scoring').classList.add('active');

  const subSel = document.getElementById('sc-subtipo');
  if (subSel) subSel.value = s.subtipo === 'diario' ? 'diario' : 'normal';
  aplicarSubtipoScoring();

  state.turnoScoringActivo = s.turno;
  document.querySelectorAll('.turno-btn.turno-scoring').forEach(b => {
    b.classList.toggle('selected', b.dataset.turno === s.turno);
  });

  state.categoriaActiva = s.categoria;
  document.querySelectorAll('#tab-scoring .categoria-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === s.categoria));
  ['bolleria','molde'].forEach(cat => {
    document.getElementById(`scoring-productos-${cat}`)?.classList.toggle('active', cat === s.categoria);
    document.getElementById(`scoring-form-${cat}`)?.classList.toggle('active', cat === s.categoria);
  });

  if (s.categoria === 'bolleria') {
    const sel = document.getElementById('sc-bol-producto');
    if (sel) sel.value = s.producto || '';
    Object.entries({ 'sc-bol-lote':s.lote, 'sc-bol-vto':s.vto, 'sc-bol-peso':s.peso, 'sc-bol-peso2':s.peso2,
      'sc-bol-envase':s.envase, 'sc-bol-color':s.color,
      'sc-bol-base':s.base_,
      'sc-bol-alto-cm':s.alto_cm, 'sc-bol-altura':s.altura, 'sc-bol-largo-cm':s.largo_cm, 'sc-bol-largo':s.largo,
      'sc-bol-desgarro':s.desgarro, 'sc-bol-manchas':s.manchas,
      'sc-bol-harina':s.harina, 'sc-bol-estrias':s.estrias, 'sc-bol-estivado':s.estivado, 'sc-bol-miga':s.miga,
      'sc-bol-desgrana':s.desgrana, 'sc-bol-descascara':s.descascara, 'sc-bol-obs':s.obs })
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }

  if (s.categoria === 'molde') {
    const sel = document.getElementById('sc-mol-producto');
    if (sel) sel.value = s.producto || '';
    Object.entries({ 'sc-mol-lote':s.lote, 'sc-mol-vto':s.vto, 'sc-mol-peso':s.peso, 'sc-mol-peso2':s.peso2, 'sc-mol-color':s.color,
      'sc-mol-forma':s.forma, 'sc-mol-estivado':s.estivado, 'sc-mol-miga':s.miga,
      'sc-mol-reb-cant':s.reb_cant, 'sc-mol-alto-cm':s.alto_cm, 'sc-mol-altura':s.altura, 'sc-mol-grosor-cm':s.grosor_cm,
      'sc-mol-reb-grosor':s.reb_grosor, 'sc-mol-coccion':s.coccion, 'sc-mol-embollado':s.embollado, 'sc-mol-desgarro':s.desgarro, 'sc-mol-obs':s.obs })
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
    if (v === 'OK')  return 'modal-campo-valor ok-t';
    if (v === 'OBS') return 'modal-campo-valor warn';
    return 'modal-campo-valor';
  };
  const okObsColor = (v) => {
    if (!v) return 'modal-campo-valor';
    if (v === 'OK')  return 'modal-campo-valor ok-t';
    if (v === 'OBS') return 'modal-campo-valor warn';
    return 'modal-campo-valor';
  };
  const campo = (label, val, cls) => val
    ? `<div class="modal-campo"><div class="modal-campo-label">${label}</div><div class="${cls || colorVal(val)}">${val}</div></div>` : '';
  const seccion = (titulo, cs) => {
    const c = cs.filter(Boolean).join('');
    return c ? `<div class="modal-seccion"><div class="modal-seccion-title">${titulo}</div>${c}</div>` : '';
  };

  const transporteHtml = (num, t) => {
    const estado = r.horno?.[`${t}_estado`];
    const obs    = r.horno?.[`${t}_obs`];
    if (!estado) return '';
    const estadoHtml = campo(`Transporte ${num}`, estado, tColor(estado));
    const obsHtml    = (estado === 'OBS' && obs) ? campo(`Obs. T${num}`, obs, 'modal-campo-valor') : '';
    return estadoHtml + obsHtml;
  };

  const rolloOkObsHtml = (label, campo_key) => {
    const estado = r.rollos?.[`${campo_key}_estado`];
    const obs    = r.rollos?.[`${campo_key}_obs`];
    if (!estado) return '';
    const estadoHtml = campo(label, estado, okObsColor(estado));
    const obsHtml    = (estado === 'OBS' && obs) ? campo(`Obs. ${label}`, obs, 'modal-campo-valor') : '';
    return estadoHtml + obsHtml;
  };

  document.getElementById('modal-body').innerHTML = [
    seccion('Recepción MP', [
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
    seccion('Fabricación', [
      campo('Molino', r.fabricacion?.molino, 'modal-campo-valor'),
      campo('Gluten', r.fabricacion?.gluten, 'modal-campo-valor'),
      campo('Malta', r.fabricacion?.malta, 'modal-campo-valor'),
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
    seccion('Cámara de Fermento', [
      campo('Tipo', r.camara?.tipo_producto ? (r.camara.tipo_producto === 'bolleria' ? 'Bollería' : 'Pan de Molde') : '', 'modal-campo-valor'),
      campo('Producto', r.camara?.producto, 'modal-campo-valor'),
      campo('Hora levado', r.camara?.hora_levado, 'modal-campo-valor'),
      campo('Set temperatura', r.camara?.set_temp, 'modal-campo-valor'),
      campo('Temperatura', r.camara?.temp, 'modal-campo-valor'),
      campo('Set humedad', r.camara?.set_hum, 'modal-campo-valor'),
      campo('Humedad', r.camara?.hum, 'modal-campo-valor'),
      campo('Entrada', r.camara?.hora_entrada, 'modal-campo-valor'),
      campo('Salida', r.camara?.hora_salida, 'modal-campo-valor'),
      campo('Observaciones', r.camara?.obs, 'modal-campo-valor'),
    ]),
    seccion('Horno', [
      campo('Producto', r.horno?.producto, 'modal-campo-valor'),
      campo('Set zona 1', r.horno?.set_z1, 'modal-campo-valor'),
      campo('Zona 1', r.horno?.z1, 'modal-campo-valor'),
      campo('Set zona 2', r.horno?.set_z2, 'modal-campo-valor'),
      campo('Zona 2', r.horno?.z2, 'modal-campo-valor'),
      campo('Temp. cámara combustión Z1', r.horno?.comb_z1, 'modal-campo-valor'),
      campo('Alarma cámara combustión Z1', valorAlarma(r.horno?.alarma_z1), 'modal-campo-valor'),
      campo('Temp. cámara combustión Z2', r.horno?.comb_z2, 'modal-campo-valor'),
      campo('Alarma cámara combustión Z2', valorAlarma(r.horno?.alarma_z2), 'modal-campo-valor'),
      campo('Tiempo cocción', r.horno?.tiempo_min ? r.horno.tiempo_min + ' min' : '', 'modal-campo-valor'),
      transporteHtml(1, 't1'),
      transporteHtml(2, 't2'),
      transporteHtml(3, 't3'),
      transporteHtml(4, 't4'),
      campo('Observaciones', r.horno?.obs, 'modal-campo-valor'),
    ]),
    seccion('Enfriador', [
      campo('Receta', r.enfriador?.receta, 'modal-campo-valor'),
      campo('Desmoldador', r.enfriador?.desmoldador, 'modal-campo-valor'),
    ]),
    seccion('Detector de Metales', [
      campo('Receta', r.detector?.receta, 'modal-campo-valor'),
      campo('Sensibilidad', r.detector?.sensibilidad, 'modal-campo-valor'),
      campo('Hora de cambio', r.detector?.hora_cambio, 'modal-campo-valor'),
      campo('Patrones', r.detector?.patrones, 'modal-campo-valor'),
    ]),
    seccion('Envase', [
      campo('Producto', r.envase?.producto, 'modal-campo-valor'),
      campo('Paquete', r.envase?.paquete, 'modal-campo-valor'),
      campo('Lote', r.envase?.lote, 'modal-campo-valor'),
      campo('Vencimiento', r.envase?.vto, 'modal-campo-valor'),
      campo('Observaciones', r.envase?.obs, 'modal-campo-valor'),
    ]),
    seccion('Rollos', [
      campo('Marca', r.rollos?.marca, 'modal-campo-valor'),
      campo('Producto', r.rollos?.producto, 'modal-campo-valor'),
      rolloOkObsHtml('Bobinado', 'bobinado'),
      rolloOkObsHtml('Taco', 'taco'),
    ]),
    seccion('Bolsas', [
      campo('Producto', r.bolsas?.producto, 'modal-campo-valor'),
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
    `${formatFecha(s.fecha)} · ${s.usuario} · Turno ${s.turno} · ${s.producto}${s.subtipo === 'diario' ? ' · Diario' : ''}${s.editado ? ' · (editado)' : ''}`;

  const puntajeTotal = calcularPuntaje(s);

  const campo = (label, val) => val
    ? `<div class="modal-campo"><div class="modal-campo-label">${label}</div><div class="modal-campo-valor">${val}</div></div>` : '';

  const mapBolleria = { lote:'Lote', vto:'Vencimiento', peso:'Peso 1', peso2:'Peso 2', envase:'Envase',
    color:'Color', base_:'Base', alto_cm:'Alto (cm)', altura:'Alto', largo_cm:'Largo (cm)', largo:'Largo',
    desgarro:'Desgarro', manchas:'Manchas',
    harina:'Harina', estrias:'Estrías', estivado:'Estivado', miga:'Miga',
    desgrana:'Desgrana', descascara:'Descascara', obs:'Obs. producto' };
  const mapMolde    = { lote:'Lote', vto:'Vencimiento', peso:'Peso 1', peso2:'Peso 2', color:'Color',
    forma:'Forma', estivado:'Estivado', miga:'Miga', reb_cant:'Cant. rebanadas',
    alto_cm:'Alto (cm)', altura:'Alto', grosor_cm:'Grosor (cm)', reb_grosor:'Grosor rebanadas',
    coccion:'Cocción', embollado:'Embollado', desgarro:'Desgarro', obs:'Obs. producto' };

  const map = s.categoria === 'molde' ? mapMolde : mapBolleria;
  const campos = Object.entries(map).map(([k, l]) => campo(l, s[k])).join('');
  const puntajeHtml = `<div class="modal-campo"><div class="modal-campo-label">Puntaje Total</div><div class="modal-campo-valor">${puntajeTotal === '' ? '—' : puntajeTotal}</div></div>`;

  document.getElementById('modal-body').innerHTML =
    `<div class="modal-seccion"><div class="modal-seccion-title">${s.producto}</div>${puntajeHtml}${campos}</div>`;

  document.getElementById('modal-overlay').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal();
});

/* ══ EXPORTAR EXCEL ══ */
document.getElementById('btn-exportar')?.addEventListener('click', exportarExcel);

function autoCol(ws, rows) {
  if (!rows.length) return;
  ws['!cols'] = Object.keys(rows[0]).map(k => ({
    wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length), 10)
  }));
}

function exportarExcel() {
  const f  = getFilters();
  const wb = XLSX.utils.book_new();

  if (state.historialTipo === 'registros') {
    const items = filtrarItems(state.registros, f);
    if (!items.length) { showToast('No hay registros para exportar', true); return; }

    const meta = r => ({ 'Fecha': r.fecha ? new Date(r.fecha).toLocaleString('es-AR') : '', 'Turno': r.turno || '', 'Usuario': r.usuario || '' });

    const hojas = {
      'Recepción MP': items.map(r => ({ ...meta(r),
        'Empaque Estado':   r.recepcion?.empaque_estado || '',
        'Empaque Obs':      r.recepcion?.empaque_obs || '',
        'Vto Estado':       r.recepcion?.vto_estado || '',
        'Vto Obs':          r.recepcion?.vto_obs || '',
      })),
      'Formulación': items.map(r => ({ ...meta(r),
        'Stock Estado':     r.formulacion?.stock_estado || '',
        'Stock Obs':        r.formulacion?.stock_obs || '',
        'Sector Estado':    r.formulacion?.sector_estado || '',
        'Sector Obs':       r.formulacion?.sector_obs || '',
        'Pesos':            r.formulacion?.pesos || '',
      })),
      'Fabricación': items.map(r => ({ ...meta(r),
        'Molino':           r.fabricacion?.molino || '',
        'Gluten (kg)':      r.fabricacion?.gluten || '',
        'Malta (kg)':       r.fabricacion?.malta || '',
        'Silo 1':           r.fabricacion?.silo1 || '',
        'Silo 2':           r.fabricacion?.silo2 || '',
        'Aceite 1':         r.fabricacion?.aceite1 || '',
        'Aceite 2':         r.fabricacion?.aceite2 || '',
        'Equipo Frío':      r.fabricacion?.frio || '',
        'Balanza Tolva':    r.fabricacion?.balanza || '',
        'T° Agua':          r.fabricacion?.tagua || '',
        'Producto/Bollo':   r.fabricacion?.producto || '',
        'Observaciones':    r.fabricacion?.obs || '',
      })),
      'Cámara': items.map(r => ({ ...meta(r),
        'Tipo Producto':    r.camara?.tipo_producto || '',
        'Producto':         r.camara?.producto || '',
        'Hora Levado':      r.camara?.hora_levado || '',
        'Set Temperatura':  r.camara?.set_temp || '',
        'Temp Real':        r.camara?.temp || '',
        'Set Humedad':      r.camara?.set_hum || '',
        'Humedad Real':     r.camara?.hum || '',
        'Hora Entrada':     r.camara?.hora_entrada || '',
        'Hora Salida':      r.camara?.hora_salida || '',
        'Observaciones':    r.camara?.obs || '',
      })),
      'Horno': items.map(r => ({ ...meta(r),
        'Producto':         r.horno?.producto || '',
        'Set Zona 1':       r.horno?.set_z1 || '',
        'Zona 1 Real':      r.horno?.z1 || '',
        'Set Zona 2':       r.horno?.set_z2 || '',
        'Zona 2 Real':      r.horno?.z2 || '',
        'Temp. Comb. Z1':   r.horno?.comb_z1 || '',
        'Alarma Comb. Z1':  valorAlarma(r.horno?.alarma_z1),
        'Temp. Comb. Z2':   r.horno?.comb_z2 || '',
        'Alarma Comb. Z2':  valorAlarma(r.horno?.alarma_z2),
        'Tiempo (min)':     r.horno?.tiempo_min || '',
        'Transp. 1':        r.horno?.t1_estado || '',
        'Transp. 1 Obs':    r.horno?.t1_obs || '',
        'Transp. 2':        r.horno?.t2_estado || '',
        'Transp. 2 Obs':    r.horno?.t2_obs || '',
        'Transp. 3':        r.horno?.t3_estado || '',
        'Transp. 3 Obs':    r.horno?.t3_obs || '',
        'Transp. 4':        r.horno?.t4_estado || '',
        'Transp. 4 Obs':    r.horno?.t4_obs || '',
        'Observaciones':    r.horno?.obs || '',
      })),
      'Enfriador': items.map(r => ({ ...meta(r),
        'Receta':           r.enfriador?.receta || '',
        'Desmoldador':      r.enfriador?.desmoldador || '',
      })),
      'Detector': items.map(r => ({ ...meta(r),
        'Receta':           r.detector?.receta || '',
        'Sensibilidad':     r.detector?.sensibilidad || '',
        'Hora Cambio':      r.detector?.hora_cambio || '',
        'Patrones':         r.detector?.patrones || '',
      })),
      'Envase': items.map(r => ({ ...meta(r),
        'Producto':         r.envase?.producto || '',
        'Paquete':          r.envase?.paquete || '',
        'Lote':             r.envase?.lote || '',
        'Vencimiento':      r.envase?.vto || '',
        'Observaciones':    r.envase?.obs || '',
      })),
      'Rollos': items.map(r => ({ ...meta(r),
        'Marca':            r.rollos?.marca || '',
        'Producto':         r.rollos?.producto || '',
        'Bobinado':         r.rollos?.bobinado_estado || '',
        'Bobinado Obs':     r.rollos?.bobinado_obs || '',
        'Taco':             r.rollos?.taco_estado || '',
        'Taco Obs':         r.rollos?.taco_obs || '',
      })),
      'Bolsas': items.map(r => ({ ...meta(r),
        'Producto':         r.bolsas?.producto || '',
        'Corte Circular':   r.bolsas?.corte_circ || '',
        'Corte Recto':      r.bolsas?.corte_rect || '',
      })),
    };

    Object.entries(hojas).forEach(([nombre, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      autoCol(ws, rows);
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });

    const fecha = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `romero-registros-${fecha}.xlsx`);
    showToast('✓ Excel descargado');

  } else {
    const items = filtrarScoringProd(filtrarItems(scoringsPorSubtipo(subtipoFiltro()), f));
    let pref = { diario: 'romero-scoring-diario', normal: 'romero-scoring-normal' }[subtipoFiltro()] || 'romero-scoring';
    const prod = document.getElementById('filtro-producto')?.value || document.getElementById('filtro-categoria')?.value || '';
    if (prod) pref += '-' + prod.toLowerCase().replace(/\s+/g, '-');
    exportarScoring(items, `${pref}-${new Date().toISOString().slice(0,10)}`);
  }
}

/* ══ EXPORTAR SCORING (reutilizable: general y por día) ══ */
function exportarScoring(items, nombreArchivo) {
  if (!items.length) { showToast('No hay scorings para exportar', true); return; }

  const wb = XLSX.utils.book_new();
  const bolleria = items.filter(s => s.categoria === 'bolleria');
  const molde    = items.filter(s => s.categoria === 'molde');

  const metaS = s => ({ 'Fecha': s.fecha ? new Date(s.fecha).toLocaleString('es-AR') : '', 'Turno': s.turno || '', 'Usuario': s.usuario || '', 'Producto': s.producto || '' });

  if (bolleria.length) {
    const rows = bolleria.map(s => ({ ...metaS(s),
      'Lote':         s.lote || '',
      'Vencimiento':  s.vto || '',
      'Peso (g)':   s.peso || '',
      'Peso 2':   s.peso2 || '',
      'Envase':       s.envase || '',
      'Color':        s.color || '',
      'Base':         s.base_ || '',
      'Alto (cm)':    s.alto_cm || '',
      'Alto':         s.altura || '',
      'Largo (cm)':   s.largo_cm || '',
      'Largo':        s.largo || '',
      'Desgarro':     s.desgarro || '',
      'Manchas':      s.manchas || '',
      'Harina':       s.harina || '',
      'Estrías':      s.estrias || '',
      'Estivado':     s.estivado || '',
      'Miga':         s.miga || '',
      'Desgrana':     s.desgrana || '',
      'Descascara':   s.descascara || '',
      'Obs. producto':s.obs || '',
      'Puntaje Total': calcularPuntaje(s),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    autoCol(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Bollería');
  }

  if (molde.length) {
    const rows = molde.map(s => ({ ...metaS(s),
      'Lote':              s.lote || '',
      'Vencimiento':       s.vto || '',
      'Peso (g)':        s.peso || '',
      'Peso 2':        s.peso2 || '',
      'Color':             s.color || '',
      'Alto (cm)':         s.alto_cm || '',
      'Alto':              s.altura || '',
      'Forma':             s.forma || '',
      'Estivado':          s.estivado || '',
      'Miga':              s.miga || '',
      'Cant. Rebanadas':   s.reb_cant || '',
      'Grosor (cm)':       s.grosor_cm || '',
      'Grosor Rebanadas':  s.reb_grosor || '',
      'Cocción':           s.coccion || '',
      'Embollado':         s.embollado || '',
      'Desgarro':          s.desgarro || '',
      'Obs. producto':     s.obs || '',
      'Puntaje Total':     calcularPuntaje(s),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    autoCol(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Pan de Molde');
  }

  if (!bolleria.length && !molde.length) { showToast('No hay scorings para exportar', true); return; }

  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
  showToast('✓ Excel descargado');
}

/* ══ EXPORTAR SCORING DE UN DÍA ══ */
// Fecha local (no UTC): un scoring cargado a las 22:00 sigue siendo de ese día.
function fechaLocalISO(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const inputFechaScoringDia = document.getElementById('export-scoring-fecha');
if (inputFechaScoringDia) inputFechaScoringDia.value = fechaLocalISO(new Date().toISOString());

document.getElementById('btn-exportar-scoring-dia')?.addEventListener('click', () => {
  const dia = inputFechaScoringDia?.value;
  if (!dia) { showToast('Seleccioná una fecha', true); return; }

  let items = filtrarScoringProd(scoringsPorSubtipo('diario').filter(s => s.fecha && fechaLocalISO(s.fecha) === dia));
  if (state.role === 'pasante') items = items.filter(s => s.usuario === state.currentUser);

  if (!items.length) { showToast('No hay scoring diario cargado el ' + dia, true); return; }

  items.sort((a, b) => a.timestamp - b.timestamp);
  exportarScoring(items, `romero-scoring-diario-${dia}`);
});


/* ══════════════════════════════════════
   INFORMES (estilo hoja / mail)
   Los hacen calidad, admin y pasante. El pasante ve y edita solo los suyos.
══════════════════════════════════════ */
function renderPruebas() {
  const list = document.getElementById('pruebas-list');
  if (!list) return;
  const esPasante = state.role === 'pasante';
  const wrapFiltro = document.getElementById('informes-filtro-wrap');
  if (wrapFiltro) wrapFiltro.style.display = esPasante ? 'none' : '';
  const rolFiltro = document.getElementById('informes-filtro-rol')?.value || '';
  let items = state.pruebas;
  if (esPasante) items = items.filter(p => p.usuario === state.currentUser);
  else if (rolFiltro) items = items.filter(p => rolDeInforme(p) === rolFiltro);
  list.innerHTML = items.length ? items.map(buildPruebaCard).join('') : emptyMsg();
}

// Rol de quien hizo el informe (los informes viejos no guardaban el rol: se busca por nombre de usuario)
function rolDeInforme(p) {
  if (p.rol) return p.rol;
  const u = Object.values(USERS).find(x => x.nombre === p.usuario);
  return u ? u.role : 'calidad';
}

document.getElementById('informes-filtro-rol')?.addEventListener('change', renderPruebas);

function buildPruebaCard(p) {
  const rol = rolDeInforme(p);
  const rolLabel = { admin: 'ADMIN', calidad: 'CALIDAD', pasante: 'PASANTE' }[rol] || rol.toUpperCase();
  const puedeEditar = state.role !== 'pasante' || p.usuario === state.currentUser;
  const crudHtml = puedeEditar ? `
      <div class="crud-btns" onclick="event.stopPropagation()">
        <button class="crud-btn edit" onclick="abrirEditorPrueba('${p.firestoreId}')">✏️ Editar</button>
        <button class="crud-btn del"  onclick="confirmarEliminarPrueba('${p.firestoreId}')">🗑️ Eliminar</button>
      </div>` : '';
  const editTag = p.editado ? `<span class="badge-editado">editado</span>` : '';
  const textoPlano = (p.contenido || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview = textoPlano.slice(0, 140);
  return `
    <div class="registro-card prueba-card rol-${rol}" onclick="abrirEditorPrueba('${p.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">${p.asunto || '(Sin asunto)'} ${editTag} <span class="role-tag ${rol}">${rolLabel}</span></div>
      </div>
      <div class="registro-meta">${formatFecha(p.fecha)} · ${p.usuario}</div>
      ${preview ? `<div class="prueba-preview">${preview}${textoPlano.length > 140 ? '…' : ''}</div>` : ''}
      ${crudHtml}
    </div>`;
}

window.abrirEditorPrueba = function(firestoreId) {
  state.editandoPruebaId = firestoreId || null;
  const overlay = document.getElementById('prueba-editor-overlay');
  const asunto  = document.getElementById('prueba-asunto');
  const body    = document.getElementById('prueba-body');
  const meta    = document.getElementById('prueba-meta');
  if (!overlay || !asunto || !body || !meta) return;

  if (firestoreId) {
    const p = state.pruebas.find(x => x.firestoreId === firestoreId);
    if (!p) return;
    if (state.role === 'pasante' && p.usuario !== state.currentUser) return;
    asunto.value = p.asunto || '';
    body.innerHTML = p.contenido || '';
    meta.textContent = `${p.usuario} · ${formatFecha(p.fecha)}${p.editado ? ' · (editado)' : ''}`;
  } else {
    asunto.value = '';
    body.innerHTML = '';
    meta.textContent = `${state.currentUser} · ${formatFecha(new Date().toISOString())}`;
  }
  overlay.style.display = 'flex';
  setTimeout(() => asunto.focus(), 50);
};

function cerrarEditorPrueba() {
  const overlay = document.getElementById('prueba-editor-overlay');
  if (overlay) overlay.style.display = 'none';
  state.editandoPruebaId = null;
}
document.getElementById('btn-cerrar-prueba')?.addEventListener('click', cerrarEditorPrueba);
document.getElementById('prueba-editor-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'prueba-editor-overlay') cerrarEditorPrueba();
});

document.getElementById('btn-nueva-prueba')?.addEventListener('click', () => window.abrirEditorPrueba());

/* Barra de formato — como un editor de mail: título, subtítulo, texto, negrita, ítems */
document.querySelectorAll('#prueba-editor-overlay .hoja-toolbar button[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    const body = document.getElementById('prueba-body');
    const cmd = btn.dataset.cmd;
    body.focus();
    if (cmd === 'titulo')      document.execCommand('formatBlock', false, 'h2');
    else if (cmd === 'subtitulo') document.execCommand('formatBlock', false, 'h3');
    else if (cmd === 'texto')  document.execCommand('formatBlock', false, 'p');
    else if (cmd === 'bold')   document.execCommand('bold');
    else if (cmd === 'item')   document.execCommand('insertUnorderedList');
    else if (cmd === 'clear') {
      if (confirm('¿Vaciar todo el contenido del informe?')) body.innerHTML = '';
    }
  });
});

document.getElementById('btn-guardar-prueba')?.addEventListener('click', async () => {
  const asunto    = leerCampo('prueba-asunto');
  const bodyEl    = document.getElementById('prueba-body');
  const contenido = bodyEl ? bodyEl.innerHTML.trim() : '';
  if (!asunto) { showToast('Ingresá un asunto', true); return; }
  if (!contenido || contenido === '<br>') { showToast('Escribí algo en el contenido', true); return; }

  const btn = document.getElementById('btn-guardar-prueba');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';

  try {
    if (state.editandoPruebaId) {
      await updateDoc(doc(db, COL_PRUEBAS, state.editandoPruebaId), {
        asunto, contenido, editado: true, fechaEdicion: new Date().toISOString(),
      });
      showToast('✓ Informe actualizado');
    } else {
      const ahora = new Date();
      await addDoc(collection(db, COL_PRUEBAS), {
        asunto, contenido,
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        usuario: state.currentUser, rol: state.role,
      });
      showToast('✓ Informe guardado');
    }
    btn.disabled = false; btn.textContent = 'GUARDAR ✓';
    cerrarEditorPrueba();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
    btn.disabled = false; btn.textContent = 'GUARDAR ✓';
  }
});

window.confirmarEliminarPrueba = function(firestoreId) {
  const overlay = document.getElementById('confirm-overlay');
  const msg     = document.getElementById('confirm-msg');
  if (!overlay || !msg) return;
  msg.textContent = '¿Eliminás este informe? Esta acción no se puede deshacer.';
  overlay.style.display = 'flex';
  document.getElementById('confirm-si').onclick = async () => {
    overlay.style.display = 'none';
    try {
      await deleteDoc(doc(db, COL_PRUEBAS, firestoreId));
      showToast('✓ Eliminado correctamente');
    } catch (e) {
      showToast('Error al eliminar: ' + e.message, true);
    }
  };
  document.getElementById('confirm-no').onclick = () => { overlay.style.display = 'none'; };
};


/* ════════════════════════════════════════════════════════════
   v1.14 — BOTONES SW (Sin alarma / OK / Observación, etc.)
   Se usan en: Análisis
════════════════════════════════════════════════════════════ */
document.querySelectorAll('.sw-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const grp = btn.dataset.grp;
    document.querySelectorAll(`.sw-btn[data-grp="${grp}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const det = document.getElementById(`sw-detail-${grp}`);
    if (det) det.style.display = btn.dataset.detalle ? 'block' : 'none';
    if (det && !btn.dataset.detalle) {
      const t = document.getElementById(`sw-obs-${grp}`);
      if (t) t.value = '';
    }
  });
});

function swLeer(grp) {
  const b = document.querySelector(`.sw-btn.selected[data-grp="${grp}"]`);
  if (!b) return { estado: '', obs: '' };
  return { estado: b.dataset.v, obs: b.dataset.detalle ? leerCampo(`sw-obs-${grp}`) : '' };
}

function swSet(grp, estado, obs) {
  document.querySelectorAll(`.sw-btn[data-grp="${grp}"]`).forEach(b => {
    b.classList.toggle('selected', !!estado && b.dataset.v === estado);
  });
  const conDetalle = !!document.querySelector(`.sw-btn.selected[data-grp="${grp}"][data-detalle]`);
  const det = document.getElementById(`sw-detail-${grp}`);
  const t   = document.getElementById(`sw-obs-${grp}`);
  if (det) det.style.display = conDetalle ? 'block' : 'none';
  if (t)   t.value = conDetalle ? (obs || '') : '';
}

function swLimpiarEn(selector) {
  document.querySelectorAll(`${selector} .sw-btn.selected`).forEach(b => b.classList.remove('selected'));
  document.querySelectorAll(`${selector} .sw-detail`).forEach(d => { d.style.display = 'none'; });
}

/* ══ UTILS NUEVAS PESTAÑAS ══ */
const COL_ANALISIS = 'calidad-analisis';

// Medios de cultivo base. Los que se agregan con "Otro" se suman solos a la lista
// (se toman de los análisis ya guardados).
const MEDIOS_BASE = ['PCA', 'Cloranfenicol Glucosa'];
const SECTORES_BASE = ['Recepción', 'Formulación', 'Fabricación', 'Cámara de fermento', 'Horno', 'Enfriador', 'Envase'];

state.analisis = [];
state.unsubAna = null;
let editAnalisisId = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function hoyISO() { return fechaLocalISO(new Date().toISOString()); }

function fechaCorta(iso) {
  return iso ? iso.split('-').reverse().join('/') : '—';
}

function irATab(tabId) {
  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function rangoFechas(prefijo) {
  return {
    desde: document.getElementById(`${prefijo}-filtro-desde`)?.value || '',
    hasta: document.getElementById(`${prefijo}-filtro-hasta`)?.value || '',
  };
}

function modalCampo(label, val, cls = 'modal-campo-valor') {
  return val ? `<div class="modal-campo"><div class="modal-campo-label">${esc(label)}</div><div class="${cls}">${esc(val)}</div></div>` : '';
}
function modalSeccion(titulo, campos) {
  const c = campos.filter(Boolean).join('');
  return c ? `<div class="modal-seccion"><div class="modal-seccion-title">${esc(titulo)}</div>${c}</div>` : '';
}

function confirmarEliminarGenerico(firestoreId, coleccion, texto) {
  const overlay = document.getElementById('confirm-overlay');
  const msg     = document.getElementById('confirm-msg');
  if (!overlay || !msg) return;
  msg.textContent = `¿Eliminás ${texto}? Esta acción no se puede deshacer.`;
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
}

function descargarHojas(hojas, nombreArchivo) {
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    autoCol(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });
  XLSX.writeFile(wb, `${nombreArchivo}-${hoyISO()}.xlsx`);
  showToast('✓ Excel descargado');
}

/* ══ FIRESTORE ══ */
function suscribirAnalisis() {
  const q = query(collection(db, COL_ANALISIS), orderBy('timestamp', 'desc'));
  state.unsubAna = onSnapshot(q, snap => {
    state.analisis = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    refrescarVistas();
  }, err => showToast(msgErrFirestore(err, COL_ANALISIS), true));
}

function resetNuevasPestanas() {
  if (state.unsubAna) state.unsubAna();
  state.analisis = [];
  state.unsubAna = null;
  limpiarAnalisis();
}

/* Al entrar a las pestañas: fecha de hoy y responsable por defecto */
document.querySelector('#tabs-main .vis-tab[data-tab="tab-analisis"]')?.addEventListener('click', () => {
  if (editAnalisisId) return;
  if (!leerCampo('an-fecha-toma')) document.getElementById('an-fecha-toma').value = hoyISO();
  renderMediosSelect();
});

/* ════════════════════════════════════════════════════════════
   ANÁLISIS — placas ambientales e hisopados
════════════════════════════════════════════════════════════ */
function mediosDisponibles() {
  const base = new Map(MEDIOS_BASE.map(m => [m.toLowerCase(), m]));
  const extra = new Map();
  state.analisis.forEach(a => {
    const m = (a.medio || '').trim();
    if (m && !base.has(m.toLowerCase()) && !extra.has(m.toLowerCase())) extra.set(m.toLowerCase(), m);
  });
  return [...MEDIOS_BASE, ...[...extra.values()].sort((a, b) => a.localeCompare(b, 'es'))];
}

function renderMediosSelect() {
  const sel = document.getElementById('an-medio');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">Seleccionar medio...</option>'
    + mediosDisponibles().map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')
    + '<option value="__otro__">➕ Otro (agregar nuevo)...</option>';
  sel.value = [...sel.options].some(o => o.value === actual) ? actual : '';
}

function sectoresDisponibles() {
  const base = new Set(SECTORES_BASE.map(m => m.toLowerCase()));
  const extra = new Map();
  state.analisis.forEach(a => {
    const m = (a.punto || '').trim();
    if (m && !base.has(m.toLowerCase()) && !extra.has(m.toLowerCase())) extra.set(m.toLowerCase(), m);
  });
  return [...SECTORES_BASE, ...[...extra.values()].sort((a, b) => a.localeCompare(b, 'es'))];
}

function renderSectoresSelect() {
  const sel = document.getElementById('an-punto');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">Seleccionar sector / equipo...</option>'
    + sectoresDisponibles().map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')
    + '<option value="__otro__">➕ Otro (agregar nuevo)...</option>';
  sel.value = [...sel.options].some(o => o.value === actual) ? actual : '';
}

function actualizarCamposAnalisis() {
  const esPlaca = swLeer('an-tipo').estado === 'Placa ambiental';
  const wrap = document.getElementById('an-exposicion-wrap');
  if (wrap) wrap.style.display = esPlaca ? 'block' : 'none';
  if (!esPlaca) { const e = document.getElementById('an-exposicion'); if (e) e.value = ''; }
  const otro = document.getElementById('an-medio')?.value === '__otro__';
  const otroWrap = document.getElementById('an-medio-otro-wrap');
  if (otroWrap) otroWrap.style.display = otro ? 'block' : 'none';
  const puntoOtro = document.getElementById('an-punto')?.value === '__otro__';
  const puntoWrap = document.getElementById('an-punto-otro-wrap');
  if (puntoWrap) puntoWrap.style.display = puntoOtro ? 'block' : 'none';
}

document.querySelectorAll('.sw-btn[data-grp="an-tipo"]').forEach(b => b.addEventListener('click', actualizarCamposAnalisis));
document.getElementById('an-medio')?.addEventListener('change', actualizarCamposAnalisis);
document.getElementById('an-punto')?.addEventListener('change', actualizarCamposAnalisis);
renderMediosSelect();
renderSectoresSelect();

function leerAnalisis() {
  const sel = leerCampo('an-medio');
  let medio = sel === '__otro__' ? leerCampo('an-medio-otro') : sel;
  if (sel === '__otro__' && medio) {
    const existente = mediosDisponibles().find(m => m.toLowerCase() === medio.toLowerCase());
    if (existente) medio = existente;
  }
  const selPunto = leerCampo('an-punto');
  let punto = selPunto === '__otro__' ? leerCampo('an-punto-otro') : selPunto;
  if (selPunto === '__otro__' && punto) {
    const existente = sectoresDisponibles().find(m => m.toLowerCase() === punto.toLowerCase());
    if (existente) punto = existente;
  }
  const tipo = swLeer('an-tipo').estado;
  return {
    tipo_muestra:   tipo,
    fecha_toma:     leerCampo('an-fecha-toma'),
    punto,
    medio,
    exposicion_min: tipo === 'Placa ambiental' ? leerCampo('an-exposicion') : '',
    fecha_lectura:  leerCampo('an-fecha-lectura'),
    recuento:       leerCampo('an-recuento'),
    conformidad:    swLeer('an-conf').estado,
    obs:            leerCampo('an-obs'),
  };
}

function limpiarAnalisis() {
  document.querySelectorAll('#analisis-form input, #analisis-form textarea').forEach(el => { el.value = ''; });
  swLimpiarEn('#analisis-form');
  const sel = document.getElementById('an-medio');
  if (sel) sel.value = '';
  const selP = document.getElementById('an-punto');
  if (selP) selP.value = '';
  editAnalisisId = null;
  actualizarCamposAnalisis();
  const btn = document.getElementById('btn-guardar-analisis');
  if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR ANÁLISIS ✓'; }
  const can = document.getElementById('btn-cancelar-analisis');
  if (can) can.style.display = 'none';
  const f = document.getElementById('an-fecha-toma');
  if (f && state.role) f.value = hoyISO();
}

document.getElementById('btn-cancelar-analisis')?.addEventListener('click', limpiarAnalisis);

document.getElementById('btn-guardar-analisis')?.addEventListener('click', async () => {
  const d = leerAnalisis();
  if (!d.tipo_muestra) { showToast('Elegí placa ambiental o hisopado', true); return; }
  if (!d.fecha_toma)   { showToast('Indicá la fecha de toma', true); return; }
  if (leerCampo('an-punto') === '__otro__' && !d.punto) { showToast('Escribí el nombre del nuevo sector / equipo', true); return; }
  if (!d.medio)        { showToast(leerCampo('an-medio') === '__otro__' ? 'Escribí el nombre del nuevo medio' : 'Seleccioná el medio de cultivo', true); return; }

  const btn = document.getElementById('btn-guardar-analisis');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';
  try {
    const ahora = new Date();
    if (editAnalisisId) {
      await updateDoc(doc(db, COL_ANALISIS, editAnalisisId), { ...d, editado: true, fechaEdicion: ahora.toISOString() });
      showToast('✓ Análisis actualizado correctamente');
    } else {
      await addDoc(collection(db, COL_ANALISIS), {
        timestamp: ahora.getTime(), fecha: ahora.toISOString(),
        usuario: state.currentUser, rol: state.role, tipo: 'analisis', ...d,
      });
      showToast('✓ Análisis guardado correctamente');
    }
    limpiarAnalisis();
  } catch (e) {
    showToast(msgErrFirestore(e, COL_ANALISIS), true);
    btn.disabled = false;
    btn.textContent = editAnalisisId ? 'ACTUALIZAR ANÁLISIS ✓' : 'GUARDAR ANÁLISIS ✓';
  }
});

function itemsAnalisis() {
  const f = rangoFechas('analisis');
  let items = state.analisis.filter(a => (!f.desde || (a.fecha_toma || '') >= f.desde) && (!f.hasta || (a.fecha_toma || '') <= f.hasta));
  if (state.role === 'pasante') items = items.filter(a => a.usuario === state.currentUser);
  return items;
}

function buildAnalisisCard(a, showCrud) {
  const crud = (showCrud && canCRUD()) ? `
    <div class="crud-btns" onclick="event.stopPropagation()">
      <button class="crud-btn edit" onclick="editarAnalisis('${a.firestoreId}')">✏️ Editar</button>
      <button class="crud-btn del"  onclick="eliminarAnalisis('${a.firestoreId}')">🗑️ Eliminar</button>
    </div>` : '';
  const editTag = a.editado ? `<span class="badge-editado">editado</span>` : '';
  let estado = '<span class="badge-pend">PENDIENTE DE LECTURA</span>';
  if (a.conformidad === 'Conforme')    estado = '<span class="badge-cat">CONFORME</span>';
  if (a.conformidad === 'No conforme') estado = '<span class="badge-nc">NO CONFORME</span>';
  return `
    <div class="registro-card analisis-card" onclick="verAnalisis('${a.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">${esc(a.tipo_muestra)} ${editTag}</div>
        ${estado}
      </div>
      <div class="registro-meta">${fechaCorta(a.fecha_toma)} · ${esc(a.medio)}${a.punto ? ' · ' + esc(a.punto) : ''} · ${esc(a.usuario)}</div>
      ${crud}
    </div>`;
}

function renderAnalisis() {
  renderMediosSelect();
  renderSectoresSelect();
  const list = document.getElementById('analisis-list');
  if (list) {
    const items = itemsAnalisis();
    list.innerHTML = items.length ? items.map(a => buildAnalisisCard(a, true)).join('') : emptyMsg();
  }
  const vis = document.getElementById('vis-analisis-list');
  if (vis) vis.innerHTML = state.analisis.length ? state.analisis.map(a => buildAnalisisCard(a, false)).join('') : emptyMsg();
}

['analisis-filtro-desde', 'analisis-filtro-hasta'].forEach(id => document.getElementById(id)?.addEventListener('change', renderAnalisis));
document.getElementById('btn-analisis-limpiar')?.addEventListener('click', () => {
  ['analisis-filtro-desde', 'analisis-filtro-hasta'].forEach(id => { document.getElementById(id).value = ''; });
  renderAnalisis();
});

window.eliminarAnalisis = id => confirmarEliminarGenerico(id, COL_ANALISIS, 'este análisis');

window.editarAnalisis = function(firestoreId) {
  const a = state.analisis.find(x => x.firestoreId === firestoreId);
  if (!a) return;
  irATab('tab-analisis');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  swSet('an-tipo', a.tipo_muestra, '');
  swSet('an-conf', a.conformidad, '');
  set('an-fecha-toma', a.fecha_toma);
  set('an-exposicion', a.exposicion_min);
  set('an-fecha-lectura', a.fecha_lectura);
  set('an-recuento', a.recuento);
  set('an-obs', a.obs);
  renderMediosSelect();
  renderSectoresSelect();
  const selP = document.getElementById('an-punto');
  if (!a.punto) { selP.value = ''; set('an-punto-otro', ''); }
  else if ([...selP.options].some(o => o.value === a.punto)) { selP.value = a.punto; set('an-punto-otro', ''); }
  else { selP.value = '__otro__'; set('an-punto-otro', a.punto); }
  const sel = document.getElementById('an-medio');
  if ([...sel.options].some(o => o.value === a.medio)) {
    sel.value = a.medio;
    set('an-medio-otro', '');
  } else {
    sel.value = '__otro__';
    set('an-medio-otro', a.medio);
  }
  actualizarCamposAnalisis();
  editAnalisisId = firestoreId;
  document.getElementById('btn-guardar-analisis').textContent = 'ACTUALIZAR ANÁLISIS ✓';
  document.getElementById('btn-cancelar-analisis').style.display = 'block';
  showToast('Editando análisis — modificá y guardá');
};

window.verAnalisis = function(firestoreId) {
  const a = state.analisis.find(x => x.firestoreId === firestoreId);
  if (!a) return;
  document.getElementById('modal-titulo').textContent = `Análisis — ${a.tipo_muestra}`;
  document.getElementById('modal-meta').textContent =
    `${fechaCorta(a.fecha_toma)} · ${a.usuario} · ${formatFecha(a.fecha)}${a.editado ? ' · (editado)' : ''}`;
  const confCls = a.conformidad === 'Conforme' ? 'modal-campo-valor ok-t' : 'modal-campo-valor danger';
  document.getElementById('modal-body').innerHTML = [
    modalSeccion('Muestra', [
      modalCampo('Tipo', a.tipo_muestra),
      modalCampo('Fecha de toma', fechaCorta(a.fecha_toma)),
      modalCampo('Sector / equipo', a.punto),
      modalCampo('Medio de cultivo', a.medio),
      modalCampo('Exposición', a.exposicion_min ? a.exposicion_min + ' min' : ''),
    ]),
    modalSeccion('Lectura', [
      modalCampo('Fecha de lectura', a.fecha_lectura ? fechaCorta(a.fecha_lectura) : ''),
      modalCampo('Recuento (UFC)', a.recuento),
      modalCampo('Resultado', a.conformidad, confCls),
      modalCampo('Observaciones', a.obs),
    ]),
  ].join('');
  document.getElementById('modal-overlay').style.display = 'flex';
};

document.getElementById('btn-analisis-excel')?.addEventListener('click', () => {
  const items = itemsAnalisis();
  if (!items.length) { showToast('No hay análisis para exportar', true); return; }
  const rows = items.map(a => ({
    'Fecha de toma':     fechaCorta(a.fecha_toma),
    'Tipo de muestra':   a.tipo_muestra || '',
    'Sector / equipo': a.punto || '',
    'Medio de cultivo':  a.medio || '',
    'Exposición (min)':  a.exposicion_min || '',
    'Fecha de lectura':  a.fecha_lectura ? fechaCorta(a.fecha_lectura) : '',
    'Recuento (UFC)':    a.recuento || '',
    'Resultado':         a.conformidad || '',
    'Observaciones':     a.obs || '',
    'Cargado por':       a.usuario || '',
    'Fecha de carga':    a.fecha ? new Date(a.fecha).toLocaleString('es-AR') : '',
  }));
  descargarHojas({ 'Análisis': rows }, 'romero-analisis');
});


/* ══ v1.15 — Filtro por categoría / producto en Historial de Scoring ══ */
function poblarFiltroProductos() {
  const cat = document.getElementById('filtro-categoria')?.value || '';
  const sel = document.getElementById('filtro-producto');
  if (!sel) return;
  const lista = cat === 'bolleria' ? PRODUCTOS_BOLLERIA
              : cat === 'molde'    ? PRODUCTOS_MOLDE
              : [...PRODUCTOS_BOLLERIA, ...PRODUCTOS_MOLDE];
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + lista.map(p => `<option value="${p}">${p}</option>`).join('');
  sel.value = lista.includes(actual) ? actual : '';
}

function filtrarScoringProd(items) {
  const cat  = document.getElementById('filtro-categoria')?.value || '';
  const prod = document.getElementById('filtro-producto')?.value || '';
  return items.filter(s => (!cat || s.categoria === cat) && (!prod || s.producto === prod));
}

document.getElementById('filtro-categoria')?.addEventListener('change', () => { poblarFiltroProductos(); renderHistorial(); });
document.getElementById('filtro-producto')?.addEventListener('change', renderHistorial);
poblarFiltroProductos();


function msgErrFirestore(e, coleccion) {
  if (e && (e.code === 'permission-denied' || /permission/i.test(e.message || '')))
    return `Sin permiso en Firestore: habilitá la colección "${coleccion}" en las reglas`;
  return 'Error: ' + (e?.message || e);
}


/* ════════════════════════════════════════════════════════════
   v1.16 — ESTADÍSTICAS (Chart.js)
════════════════════════════════════════════════════════════ */
const STATS_COL = { accent:'#378add', green:'#4caf50', amber:'#c8860a', red:'#e8452c', muted:'#6a8faf', grid:'#2e4a66' };
const statsCharts = {};

function numTemp(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function statsHTML(p) {
  const wrap = (k, titulo) => `
    <div class="card">
      <div class="card-title">${titulo}</div>
      <div id="${p}-wrap-${k}">
        <div class="chart-wrap"><canvas id="${p}-cv-${k}"></canvas></div>
        <div class="empty-msg chart-empty" style="display:none">Sin datos para el período elegido.</div>
      </div>
    </div>`;
  return `
    <div class="card">
      <div class="card-title">Filtros</div>
      <div class="filtros-grid">
        <div class="field mb-0"><label>Fecha desde</label><input type="date" id="${p}-desde"></div>
        <div class="field mb-0"><label>Fecha hasta</label><input type="date" id="${p}-hasta"></div>
        <div class="field mb-0"><label>Categoría (scoring)</label>
          <select id="${p}-cat"><option value="">Todas</option><option value="bolleria">Bollería</option><option value="molde">Pan de molde</option></select></div>
        <div class="field mb-0"><label>Producto (scoring)</label>
          <select id="${p}-prod"><option value="">Todos</option></select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-sm btn-outline" id="${p}-btn-30" style="flex:1">ÚLTIMOS 30 DÍAS</button>
        <button class="btn btn-sm btn-outline" id="${p}-btn-todo" style="flex:1">TODO</button>
      </div>
    </div>
    <div class="kpi-grid" id="${p}-kpis"></div>
    ${wrap('prod', 'Puntaje promedio por producto')}
    ${wrap('dia', 'Evolución del puntaje promedio')}
    ${wrap('horno', 'Temperaturas del horno')}
    ${wrap('ana', 'Placas ambientales — conformes y no conformes por sector / equipo')}`;
}

function statsProductos(p) {
  const cat = document.getElementById(`${p}-cat`).value;
  const lista = cat === 'bolleria' ? PRODUCTOS_BOLLERIA : cat === 'molde' ? PRODUCTOS_MOLDE : [...PRODUCTOS_BOLLERIA, ...PRODUCTOS_MOLDE];
  const sel = document.getElementById(`${p}-prod`);
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + lista.map(x => `<option value="${x}">${x}</option>`).join('');
  sel.value = lista.includes(actual) ? actual : '';
}

function statsUltimos30(p) {
  const d = new Date(); d.setDate(d.getDate() - 29);
  document.getElementById(`${p}-desde`).value = fechaLocalISO(d.toISOString());
  document.getElementById(`${p}-hasta`).value = '';
}

function initStats(p) {
  const root = document.getElementById(`${p}-root`);
  if (!root || root.firstChild) return;
  root.innerHTML = statsHTML(p);
  statsProductos(p);
  statsUltimos30(p);
  document.getElementById(`${p}-cat`).addEventListener('change', () => { statsProductos(p); renderStats(p); });
  ['desde', 'hasta', 'prod'].forEach(k => document.getElementById(`${p}-${k}`).addEventListener('change', () => renderStats(p)));
  document.getElementById(`${p}-btn-30`).addEventListener('click', () => { statsUltimos30(p); renderStats(p); });
  document.getElementById(`${p}-btn-todo`).addEventListener('click', () => {
    document.getElementById(`${p}-desde`).value = ''; document.getElementById(`${p}-hasta`).value = ''; renderStats(p);
  });
}

function drawChart(p, k, cfg, hayDatos) {
  const key = p + k;
  if (statsCharts[key]) { statsCharts[key].destroy(); delete statsCharts[key]; }
  const wrap = document.getElementById(`${p}-wrap-${k}`);
  if (!wrap) return;
  wrap.querySelector('.chart-wrap').style.display = hayDatos ? '' : 'none';
  wrap.querySelector('.chart-empty').style.display = hayDatos ? 'none' : 'block';
  if (!hayDatos || typeof Chart === 'undefined') return;
  statsCharts[key] = new Chart(document.getElementById(`${p}-cv-${k}`), cfg);
}

function chartOpts(extra = {}, conEjes = true) {
  const o = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: STATS_COL.muted, font: { family: 'DM Mono', size: 11 } } } },
    ...extra,
  };
  if (conEjes) {
    const eje = { ticks: { color: STATS_COL.muted, font: { family: 'DM Mono', size: 10 } }, grid: { color: STATS_COL.grid } };
    o.scales = { x: { ...eje, ...(extra.scales?.x || {}) }, y: { ...eje, ...(extra.scales?.y || {}) } };
  }
  return o;
}

function promedio(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
const r1 = n => n === null ? null : Math.round(n * 10) / 10;

function renderStats(p) {
  const root = document.getElementById(`${p}-root`);
  if (!root || !root.firstChild) return;
  const v = k => document.getElementById(`${p}-${k}`).value;
  const desde = v('desde'), hasta = v('hasta'), cat = v('cat'), prod = v('prod');
  const enRango = d => !!d && (!desde || d >= desde) && (!hasta || d <= hasta);
  const propio = x => state.role !== 'pasante' || x.usuario === state.currentUser;

  const regs   = state.registros.filter(r => propio(r) && r.fecha && enRango(fechaLocalISO(r.fecha)));
  const scs    = state.scorings.filter(s => propio(s) && s.fecha && enRango(fechaLocalISO(s.fecha)) && (!cat || s.categoria === cat) && (!prod || s.producto === prod));
  const anas   = state.analisis.filter(x => propio(x) && enRango(x.fecha_toma));

  const puntuados = scs.map(s => ({ s, pt: calcularPuntaje(s) })).filter(x => x.pt !== '');
  const ptoProm = r1(promedio(puntuados.map(x => x.pt)));
  const leidos = anas.filter(a => a.conformidad);
  const conf = leidos.filter(a => a.conformidad === 'Conforme').length;

  const kpi = (val, label) => `<div class="kpi"><div class="kpi-val">${val}</div><div class="kpi-label">${label}</div></div>`;
  document.getElementById(`${p}-kpis`).innerHTML = [
    kpi(scs.length, 'Scorings'),
    kpi(ptoProm === null ? '—' : ptoProm, 'Puntaje promedio'),
    kpi(regs.length, 'Registros'),
    kpi(anas.length, 'Análisis'),
    kpi(leidos.length ? Math.round(conf / leidos.length * 100) + '%' : '—', 'Análisis conformes'),
  ].join('');

  // 1) Puntaje por producto
  const porProd = {};
  puntuados.forEach(x => { (porProd[x.s.producto || '—'] ||= []).push(x.pt); });
  const prodLabels = Object.keys(porProd).sort();
  drawChart(p, 'prod', {
    type: 'bar',
    data: { labels: prodLabels, datasets: [{ label: 'Puntaje promedio', data: prodLabels.map(k => r1(promedio(porProd[k]))), backgroundColor: STATS_COL.accent, borderRadius: 6 }] },
    options: chartOpts({ scales: { y: { beginAtZero: true } } }),
  }, prodLabels.length > 0);

  // 2) Evolución por día
  const porDia = {};
  puntuados.forEach(x => { (porDia[fechaLocalISO(x.s.fecha)] ||= []).push(x.pt); });
  const dias = Object.keys(porDia).sort();
  drawChart(p, 'dia', {
    type: 'line',
    data: { labels: dias.map(fechaCorta), datasets: [{ label: 'Puntaje promedio', data: dias.map(d => r1(promedio(porDia[d]))), borderColor: STATS_COL.green, backgroundColor: 'rgba(76,175,80,.15)', fill: true, tension: .25, pointRadius: 3 }] },
    options: chartOpts({ scales: { y: { beginAtZero: true } } }),
  }, dias.length > 0);

  // 3) Temperaturas del horno
  const ord = [...regs].sort((a, b) => a.timestamp - b.timestamp);
  const labels = ord.map(r => new Date(r.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const series = [
    ['Zona 1', r => numTemp(r.horno?.z1), STATS_COL.accent],
    ['Zona 2', r => numTemp(r.horno?.z2), STATS_COL.green],
    ['Combustión Z1', r => numTemp(r.horno?.comb_z1), STATS_COL.amber],
    ['Combustión Z2', r => numTemp(r.horno?.comb_z2), STATS_COL.red],
  ].map(([label, fn, color]) => ({ label, data: ord.map(fn), borderColor: color, backgroundColor: color, tension: .25, pointRadius: 3, spanGaps: true }))
   .filter(d => d.data.some(x => x !== null));
  drawChart(p, 'horno', { type: 'line', data: { labels, datasets: series }, options: chartOpts() }, series.length > 0);

  // 4) Placas ambientales — conformes / no conformes por sector o equipo (lineal)
  const placas = anas.filter(a => a.tipo_muestra === 'Placa ambiental');
  const porPunto = new Map();
  placas.forEach(a => {
    const nombre = (a.punto || '').trim() || 'Sin sector / equipo';
    const k = nombre.toLowerCase();
    const o = porPunto.get(k) || { nombre, c: 0, n: 0 };
    if (a.conformidad === 'Conforme') o.c++;
    else if (a.conformidad === 'No conforme') o.n++;
    porPunto.set(k, o);
  });
  const puntos = [...porPunto.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  const tickY = { color: STATS_COL.muted, font: { family: 'DM Mono', size: 10 }, precision: 0 };
  drawChart(p, 'ana', {
    type: 'line',
    data: { labels: puntos.map(x => x.nombre), datasets: [
      { label: 'Conforme',    data: puntos.map(x => x.c), borderColor: STATS_COL.green, backgroundColor: STATS_COL.green, tension: .25, pointRadius: 4 },
      { label: 'No conforme', data: puntos.map(x => x.n), borderColor: STATS_COL.red,   backgroundColor: STATS_COL.red,   tension: .25, pointRadius: 4 },
    ] },
    options: chartOpts({
      scales: { y: { beginAtZero: true, ticks: tickY, title: { display: true, text: 'Cantidad de registros', color: STATS_COL.muted } } },
    }),
  }, puntos.length > 0);
}

function renderStatsVisibles() {
  ['st', 'vst'].forEach(p => {
    const root = document.getElementById(`${p}-root`);
    if (root && root.closest('.vis-tab-content')?.classList.contains('active')) renderStats(p);
  });
}

document.querySelector('#tabs-main .vis-tab[data-tab="tab-stats"]')?.addEventListener('click', () => { initStats('st'); renderStats('st'); });
document.querySelector('#screen-vis .vis-tab[data-tab="tab-vis-stats"]')?.addEventListener('click', () => { initStats('vst'); renderStats('vst'); });
