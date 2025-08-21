import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
	console.error('Missing VITE_CONVEX_URL environment variable for Convex.');
}
const convexClient = new ConvexReactClient(convexUrl);
window.__convexClient = {
	mutation: (...a) => convexClient.mutation(...a),
	query: (...a) => convexClient.query(...a),
};

const rootEl = document.getElementById('app');
createRoot(rootEl).render(
	<ConvexProvider client={convexClient}>
		<App />
	</ConvexProvider>
);

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch(() => {});
	});
}
