// Página de login: index.html está en la raíz y los paneles en /html/
export const LOGIN_PAGE = window.location.pathname.includes('/html/') ? '../index.html' : 'index.html';

export function guardarSesion(usuario, rol) {
    sessionStorage.setItem('sesion', JSON.stringify({ usuario, rol }));
}

export function requerirRol(rolesPermitidos) {
    let sesion = null;
    try { sesion = JSON.parse(sessionStorage.getItem('sesion')); } catch (_) {}

    if (!sesion || (sesion.rol !== 'admin' && !rolesPermitidos.includes(sesion.rol))) {
        window.location.href = LOGIN_PAGE;
        return null;
    }
    return sesion;
}

export function activarCerrarSesion() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', () => {
        sessionStorage.removeItem('sesion');
        window.location.href = LOGIN_PAGE;
    });
}

// Evita que un texto rompa el HTML
export function esc(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto ?? '');
    return div.innerHTML;
}