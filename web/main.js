import {bootApp} from './app.js';
bootApp().catch(error=>{const status=document.getElementById('status');status.className='status-bar error';status.textContent=`No se pudo iniciar el laboratorio: ${error.message}. Abre la web mediante un servidor HTTP y comprueba los recursos locales.`;});
