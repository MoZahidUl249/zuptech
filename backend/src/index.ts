import { createApp } from "./app";

/**
 * Process entry point. Everything the app *is* lives in app.ts; this file only
 * starts it, so importing the app (from a test, a script, or a future worker)
 * never binds a port.
 */
const app = createApp().listen(Number(process.env.PORT ?? 3000));

console.log(`🦊 ZUP TECH backend running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
