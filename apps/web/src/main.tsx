import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './shell/App';
import { Dashboard } from './shell/Dashboard';
import { Login } from './shell/Login';
import { I18nProvider } from './i18n/I18nProvider';
import { registeredModules, registeredModuleTranslations } from './modules/registeredModules';
import './styles.css';

const moduleRoutes = registeredModules.map(({ Component, routePath }) => ({
  path: routePath.replace(/^\//, ''),
  element: <Component />
}));

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      ...moduleRoutes
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider resources={registeredModuleTranslations}>
      <RouterProvider router={router} />
    </I18nProvider>
  </React.StrictMode>
);
