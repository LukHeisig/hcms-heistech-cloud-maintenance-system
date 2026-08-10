import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 3,
			retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
		},
	},
});