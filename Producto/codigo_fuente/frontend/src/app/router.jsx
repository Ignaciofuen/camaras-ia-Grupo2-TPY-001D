import { BrowserRouter, Routes, Route } from 'react-router-dom';

import ProtectedRoute from '../auth/ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';

// pages
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Alerts from '../pages/Alerts';
import History from '../pages/History';
import Playback from '../pages/Playback';
import System from '../pages/System';
import Settings from '../pages/Settings';
import UserManager from '../pages/UserManager';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PÚBLICO */}
        <Route path="/login" element={<Login />} />

        {/* PRIVADO: todo dentro requiere estar autenticado */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/alerts"    element={<Alerts />} />
            <Route path="/history"   element={<History />} />
            <Route path="/playback"  element={<Playback />} />
            <Route path="/system"    element={<System />} />
          </Route>

          {/* SOLO OPERADOR — configuración de credenciales de cámaras */}
          <Route element={<ProtectedRoute requireRole="operador" />}>
            <Route element={<MainLayout />}>
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* SOLO ADMIN — usuarios */}
          <Route element={<ProtectedRoute requireRole="admin" />}>
            <Route element={<MainLayout />}>
              <Route path="/users" element={<UserManager />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
