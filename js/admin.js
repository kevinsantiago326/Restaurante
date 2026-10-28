import { supabase } from '../config.js';
import { requerirRol, activarCerrarSesion, guardarSesion, esc } from './auth.js';

// Solo el rol 'admin' entra aquí (además, 'admin' pasa en cualquier panel)
const sesion = requerirRol(['admin']);
if (!sesion) throw new Error('Sin sesión');
activarCerrarSesion();

const sesionAdmin = document.getElementById('sesion-admin');
if (sesionAdmin) sesionAdmin.textContent = '👑 ' + sesion.usuario;

/* ============================================================
 *  NAVEGACIÓN ENTRE SECCIONES (no depende del JS de Bootstrap)
 * ============================================================ */
const botonesSeccion = document.querySelectorAll('[data-seccion]');

function mostrarSeccion(nombre) {
    botonesSeccion.forEach(b => b.classList.toggle('active', b.dataset.seccion === nombre));
    document.querySelectorAll('.seccion-admin').forEach(s => {
        s.classList.toggle('d-none', s.id !== 'sec-' + nombre);
    });

    if (nombre === 'cocina') cargarPedidosPendientes();
    if (nombre === 'caja') cargarPedidosListos();
    if (nombre === 'empleados') cargarEmpleados();
}

botonesSeccion.forEach(btn => btn.addEventListener('click', () => mostrarSeccion(btn.dataset.seccion)));

/* ============================================================
 *  1. MESERO (tomar pedido y enviar a cocina)
 * ============================================================ */
let pedidoActual = [];
let total = 0;
let mesaSeleccionada = null;

const listaPedidoHTML = document.getElementById('lista-pedido');
const totalPedidoHTML = document.getElementById('total-pedido');
const mesaActualHTML = document.getElementById('mesa-actual');
const btnEnviarCocina = document.getElementById('btn-enviar-cocina');

document.querySelectorAll('#mesas-admin [data-mesa]').forEach(boton => {
    boton.addEventListener('click', () => {
        mesaSeleccionada = boton.dataset.mesa;
        document.querySelectorAll('#mesas-admin [data-mesa]').forEach(b => b.classList.toggle('active', b === boton));
        mesaActualHTML.innerText = mesaSeleccionada;
    });
});

document.querySelectorAll('.btn-producto').forEach(boton => {
    boton.addEventListener('click', () => {
        const nombre = boton.dataset.nombre;
        const precio = parseInt(boton.dataset.precio, 10);

        const existente = pedidoActual.find(item => item.nombre === nombre);
        if (existente) {
            existente.cantidad += 1;
        } else {
            pedidoActual.push({ nombre, precio, cantidad: 1 });
        }
        actualizarCarritoHTML();
    });
});

