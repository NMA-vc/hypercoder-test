import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>('system');

	function getSystemTheme(): 'light' | 'dark' {
		if (browser && window.matchMedia) {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return 'light';
	}

	function getStoredTheme(): Theme {
		if (browser) {
			try {
				const stored = localStorage.getItem('theme') as Theme;
				if (stored && ['light', 'dark', 'system'].includes(stored)) {
					return stored;
				}
			} catch (e) {
				console.warn('Failed to read theme from localStorage:', e);
			}
		}
		return 'system';
	}

	function applyTheme(theme: Theme) {
		if (!browser) return;

		const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
		const root = document.documentElement;

		root.setAttribute('data-theme', resolvedTheme);
		root.style.colorScheme = resolvedTheme;
	}

	function setTheme(newTheme: Theme) {
		if (browser) {
			try {
				localStorage.setItem('theme', newTheme);
			} catch (e) {
				console.warn('Failed to save theme to localStorage:', e);
			}
		}
		applyTheme(newTheme);
		set(newTheme);
	}

	function toggleTheme() {
		update(currentTheme => {
			const newTheme = currentTheme === 'light' ? 'dark' : 'light';
			setTheme(newTheme);
			return newTheme;
		});
	}

	function init() {
		if (!browser) return;

		const storedTheme = getStoredTheme();
		applyTheme(storedTheme);
		set(storedTheme);

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			update(currentTheme => {
				if (currentTheme === 'system') {
					applyTheme('system');
				}
				return currentTheme;
			});
		};

		mediaQuery.addEventListener('change', handleChange);

		// Cleanup function
		return () => mediaQuery.removeEventListener('change', handleChange);
	}

	return {
		subscribe,
		setTheme,
		toggleTheme,
		init,
		getResolvedTheme: (): 'light' | 'dark' => {
			let currentTheme: Theme;
			subscribe(theme => currentTheme = theme)();
			return currentTheme === 'system' ? getSystemTheme() : currentTheme as 'light' | 'dark';
		}
	};
}

export const theme = createThemeStore();

// Design tokens organized by semantic meaning
export const tokens = {
	colors: {
		// Semantic colors that adapt to theme
		bg: 'var(--color-bg)',
		fg: 'var(--color-fg)',
		muted: 'var(--color-muted)',
		accent: 'var(--color-accent)',
		accentHover: 'var(--color-accent-hover)',
		border: 'var(--color-border)',
		borderHover: 'var(--color-border-hover)',
		card: 'var(--color-card)',
		success: 'var(--color-success)',
		warning: 'var(--color-warning)',
		error: 'var(--color-error)'
	},
	spacing: {
		1: 'var(--space-1)',
		2: 'var(--space-2)',
		3: 'var(--space-3)',
		4: 'var(--space-4)',
		5: 'var(--space-5)',
		6: 'var(--space-6)',
		7: 'var(--space-7)',
		8: 'var(--space-8)',
		9: 'var(--space-9)'
	},
	typography: {
		xs: 'var(--text-xs)',
		sm: 'var(--text-sm)',
		base: 'var(--text-base)',
		lg: 'var(--text-lg)',
		xl: 'var(--text-xl)',
		'2xl': 'var(--text-2xl)',
		'3xl': 'var(--text-3xl)',
		'4xl': 'var(--text-4xl)',
		'5xl': 'var(--text-5xl)'
	},
	radius: {
		sm: 'var(--radius-sm)',
		base: 'var(--radius)',
		md: 'var(--radius-md)',
		lg: 'var(--radius-lg)',
		xl: 'var(--radius-xl)'
	},
	shadows: {
		sm: 'var(--shadow-sm)',
		base: 'var(--shadow)',
		lg: 'var(--shadow-lg)'
	},
	transitions: {
		fast: 'var(--transition-fast)',
		base: 'var(--transition-base)',
		slow: 'var(--transition-slow)'
	},
	breakpoints: {
		sm: 'var(--container-sm)',
		md: 'var(--container-md)',
		lg: 'var(--container-lg)',
		xl: 'var(--container-xl)'
	}
} as const;

// Utility function for conditional classes
export function cn(...classes: (string | undefined | null | false)[]): string {
	return classes.filter(Boolean).join(' ');
}