# SmartWash frontend

React/Vite role portals. See the root README for full setup, architecture and verification.

Run `npm ci`, then `npm run dev` from this directory; the backend must be on port 5000. Keep VITE_API_URL empty for the development proxy and same-origin production deployment. Browser sessions use HttpOnly cookies.

`npm run lint` and `npm run build` verify source and production output. End-to-end tests are started by `npm run test:e2e` at the project root, which provisions isolated MongoDB fixtures.