function actualizarCarritoHTML() {
    listaPedidoHTML.innerHTML = '';
    total = 0;

    if (pedidoActual.length === 0) {
        listaPedidoHTML.innerHTML = `<li class="list-group-item text-center p-4 text-muted"><small>Selecciona una mesa y agrega productos para comenzar.</small></li>`;
        totalPedidoHTML.innerText = '$0';
        return;
    }

    pedidoActual.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div><span class="badge bg-primary text-white rounded-pill mr-2">${item.cantidad}</span> ${esc(item.nombre)}</div>
            <div class="d-flex align-items-center">
                <span class="text-success font-weight-bold mr-3">$${subtotal.toLocaleString('es-CO')}</span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-eliminar" data-index="${index}">x</button>
            </div>
        `;
        listaPedidoHTML.appendChild(li);
    });

    totalPedidoHTML.innerText = `$${total.toLocaleString('es-CO')}`;

    listaPedidoHTML.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.currentTarget.dataset.index, 10);
            pedidoActual.splice(i, 1);
            actualizarCarritoHTML();
        });
    });
}

btnEnviarCocina.addEventListener('click', async () => {
    if (!mesaSeleccionada) return alert('Por favor, selecciona una mesa primero.');
    if (pedidoActual.length === 0) return alert('El pedido está vacío. Agrega productos.');

    btnEnviarCocina.innerText = 'Enviando...';
    btnEnviarCocina.disabled = true;

    try {
        const { error } = await supabase.from('pedidos').insert([
            { mesa: mesaSeleccionada, productos: pedidoActual, total: total, estado: 'pendiente' }
        ]);

        if (error) throw error;

        alert(`¡Pedido de ${mesaSeleccionada} enviado a cocina exitosamente!`);
        pedidoActual = [];
        mesaSeleccionada = null;
        document.querySelectorAll('#mesas-admin [data-mesa]').forEach(b => b.classList.remove('active'));
        mesaActualHTML.innerText = 'Ninguna';
        actualizarCarritoHTML();
    } catch (error) {
        console.error('Error al enviar el pedido:', error);
        alert('Hubo un error al enviar el pedido: ' + error.message);
    } finally {
        btnEnviarCocina.innerText = 'Enviar a Cocina';
        btnEnviarCocina.disabled = false;
    }
});

/* ============================================================
 *  2. COCINA (pedidos pendientes -> listos)
 * ============================================================ */
const tableroCocina = document.getElementById('tablero-cocina');

async function cargarPedidosPendientes() {
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error al cargar pedidos:', error);
        tableroCocina.innerHTML = `<h5 class="text-danger w-100 text-center mt-5">Error: ${esc(error.message)}</h5>`;
        return;
    }
    dibujarPedidos(pedidos);
}

function dibujarPedidos(pedidos) {
    tableroCocina.innerHTML = '';

    if (pedidos.length === 0) {
        tableroCocina.innerHTML = `<h5 class="text-muted w-100 text-center mt-5">No hay pedidos pendientes. ¡Buen trabajo!</h5>`;
        return;
    }

    pedidos.forEach(pedido => {
        let listaProductosHTML = '';
        pedido.productos.forEach(prod => {
            listaProductosHTML += `<li class="list-group-item d-flex justify-content-between align-items-start px-0"><div class="mr-auto"><div class="font-weight-bold fs-5">${esc(prod.cantidad)}x ${esc(prod.nombre)}</div></div></li>`;
        });

        const tarjeta = document.createElement('div');
        tarjeta.className = 'col-md-4 mb-4';
        tarjeta.innerHTML = `
            <div class="card shadow-sm border-danger h-100">
                <div class="card-header bg-danger text-white d-flex justify-content-between align-items-center">
                    <h4 class="mb-0 font-weight-bold">${esc(pedido.mesa)}</h4>
                </div>
                <div class="card-body">
                    <ul class="list-group list-group-flush mb-3">${listaProductosHTML}</ul>
                </div>
                <div class="card-footer bg-white text-center border-0 pb-3">
                    <button class="btn btn-success w-100 btn-lg font-weight-bold shadow-sm btn-listo" data-id="${pedido.id}">✔️ Marcar como Listo</button>
                </div>
            </div>
        `;
        tableroCocina.appendChild(tarjeta);
    });

    tableroCocina.querySelectorAll('.btn-listo').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const boton = e.currentTarget;
            const idPedido = boton.dataset.id;
            boton.innerText = 'Actualizando...';
            boton.disabled = true;

            const { error } = await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', idPedido);
            if (error) {
                alert('No se pudo actualizar: ' + error.message);
                boton.innerText = '✔️ Marcar como Listo';
                boton.disabled = false;
                return;
            }
            cargarPedidosPendientes();
        });
    });
}

/* ============================================================
 *  3. CAJA (pedidos listos -> facturados)
 * ============================================================ */
const tableroCaja = document.getElementById('tablero-caja');

async function cargarPedidosListos() {
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'listo')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error al cargar pedidos:', error);
        tableroCaja.innerHTML = `<h5 class="text-danger w-100 text-center mt-5">Error: ${esc(error.message)}</h5>`;
        return;
    }
    dibujarPedidosCaja(pedidos);
}

function dibujarPedidosCaja(pedidos) {
    tableroCaja.innerHTML = '';

    if (pedidos.length === 0) {
        tableroCaja.innerHTML = `<h5 class="text-muted w-100 text-center mt-5">No hay mesas listas para cobrar.</h5>`;
        return;
    }

    pedidos.forEach(pedido => {
        let listaProductosHTML = '';
        pedido.productos.forEach(prod => {
            listaProductosHTML += `<li class="list-group-item px-0 py-1 border-0">${esc(prod.cantidad)}x ${esc(prod.nombre)}</li>`;
        });

        const tarjeta = document.createElement('div');
        tarjeta.className = 'col-md-4 mb-4';
        tarjeta.innerHTML = `
            <div class="card shadow-sm border-success h-100">
                <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
                    <h4 class="mb-0 font-weight-bold">${esc(pedido.mesa)}</h4>
                    <span class="badge bg-light text-success fs-6">Lista</span>
                </div>
                <div class="card-body">
                    <ul class="list-group list-group-flush mb-3 text-muted">${listaProductosHTML}</ul>
                    <hr>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <h5 class="mb-0 text-secondary">Total a pagar:</h5>
                        <h2 class="mb-0 text-success font-weight-bold">$${Number(pedido.total).toLocaleString('es-CO')}</h2>
                    </div>
                </div>
                <div class="card-footer bg-white text-center border-0 pb-3 mt-2">
                    <button class="btn btn-primary w-100 btn-lg font-weight-bold shadow-sm btn-pagar" data-id="${pedido.id}">💵 Facturar y Cerrar Mesa</button>
                </div>
            </div>
        `;
        tableroCaja.appendChild(tarjeta);
    });

    tableroCaja.querySelectorAll('.btn-pagar').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const boton = e.currentTarget;
            const idPedido = boton.dataset.id;
            boton.innerText = 'Facturando...';
            boton.disabled = true;

            const { error } = await supabase.from('pedidos').update({ estado: 'pagado' }).eq('id', idPedido);
            if (error) {
                alert('No se pudo facturar: ' + error.message);
                boton.innerText = '💵 Facturar y Cerrar Mesa';
                boton.disabled = false;
                return;
            }
            cargarPedidosListos();
        });
    });
}

/* ============================================================
 *  4. EMPLEADOS (CRUD: crear, leer, editar, eliminar)
 * ============================================================ */
const formEmpleado = document.getElementById('form-empleado');
const inputUsuarioEmpleado = document.getElementById('input-empleado-usuario');
const inputPasswordEmpleado = document.getElementById('input-empleado-password');
const selectRolEmpleado = document.getElementById('select-empleado-rol');
const btnGuardarEmpleado = document.getElementById('btn-guardar-empleado');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
const tituloFormEmpleado = document.getElementById('titulo-form-empleado');
const listaEmpleados = document.getElementById('lista-empleados');

let editandoId = null;
let miId = null;                 // id de la cuenta con la que entró el admin
let cacheEmpleados = [];

async function cargarEmpleados() {
    const { data, error } = await supabase
        .from('usuarios')
        .select('id, usuario, password, rol')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al cargar empleados:', error);
        listaEmpleados.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4">Error: ${esc(error.message)}</td></tr>`;
        return;
    }

    cacheEmpleados = data || [];
    miId = (cacheEmpleados.find(u => u.usuario === sesion.usuario) || {}).id ?? null;

    if (cacheEmpleados.length === 0) {
        listaEmpleados.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">No hay empleados registrados.</td></tr>`;
        return;
    }

    const ROLES = { admin: 'dark', mesero: 'primary', cocina: 'danger', cajero: 'success' };

    listaEmpleados.innerHTML = cacheEmpleados.map(u => `
        <tr>
            <td class="pl-3 text-muted">${u.id}</td>
            <td class="font-weight-bold">${esc(u.usuario)}${u.id === miId ? ' <span class="badge badge-dark">Tú</span>' : ''}</td>
            <td><code>${esc(u.password)}</code></td>
            <td><span class="badge badge-${ROLES[u.rol] || 'secondary'}">${esc(u.rol)}</span></td>
            <td class="text-right pr-3">
                <button class="btn btn-sm btn-outline-primary mr-1" data-accion="editar" data-id="${u.id}">✏️ Editar</button>
                <button class="btn btn-sm btn-outline-danger" data-accion="eliminar" data-id="${u.id}">🗑️ Eliminar</button>
            </td>
        </tr>
    `).join('');
}

