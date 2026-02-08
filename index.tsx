/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Update import paths to point to files within the 'src' directory, which contains the correct modules. The filenames were also corrected.
import { LiveAPIProvider } from './src/contexts/LiveAPIProvider';
import { SettingsProvider } from './src/contexts/SettingsContext';
import App from './src/App';
import './src/index.css';

const API_KEY = process.env.API_KEY;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

if (!API_KEY) {
  root.render(
    <React.StrictMode>
      <div className="error-screen">API_KEY is not configured. Please set the API_KEY environment variable.</div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <LiveAPIProvider apiKey={API_KEY}>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </LiveAPIProvider>
    </React.StrictMode>
  );
}
