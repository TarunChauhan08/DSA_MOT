/** True only in the `wxt build --mode e2e` test build; constant-folded away in production. */
export const TEST_CLOCK_ENABLED: boolean = import.meta.env.MODE === 'e2e';
