export const isDark = theme => (theme === 'dark') || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
const setTheme = ({ theme }) => document.body.classList.toggle('dark', isDark(theme));
globalThis.browser?.storage.local.get('theme').then(setTheme) || setTheme({});
