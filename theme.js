export const isDark = theme => (theme === 'dark') || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); //@ (String), state -> (Boolean)
browser.storage.session.get('theme').then(({ theme }) => document.body.classList.toggle('dark', isDark(theme)));
