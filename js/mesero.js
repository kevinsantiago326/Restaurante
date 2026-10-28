import { supabase } from '../config.js';
import { requerirRol, activarCerrarSesion, esc } from './auth.js';

if (!requerirRol(['mesero'])) throw new Error('Sin sesión');
activarCerrarSesion();

let pedidoActual = [];
let total = 0;
let mesaSeleccionada = null;

const listaPedidoHTML = document.getElementById('lista-pedido');
const totalPedidoHTML = document.getElementById('total-pedido');
const btnEnviarCocina = document.getElementById('btn-enviar-cocina');
const botonesMesa = document.querySelectorAll('input[name="mesas"]');
const botonesProductos = document.querySelectorAll('.tab-content button');

botonesMesa.forEach(radio => {
    radio.addEventListener('change', (e) => {
        mesaSeleccionada = document.querySelector(`label[for="${e.target.id}"]`).innerText.trim();
    });
});

botonesProductos.forEach(boton => {
    boton.addEventListener('click', () => {
        const nombreProducto = boton.querySelector('strong').innerText.trim();
        const textoPrecio = boton.querySelector('span').innerText;
        // Quita TODO lo que no sea número: "$35.000" -> 35000
        const precioNumerico = parseInt(textoPrecio.replace(/\D/g, ''), 10);

        const existente = pedidoActual.find(item => item.nombre === nombreProducto);
        if (existente) {
            existente.cantidad += 1;
        } else {
            pedidoActual.push({ nombre: nombreProducto, precio: precioNumerico, cantidad: 1 });
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
            <div><span class="badge bg-primary rounded-pill me-2">${item.cantidad}</span> ${esc(item.nombre)}</div>
            <div class="d-flex align-items-center">
                <span class="text-success fw-bold me-3">$${subtotal.toLocaleString('es-CO')}</span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-eliminar" data-index="${index}">x</button>
            </div>
        `;
        listaPedidoHTML.appendChild(li);
    });

    totalPedidoHTML.innerText = `$${total.toLocaleString('es-CO')}`;

    document.querySelectorAll('.btn-eliminar').forEach(btn => {
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
        botonesMesa.forEach(radio => radio.checked = false);
        actualizarCarritoHTML();
    } catch (error) {
        console.error('Error al enviar el pedido:', error);
        alert('Hubo un error al enviar el pedido: ' + error.message);
    } finally {
        btnEnviarCocina.innerText = 'Enviar a Cocina';
        btnEnviarCocina.disabled = false;
    }
});