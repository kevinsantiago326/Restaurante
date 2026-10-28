import { supabase } from '../config.js';
import { requerirRol, activarCerrarSesion, esc } from './auth.js';

if (!requerirRol(['cocina'])) throw new Error('Sin sesión');
activarCerrarSesion();

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
            listaProductosHTML += `<li class="list-group-item d-flex justify-content-between align-items-start px-0"><div class="ms-2 me-auto"><div class="fw-bold fs-5">${esc(prod.cantidad)}x ${esc(prod.nombre)}</div></div></li>`;
        });

        const tarjeta = document.createElement('div');
        tarjeta.className = 'col-md-4 mb-4';
        tarjeta.innerHTML = `
            <div class="card shadow-sm border-danger h-100">
                <div class="card-header bg-danger text-white d-flex justify-content-between align-items-center">
                    <h4 class="mb-0 fw-bold">${esc(pedido.mesa)}</h4>
                </div>
                <div class="card-body">
                    <ul class="list-group list-group-flush mb-3">${listaProductosHTML}</ul>
                </div>
                <div class="card-footer bg-white text-center border-0 pb-3">
                    <button class="btn btn-success w-100 btn-lg fw-bold shadow-sm btn-listo" data-id="${pedido.id}">✔️ Marcar como Listo</button>
                </div>
            </div>
        `;
        tableroCocina.appendChild(tarjeta);
    });

    document.querySelectorAll('.btn-listo').forEach(btn => {
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

supabase
    .channel('cocina-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => cargarPedidosPendientes())
    .subscribe();

cargarPedidosPendientes();
// Respaldo por si el realtime falla
setInterval(cargarPedidosPendientes, 15000);