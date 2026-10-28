import { supabase } from '../config.js';
import { requerirRol, activarCerrarSesion, esc } from './auth.js';

if (!requerirRol(['cajero'])) throw new Error('Sin sesión');
activarCerrarSesion();

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
                    <h4 class="mb-0 fw-bold">${esc(pedido.mesa)}</h4>
                    <span class="badge bg-light text-success fs-6">Lista</span>
                </div>
                <div class="card-body">
                    <ul class="list-group list-group-flush mb-3 text-muted">${listaProductosHTML}</ul>
                    <hr>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <h5 class="mb-0 text-secondary">Total a pagar:</h5>
                        <h2 class="mb-0 text-success fw-bold">$${Number(pedido.total).toLocaleString('es-CO')}</h2>
                    </div>
                </div>
                <div class="card-footer bg-white text-center border-0 pb-3 mt-2">
                    <button class="btn btn-primary w-100 btn-lg fw-bold shadow-sm btn-pagar" data-id="${pedido.id}">💵 Facturar y Cerrar Mesa</button>
                </div>
            </div>
        `;
        tableroCaja.appendChild(tarjeta);
    });

    document.querySelectorAll('.btn-pagar').forEach(btn => {
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

supabase
    .channel('caja-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => cargarPedidosListos())
    .subscribe();

cargarPedidosListos();
setInterval(cargarPedidosListos, 15000);