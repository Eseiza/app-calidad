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
const PRODUCTOS_BOLLERIA = ['Hamburguesa', 'Max', 'Pancho', 'Super'];
const PRODUCTOS_MOLDE    = ['Multicereal', 'Integral', 'Salvado F', 'Salvado C', 'Lacteado F', 'Lacteado C'];

/* ══ STATE ══ */
const state = {
  role: null, currentUser: '',
  registros: [], scorings: [],
  turnoActivo: null,
  turnoScoringActivo: null,
  categoriaActiva: 'bolleria',
  historialTipo: 'registros',
  // transportes: estado por transporte (OK o OBS)
  transportes: { t1: null, t2: null, t3: null, t4: null },
  // camara: tipo de producto seleccionado
  camaraTipo: null,
  // rollos: marca seleccionada
  rollosMarca: null,
  // ok-obs campos (bobinado, taco)
  okObsState: { bobinado: null, taco: null },
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
    editandoId:null, editandoColeccion:null,
    camaraTipo: null, rollosMarca: null,
    transportes: { t1:null, t2:null, t3:null, t4:null },
    okObsState: { bobinado:null, taco:null },
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
    ['envase','bolleria','molde'].forEach(cat => {
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
      producto:  hornProd,
      tiempo_min: leerCampo('horn-tiempo'),
      t1_estado: t1.estado, t1_obs: t1.obs,
      t2_estado: t2.estado, t2_obs: t2.obs,
      t3_estado: t3.estado, t3_obs: t3.obs,
      t4_estado: t4.estado, t4_obs: t4.obs,
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
  document.querySelectorAll('.estado-check-btn.selected, .turno-btn:not(.turno-scoring).selected')
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
  if (cat === 'envase') {
    return { categoria: cat,
      producto:  leerCampo('sc-env-producto'),
      lote:      leerCampo('sc-env-lote'),
      vto:       leerCampo('sc-env-vto'),
      peso:      leerCampo('sc-env-peso'),
      color:     leerCampo('sc-env-color'),
      base_:     leerCampo('sc-env-base'),
      altura:    leerCampo('sc-env-altura'),
      desgarro:  leerCampo('sc-env-desgarro'),
      manchas:   leerCampo('sc-env-manchas'),
      harina:    leerCampo('sc-env-harina'),
      estrias:   leerCampo('sc-env-estrias'),
      estivado:  leerCampo('sc-env-estivado'),
      miga:      leerCampo('sc-env-miga'),
    };
  }
  if (cat === 'bolleria') {
    return { categoria: cat,
      producto:  leerCampo('sc-bol-producto'),
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
      producto:  leerCampo('sc-mol-producto'),
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
  document.querySelectorAll('#tab-scoring input[type="text"], #tab-scoring select').forEach(el => el.value = '');
  document.querySelectorAll('.turno-btn.turno-scoring.selected').forEach(el => el.classList.remove('selected'));
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
const catLabel   = { 'envase':'ENVASE', 'bolleria':'BOLLERÍA', 'molde':'PAN DE MOLDE' };

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

  document.querySelectorAll('#tabs-main .vis-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-main .vis-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#tabs-main .vis-tab[data-tab="tab-nuevo"]').classList.add('active');
  document.getElementById('tab-nuevo').classList.add('active');

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
    'horn-z2':r.horno?.z2, 'horn-tiempo':r.horno?.tiempo_min
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

  state.turnoScoringActivo = s.turno;
  document.querySelectorAll('.turno-btn.turno-scoring').forEach(b => {
    b.classList.toggle('selected', b.dataset.turno === s.turno);
  });

  state.categoriaActiva = s.categoria;
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === s.categoria));
  ['envase','bolleria','molde'].forEach(cat => {
    document.getElementById(`scoring-productos-${cat}`)?.classList.toggle('active', cat === s.categoria);
    document.getElementById(`scoring-form-${cat}`)?.classList.toggle('active', cat === s.categoria);
  });

  if (s.categoria === 'envase') {
    const sel = document.getElementById('sc-env-producto');
    if (sel) sel.value = s.producto || '';
    Object.entries({ 'sc-env-lote':s.lote, 'sc-env-vto':s.vto, 'sc-env-peso':s.peso, 'sc-env-color':s.color,
      'sc-env-base':s.base_, 'sc-env-altura':s.altura, 'sc-env-desgarro':s.desgarro, 'sc-env-manchas':s.manchas,
      'sc-env-harina':s.harina, 'sc-env-estrias':s.estrias, 'sc-env-estivado':s.estivado, 'sc-env-miga':s.miga })
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }

  if (s.categoria === 'bolleria') {
    const sel = document.getElementById('sc-bol-producto');
    if (sel) sel.value = s.producto || '';
    Object.entries({ 'sc-bol-lote':s.lote, 'sc-bol-vto':s.vto, 'sc-bol-peso':s.peso, 'sc-bol-color':s.color,
      'sc-bol-base':s.base_, 'sc-bol-altura':s.altura, 'sc-bol-desgarro':s.desgarro, 'sc-bol-manchas':s.manchas,
      'sc-bol-harina':s.harina, 'sc-bol-estrias':s.estrias, 'sc-bol-estivado':s.estivado, 'sc-bol-miga':s.miga })
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }

  if (s.categoria === 'molde') {
    const sel = document.getElementById('sc-mol-producto');
    if (sel) sel.value = s.producto || '';
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
    seccion('🔥 Horno', [
      campo('Producto', r.horno?.producto, 'modal-campo-valor'),
      campo('Set zona 1', r.horno?.set_z1, 'modal-campo-valor'),
      campo('Zona 1', r.horno?.z1, 'modal-campo-valor'),
      campo('Set zona 2', r.horno?.set_z2, 'modal-campo-valor'),
      campo('Zona 2', r.horno?.z2, 'modal-campo-valor'),
      campo('Tiempo cocción', r.horno?.tiempo_min ? r.horno.tiempo_min + ' min' : '', 'modal-campo-valor'),
      transporteHtml(1, 't1'),
      transporteHtml(2, 't2'),
      transporteHtml(3, 't3'),
      transporteHtml(4, 't4'),
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
    seccion('🎞️ Rollos', [
      campo('Marca', r.rollos?.marca, 'modal-campo-valor'),
      campo('Producto', r.rollos?.producto, 'modal-campo-valor'),
      rolloOkObsHtml('Bobinado', 'bobinado'),
      rolloOkObsHtml('Taco', 'taco'),
    ]),
    seccion('🛍️ Bolsas', [
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
    `${formatFecha(s.fecha)} · ${s.usuario} · Turno ${s.turno} · ${s.producto}${s.editado ? ' · (editado)' : ''}`;

  const campo = (label, val) => val
    ? `<div class="modal-campo"><div class="modal-campo-label">${label}</div><div class="modal-campo-valor">${val}</div></div>` : '';

  const mapEnvase   = { lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color', base_:'Base', altura:'Altura',
    desgarro:'Desgarro', manchas:'Manchas', harina:'Harina', estrias:'Estrías', estivado:'Estivado', miga:'Miga' };
  const mapBolleria = { lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color', base_:'Base', altura:'Altura',
    desgarro:'Desgarro', manchas:'Manchas', harina:'Harina', estrias:'Estrías', estivado:'Estivado', miga:'Miga' };
  const mapMolde    = { lote:'Lote', vto:'Vencimiento', peso:'Peso', color:'Color', altura:'Altura', forma:'Forma',
    estivado:'Estivado', miga:'Miga', reb_c:'Rebanadas chicas', reb_g:'Rebanadas grandes',
    coccion:'Cocción', embollado:'Embollado', desgarro:'Desgarro' };

  const map = s.categoria === 'molde' ? mapMolde : s.categoria === 'bolleria' ? mapBolleria : mapEnvase;
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
