/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  base: '/grist-ifc-widget3/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ifc-lite/wasm'],
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
});
