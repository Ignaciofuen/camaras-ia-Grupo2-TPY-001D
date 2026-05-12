import { useState } from 'react';

/**
 * Settings
 * Página de configuración global del sistema VMS.
 * Preparada estructuralmente para hidratarse dinámicamente mediante GET /settings 
 * y enviar actualizaciones vía PUT /settings.
 */
const Settings = () => {
  // Estado preparado para la futura integración con el backend
  const [settingsData, setSettingsData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Simulación estructural del manejador de guardado
  const handleSave = async (e) => {
    e.preventDefault();
    // Estructura lista para invocar PUT /settings
  };

  return (
    <div className="settings-page-container">
      
      {/* Cabecera de la página */}
      <header className="settings-header">
        <div className="settings-header-titles">
          <h1 className="settings-main-title">Configuración del Sistema</h1>
          <p className="settings-subtitle">Administración de parámetros globales, streaming y motor de IA.</p>
        </div>
        <div className="settings-header-actions">
          <button 
            type="button" 
            className="btn-save-settings" 
            onClick={handleSave}
            disabled={isSaving}
          >
            Guardar Cambios
          </button>
        </div>
      </header>

      {/* Contenedor principal de los paneles de configuración */}
      <div className="settings-content-wrapper">
        <form className="settings-form" onSubmit={handleSave}>
          
          {/* SECCIÓN 1: Configuración de Cámaras */}
          <section className="settings-panel">
            <header className="settings-panel-header">
              <h2 className="settings-panel-title">1. Configuración de Cámaras y Streaming</h2>
            </header>
            <div className="settings-panel-body">
              
              <div className="form-row">
                <label className="form-label">Servidor MediaMTX (HLS Base URL)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: http://mserver:8888" 
                  readOnly 
                />
              </div>

              <div className="form-row">
                <label className="form-label">Resolución de Grabación por Defecto</label>
                <select className="form-control-select" disabled>
                  <option value="">Seleccione resolución...</option>
                  {/* Opciones se cargarán desde el backend */}
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">Política de Retención (Días)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Días antes de sobreescritura..." 
                  readOnly 
                />
              </div>

            </div>
          </section>

          {/* SECCIÓN 2: Configuración de Alertas */}
          <section className="settings-panel">
            <header className="settings-panel-header">
              <h2 className="settings-panel-title">2. Configuración de Alertas y Motor IA</h2>
            </header>
            <div className="settings-panel-body">
              
              <div className="form-row">
                <label className="form-label">Umbral de Confianza YOLO (%)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Porcentaje mínimo para registrar alerta..." 
                  readOnly 
                />
              </div>

              <div className="form-row">
                <label className="form-label">Endpoint WebSocket de Eventos</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ws://..." 
                  readOnly 
                />
              </div>

            </div>
          </section>

          {/* SECCIÓN 3: Configuración del Sistema */}
          <section className="settings-panel">
            <header className="settings-panel-header">
              <h2 className="settings-panel-title">3. Configuración del Sistema Backend</h2>
            </header>
            <div className="settings-panel-body">
              
              <div className="form-row">
                <label className="form-label">FastAPI Base URL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="http://..." 
                  readOnly 
                />
              </div>

              <div className="form-row">
                <label className="form-label">Nivel de Log del Servidor (Logging Level)</label>
                <select className="form-control-select" disabled>
                  <option value="">Seleccione nivel...</option>
                  {/* Opciones se cargarán desde el backend */}
                </select>
              </div>

            </div>
          </section>

        </form>
      </div>
    </div>
  );
};

export default Settings;