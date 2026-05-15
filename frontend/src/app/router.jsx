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

        {/* PUBLICO */}
        <Route path="/login" element={<Login />} />

        {/* PRIVADO */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/history" element={<History />} />
            <Route path="/playback" element={<Playback />} />
            <Route path="/users" element={<UserManager />} />
            <Route path="/system" element={<System />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