listaEmpleados.addEventListener('click', async (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;

    const id = parseInt(boton.dataset.id, 10);
    const empleado = cacheEmpleados.find(u => u.id === id);
    if (!empleado) return;

    if (boton.dataset.accion === 'editar') {
        if (empleado.id === miId && empleado.rol !== 'admin') {
            alert('No puedes editar esta cuenta: no tiene el rol "Administrador".');
            return;
        }
        editandoId = id;
        inputUsuarioEmpleado.value = empleado.usuario;
        inputPasswordEmpleado.value = empleado.password;
        selectRolEmpleado.value = empleado.rol;
        tituloFormEmpleado.textContent = '✏️ Editando: ' + empleado.usuario;
        btnGuardarEmpleado.textContent = 'Guardar Cambios';
        btnCancelarEdicion.classList.remove('d-none');
        inputUsuarioEmpleado.focus();
        return;
    }

    // eliminar
    if (empleado.id === miId) {
        alert('No puedes eliminar la cuenta con la que iniciaste sesión.');
        return;
    }
    if (!confirm(`¿Eliminar al empleado "${empleado.usuario}"?\nEsta acción no se puede deshacer.`)) return;

    // .select('id') devuelve las filas realmente afectadas: si RLS lo bloquea,
    // llega vacío (sin error) y así evitamos avisar un falso "éxito".
    const { data: borrados, error } = await supabase.from('usuarios').delete().eq('id', id).select('id');
    if (error) {
        alert('No se pudo eliminar: ' + error.message);
        return;
    }
    if (!borrados || borrados.length === 0) {
        alert('No se pudo eliminar: la base de datos no aplicó el cambio.\n\nFalta ejecutar el bloque "5. Panel de Administración" de supabase/esquema.sql en el SQL Editor de Supabase.');
        return;
    }
    alert('Empleado eliminado.');
    if (editandoId === id) limpiarFormulario();
    cargarEmpleados();
});

