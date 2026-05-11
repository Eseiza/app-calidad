import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy
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

/* ══ USUARIOS ══ */
const USERS = {
  "calidad1":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad 1" },
  "calidad2":  { password: "Calidad.2026",  role: "calidad",      nombre: "Calidad 2" },
  "pasanteM":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TM" },
  "pasanteT":  { password: "Pasante.2026",  role: "pasante",      nombre: "Pasante TT" },
  "Admin":     { password: "Admin.2026",    role: "admin",        nombre: "Administrador" },
  "viewer":    { password: "Viewer.2026",   role: "visualizador", nombre: "Visualizador" },
};

/* ══ STATE ══ */
const state = {
  role: null, currentUser: '',
  registros: [], scorings: [],
  turnoActivo: null,
  turnoScoringActivo: null,
  categoriaActiva: 'envase',
  historialTipo: 'registros',
  transportes: { t1: null, t2: null, t3: null },
  unsubReg: null, unsubSco: null,
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

function refrescarVistas() {
  const tabH    = document.getElementById('tab-historial');
  const tabVisH = document.getElementById('tab-vis-partes');
  const tabVisS = document.getElementById('tab-vis-scoring');
  if (tabH    && tabH.classList.contains('active'))    renderHistorial();
  if (tabVisH && tabVisH.classList.contains('active')) renderHistorialVis();
  if (tabVisS && tabVisS.classList.contains('active')) renderScoringVis();
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
  Object.assign(state, { role:null, currentUser:'', registros:[], scorings:[], turnoActivo:null, turnoScoringActivo:null });
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
      if (tab.dataset.tab === 'tab-vis-partes') renderHistorialVis();
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

    // Mostrar grupo de productos y form correspondiente
    ['envase','bolleria','molde'].forEach(cat => {
      const gEl = document.getElementById(`scoring-productos-${cat}`);
      const fEl = document.getElementById(`scoring-form-${cat}`);
      const isActive = cat === btn.dataset.cat;
      if (gEl) { gEl.classList.toggle('active', isActive); }
      if (fEl) { fEl.classList.toggle('active', isActive); }
    });
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

/* ══ TRANSPORTES ══ */
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.t;
    // Deseleccionar ambos del mismo transporte
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
  const camProd = leerCampo('cam-producto') === 'Otro' ? leerCampo('cam-producto-otro') : leerCampo('cam-producto');
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
      set_temp:    leerCampo('cam-set-temp'),
      temp:        leerCampo('cam-temp'),
      set_hum:     leerCampo('cam-set-hum'),
      hum:         leerCampo('cam-hum'),
      producto:    camProd,
      hora_entrada: leerCampo('cam-hora-entrada'),
      hora_salida:  leerCampo('cam-hora-salida'),
      obs:         leerCampo('cam-obs'),
    },
    horno: {
      set_z1:      leerCampo('horn-set-z1'),
      z1:          leerCampo('horn-z1'),
      set_z2:      leerCampo('horn-set-z2'),
      z2:          leerCampo('horn-z2'),
      producto:    hornProd,
      tiempo_min:  leerCampo('horn-tiempo'),
      t1:          state.transportes.t1 || '',
      t2:          state.transportes.t2 || '',
      t3:          state.transportes.t3 || '',
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
    recepcion:'Recepción MP', formulacion:'Formulación', fabricacion:'Fabricación',
    camara:'Cámara', horno:'Horno', enfriador:'Enfriador',
    detector:'Detector', envase:'Envase', bolsas:'Bolsas'
  };
  const seccionesConDatos = [];
  Object.entries(datos).forEach(([key, sec]) => {
    if (Object.values(sec).some(v => v && v.trim && v.trim() !== ''))
      seccionesConDatos.push(secLabels[key] || key);
  });

  const ahora = new Date();
  const registro = {
    timestamp: ahora.getTime(), fecha: ahora.toISOString(),
    turno: state.turnoActivo, usuario: state.currentUser, rol: state.role,
    secciones: seccionesConDatos, tipo: 'registro', ...datos,
  };

  const btn = document.getElementById('btn-guardar-registro');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';
  try {
    await addDoc(collection(db, COL_REG), registro);
    showToast('✓ Registro guardado correctamente');
    limpiarFormulario();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'GUARDAR REGISTRO ✓';
  }
});

