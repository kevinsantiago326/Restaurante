import { supabase } from '../config.js';
import { guardarSesion } from './auth.js';

const formLogin = document.getElementById('form-login');
const inputUsuario = document.getElementById('input-usuario');
const inputPassword = document.getElementById('input-password');
const btnLogin = document.getElementById('btn-login');

// Las páginas de los roles viven dentro de la carpeta "html/"
const PAGINAS = {
    mesero: 'html/mesero.html',
    cocina: 'html/cocina.html',
    cajero: 'html/cajero.html',
    admin: 'html/admin.html'
};

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = inputUsuario.value.trim();
    const password = inputPassword.value.trim();

    btnLogin.innerText = 'Verificando...';
    btnLogin.disabled = true;

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('usuario, rol')
            .eq('usuario', usuario)
            .eq('password', password)
            .maybeSingle();

        if (error) {
            console.error('Error de Supabase:', error);
            alert('Error al conectar con la base de datos: ' + error.message);
            return;
        }

        if (!data) {
            alert('Usuario o contraseña incorrectos.');
            return;
        }

        const destino = PAGINAS[data.rol];
        if (!destino) {
            alert('Rol no reconocido: ' + data.rol);
            return;
        }

        guardarSesion(data.usuario, data.rol);
        window.location.href = destino;
    } catch (err) {
        console.error('Error en login:', err);
        alert('Error inesperado: ' + err.message);
    } finally {
        btnLogin.innerText = 'Ingresar';
        btnLogin.disabled = false;
    }
});