function limpiarFormulario() {
    editandoId = null;
    formEmpleado.reset();
    tituloFormEmpleado.textContent = '➕ Añadir Empleado';
    btnGuardarEmpleado.textContent = 'Guardar Empleado';
    btnCancelarEdicion.classList.add('d-none');
}

btnCancelarEdicion.addEventListener('click', limpiarFormulario);

formEmpleado.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = inputUsuarioEmpleado.value.trim();
    const password = inputPasswordEmpleado.value.trim();
    const rol = selectRolEmpleado.value;

    if (!usuario || !password) return alert('Debes completar usuario y contraseña.');
    if (password.length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');

    btnGuardarEmpleado.disabled = true;
    btnGuardarEmpleado.innerText = 'Guardando...';

    try {
        let error = null;
        let guardados = [];

        if (editandoId !== null) {
            if (editandoId === miId && rol !== 'admin') {
                alert('Tu rol debe permanecer en "Administrador".');
                return;
            }
            // .select('id') devuelve las filas realmente afectadas: si RLS lo
            // bloquea llega vacío (sin error) y evitamos avisar un falso éxito.
            ({ data: guardados, error } = await supabase
                .from('usuarios')
                .update({ usuario, password, rol })
                .eq('id', editandoId)
                .select('id'));
        } else {
            ({ error } = await supabase.from('usuarios').insert([{ usuario, password, rol }]));
        }

        if (error) {
            if (error.code === '23505') {
                alert('Ya existe un empleado con ese nombre de usuario.');
            } else if (error.code === '42501') {
                alert('Sin permisos en la base de datos.\n\nEjecuta el bloque "5. Panel de Administración" de supabase/esquema.sql en el SQL Editor de Supabase.');
            } else {
                alert('No se pudo guardar: ' + error.message);
                console.error('Error al guardar empleado:', error);
            }
            return;
        }

        if (editandoId !== null && (!guardados || guardados.length === 0)) {
            alert('No se pudo guardar: la base de datos no aplicó el cambio (0 filas afectadas).\n\nEjecuta el bloque "5. Panel de Administración" de supabase/esquema.sql en el SQL Editor de Supabase.');
            return;
        }

        // Si el admin se editó a sí mismo, la sesión debe quedar coherente
        if (editandoId !== null && editandoId === miId) {
            sesion.usuario = usuario;
            sesion.rol = rol;
            guardarSesion(usuario, rol);
        }

        alert(editandoId !== null ? 'Empleado actualizado correctamente.' : 'Empleado añadido correctamente.');
        limpiarFormulario();
        await cargarEmpleados();
    } catch (err) {
        console.error('Error inesperado:', err);
        alert('Error inesperado: ' + err.message);
    } finally {
        btnGuardarEmpleado.disabled = false;
        if (editandoId === null) btnGuardarEmpleado.innerText = 'Guardar Empleado';
        else btnGuardarEmpleado.innerText = 'Guardar Cambios';
    }
});

/* ============================================================
 *  5. TIEMPO REAL + ACTUALIZACIÓN DE RESPALDO
 * ============================================================ */
function refrescarTodo() {
    cargarPedidosPendientes();
    cargarPedidosListos();
}

supabase
    .channel('admin-panel-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, refrescarTodo)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => cargarEmpleados())
    .subscribe();

cargarPedidosPendientes();
cargarEmpleados();

// Respaldo por si el realtime falla
setInterval(refrescarTodo, 15000);
setInterval(cargarEmpleados, 30000);
