/**
 * The public build is a demo: guest mode only, and nothing offers a sign-in.
 * The account code and the /auth route stay. Build with VITE_DEMO=false to bring login back.
 */
export const DEMO = import.meta.env.VITE_DEMO !== 'false';