/* ══ LEER SCORING ══ */
function leerScoring() {
  const cat = state.categoriaActiva;
  const base = { categoria: cat };

  if (cat === 'envase') {
    const prod = leerCampo('sc-env-producto');
    return { ...base, producto: prod,
      lote: leerCampo('sc-env-lote'), vto: leerCampo('sc-env-vto'),
      peso: leerCampo('sc-env-peso'), color: leerCampo('sc-env-color'),
      base_: leerCampo('sc-env-base'), altura: leerCampo('sc-env-altura'),
      desgarro: leerCampo('sc-env-desgarro'), manchas: leerCampo('sc-env-manchas'),
      harina: leerCampo('sc-env-harina'), estrias: leerCampo('sc-env-estrias'),
      estivado: leerCampo('sc-env-estivado'), miga: leerCampo('sc-env-miga'),
    };
  }
  if (cat === 'bolleria') {
    const prod = leerCampo('sc-bol-producto');
    return { ...base, producto: prod,
      lote: leerCampo('sc-bol-lote'), vto: leerCampo('sc-bol-vto'),
      peso: leerCampo('sc-bol-peso'), color: leerCampo('sc-bol-color'),
      base_: leerCampo('sc-bol-base'), altura: leerCampo('sc-bol-altura'),
      desgarro: leerCampo('sc-bol-desgarro'), manchas: leerCampo('sc-bol-manchas'),
      harina: leerCampo('sc-bol-harina'), estrias: leerCampo('sc-bol-estrias'),
      estivado: leerCampo('sc-bol-estivado'), miga: leerCampo('sc-bol-miga'),
    };
  }
  if (cat === 'molde') {
    const prod = leerCampo('sc-mol-producto');
    return { ...base, producto: prod,
      lote: leerCampo('sc-mol-lote'), vto: leerCampo('sc-mol-vto'),
      peso: leerCampo('sc-mol-peso'), color: leerCampo('sc-mol-color'),
      altura: leerCampo('sc-mol-altura'), forma: leerCampo('sc-mol-forma'),
      estivado: leerCampo('sc-mol-estivado'), miga: leerCampo('sc-mol-miga'),
      reb_c: leerCampo('sc-mol-reb-c'), reb_g: leerCampo('sc-mol-reb-g'),
      coccion: leerCampo('sc-mol-coccion'), embollado: leerCampo('sc-mol-embollado'),
      desgarro: leerCampo('sc-mol-desgarro'),
    };
  }
  return base;
}

function limpiarScoring() {
  document.querySelectorAll('#tab-scoring input[type="text"], #tab-scoring select')
    .forEach(el => el.value = '');
  document.querySelectorAll('.turno-btn.turno-scoring.selected').forEach(el => el.classList.remove('selected'));
  state.turnoScoringActivo = null;
}

/* ══ GUARDAR SCORING ══ */
document.getElementById('btn-guardar-scoring').addEventListener('click', async () => {
  if (!state.turnoScoringActivo) { showToast('Seleccioná el turno', true); return; }
  const datos = leerScoring();
  if (!datos.producto) { showToast('Seleccioná un producto', true); return; }

  const tieneDatos = Object.entries(datos)
    .filter(([k]) => !['categoria','producto'].includes(k))
    .some(([, v]) => v && v.trim && v.trim() !== '');
  if (!tieneDatos) { showToast('Completá al menos un campo del scoring', true); return; }

  const ahora = new Date();
  const doc = {
    timestamp: ahora.getTime(), fecha: ahora.toISOString(),
    turno: state.turnoScoringActivo, usuario: state.currentUser, rol: state.role,
    tipo: 'scoring', ...datos,
  };

  const btn = document.getElementById('btn-guardar-scoring');
  btn.disabled = true; btn.textContent = 'GUARDANDO...';
  try {
    await addDoc(collection(db, COL_SCORING), doc);
    showToast('✓ Scoring guardado correctamente');
    limpiarScoring();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'GUARDAR SCORING ✓';
  }
});

/* ══ HISTORIAL TIPO (registros / scoring) ══ */
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

/* ══ RENDER HISTORIAL ══ */
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
  const tipo = state.historialTipo;

  if (tipo === 'registros') {
    const items = filtrarItems(state.registros, f);
    list.innerHTML = items.length ? items.map(r => buildRegistroCard(r)).join('') : emptyMsg();
  } else {
    const items = filtrarItems(state.scorings, f);
    list.innerHTML = items.length ? items.map(s => buildScoringCard(s)).join('') : emptyMsg();
  }
}

