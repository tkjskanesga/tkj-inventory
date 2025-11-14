/**
 * Menampilkan atau menyembunyikan field berdasarkan role yang dipilih.
 * @param {string} role - 'admin' atau 'user'.
 * @param {HTMLElement} formElement - Elemen form.
 */
export const toggleAccountFields = (role, formElement) => {
    const nisField = formElement.querySelector('.nis-field');
    const kelasField = formElement.querySelector('.kelas-field');
    const usernameField = formElement.querySelector('.username-field');

    const nisInput = nisField?.querySelector('input');
    const kelasInput = kelasField?.querySelector('input[type="hidden"]');
    const usernameInput = usernameField?.querySelector('input');

    if (role === 'admin') {
        if (nisField) nisField.style.display = 'none';
        if (kelasField) kelasField.style.display = 'none';
        if (usernameField) usernameField.style.display = 'block';

        if (nisInput) nisInput.required = false;
        if (kelasInput) kelasInput.required = false;
        if (usernameInput) usernameInput.required = true;
    } else { // 'user'
        if (nisField) nisField.style.display = 'block';
        if (kelasField) kelasField.style.display = 'block';
        if (usernameField) usernameField.style.display = 'none';

        if (nisInput) nisInput.required = true;
        if (kelasInput) kelasInput.required = true;
        if (usernameInput) usernameInput.required = false;
    }
};