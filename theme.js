const isDark = theme => (theme === 'system') ? matchMedia('(prefers-color-scheme: dark)').matches : (theme === 'dark'); //@ (String), state -> (Boolean)
export const apply = theme => document.body.classList.toggle('dark', isDark(theme)); //@ (String), state -> state
