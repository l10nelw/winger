/** @param {string} theme @returns {boolean} */
export const isDark = theme => (theme === 'dark') || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
browser.storage.local.get('theme').then(({ theme }) => document.body.classList.toggle('dark', isDark(theme)));
