import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3000,
		host: true
	},
	build: {
		target: 'es2022',
		minify: 'esbuild',
		sourcemap: true,
		chunkSizeWarningLimit: 250
	},
	optimizeDeps: {
		include: ['@types/uuid']
	},
	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0')
	}
});