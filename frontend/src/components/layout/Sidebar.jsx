import { NavLink } from 'react-router-dom';
import { useAlertStore } from '../../store/useAlertStore';

const NAV_ITEMS = [
  { to: '/', label: 'Monitor', icon: '▣', end: true },
  { to: '/alerts', label: 'Alertas', icon: '⚡', badge: true },
  { to: '/history', label: 'Historial', icon: '◷' },
  { to: '/playback', label: 'Playback', icon: '▶' },
  { to: '/system', label: 'Sistema', icon: '◈' },
  { to: '/settings', label: 'Configuración', icon: '⚙' },
];

export default function Sidebar() {
  const unreadCount = useAlertStore((s) => s.unreadCount);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">◉</span>
        <span className="logo-text">VisionAI</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ to, label, icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
            {badge && unreadCount > 0 && (
              <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v1.0.0</span>
      </div>
    </aside>
  );
}