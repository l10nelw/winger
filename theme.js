const isDark = theme => (theme === 'dark') || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); //@ (String), state -> (Boolean)
export const apply = theme => document.body.classList.toggle('dark', isDark(theme)); //@ (String), state -> state