function renderHistorialVis() {
  const list = document.getElementById('vis-historial-list');
  if (!list) return;
  const f = getFilters('vis');
  const items = filtrarItems(state.registros, f);
  list.innerHTML = items.length ? items.map(r => buildRegistroCard(r)).join('') : emptyMsg();
}

function renderScoringVis() {
  const list = document.getElementById('vis-scoring-list');
  if (!list) return;
  const items = [...state.scorings];
  list.innerHTML = items.length ? items.map(s => buildScoringCard(s)).join('') : emptyMsg();
}

const turnoLabel = { 'mañana':'MAÑANA', 'tarde':'TARDE', 'noche':'NOCHE' };
const catLabel   = { 'envase':'ENVASE', 'bolleria':'BOLLERÍA', 'molde':'PAN DE MOLDE' };

function buildRegistroCard(r) {
  return `
    <div class="registro-card" onclick="verRegistro('${r.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">Registro de Calidad</div>
        <span class="badge-turno ${r.turno}">${turnoLabel[r.turno] || r.turno}</span>
      </div>
      <div class="registro-meta">${formatFecha(r.fecha)} · ${r.usuario}</div>
      <div class="secciones-completadas">
        ${(r.secciones||[]).map(s => `<span class="sec-tag">${s}</span>`).join('')}
      </div>
    </div>`;
}

function buildScoringCard(s) {
  return `
    <div class="registro-card scoring-card" onclick="verScoring('${s.firestoreId}')">
      <div class="registro-header">
        <div class="registro-titulo">${s.producto || 'Scoring'}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge-turno ${s.turno}">${turnoLabel[s.turno] || s.turno}</span>
          <span class="badge-cat">${catLabel[s.categoria] || s.categoria}</span>
        </div>
      </div>
      <div class="registro-meta">${formatFecha(s.fecha)} · ${s.usuario}</div>
    </div>`;
}

function emptyMsg() {
  return '<div class="empty-msg">No hay registros para los filtros aplicados.</div>';
}

/* ══ MODAL REGISTRO ══ */
window.verRegistro = function(firestoreId) {
  const r = state.registros.find(x => x.firestoreId === firestoreId);
  if (!r) return;

  document.getElementById('modal-titulo').textContent = 'Registro de Calidad';
  document.getElementById('modal-meta').textContent   =
    `${formatFecha(r.fecha)} · ${r.usuario} · Turno ${r.turno}`;

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
    ? `<div class="modal-campo">
        <div class="modal-campo-label">${label}</div>
        <div class="${cls || colorVal(val)}">${val}</div>
       </div>` : '';

  const seccion = (titulo, campos) => {
    const contenido = campos.filter(Boolean).join('');
    return contenido
      ? `<div class="modal-seccion"><div class="modal-seccion-title">${titulo}</div>${contenido}</div>`
      : '';
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

/* ══ MODAL SCORING ══ */
window.verScoring = function(firestoreId) {
  const s = state.scorings.find(x => x.firestoreId === firestoreId);
  if (!s) return;

  document.getElementById('modal-titulo').textContent =
    `Scoring — ${catLabel[s.categoria] || s.categoria}`;
  document.getElementById('modal-meta').textContent =
    `${formatFecha(s.fecha)} · ${s.usuario} · Turno ${s.turno} · ${s.producto}`;

  const campo = (label, val) => val
    ? `<div class="modal-campo">
        <div class="modal-campo-label">${label}</div>
        <div class="modal-campo-valor">${val}</div>
       </div>` : '';

  const campos = [];
  const map = {
    lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color',
    base_:'Base', altura:'Altura', desgarro:'Desgarro', manchas:'Manchas',
    harina:'Harina', estrias:'Estrías', estivado:'Estivado', miga:'Miga',
    forma:'Forma', reb_c:'Rebanadas chicas', reb_g:'Rebanadas grandes',
    coccion:'Cocción', embollado:'Embollado',
  };
  Object.entries(map).forEach(([key, label]) => {
    if (s[key]) campos.push(campo(label, s[key]));
  });

  document.getElementById('modal-body').innerHTML =
    `<div class="modal-seccion">
      <div class="modal-seccion-title">${s.producto}</div>
      ${campos.join('')}
     </div>`;

  document.getElementById('modal-overlay').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal();
});
