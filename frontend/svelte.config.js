import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			$components: 'src/lib/components',
			$stores: 'src/lib/stores',
			$types: 'src/lib/types'
		},
		csp: {
			directives: {
				'default-src': ['self'],
				'connect-src': ['self', 'wss:'],
				'img-src': ['self', 'data:'],
				'style-src': ['self', 'unsafe-inline']
			}
		},
		env: {
			dir: '.'
		}
	},
	preprocess: vitePreprocess(),
	compilerOptions: {
		warningFilter: (warning) => {
			return !warning.code.startsWith('a11y-');
		}
	}
};

export default config;