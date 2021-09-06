const isDark = theme => (theme === 'system') ? matchMedia('(prefers-color-scheme: dark)').matches : (theme === 'dark');
export const apply = theme => document.body.classList.toggle('dark', isDark(theme));
