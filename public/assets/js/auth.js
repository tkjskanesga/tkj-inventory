import { state, AUTH_URL } from './state.js';
import { showLoading } from './utils.js';

// Menangani user session dan authentication.
export const checkSession = async () => {
    try {
        const response = await fetch(`${AUTH_URL}?action=get_session`);
        if (!response.ok) throw new Error('Redirecting to login...');
        
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            state.session = {
                isLoggedIn: true,
                username: result.data.username,
                role: result.data.role,
                login_username: result.data.login_username,
                kelas: result.data.kelas
            };
        } else {
            throw new Error('No active session.');
        }
    } catch (error) {
        window.location.href = 'login/';
    }
};

export const handleLogout = async () => {
    showLoading();
    await fetch(`${AUTH_URL}?action=logout`);
    window.location.href = 'login/';
};