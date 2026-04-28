import CameraCard from './CameraCard';

export default function CameraGrid() {
  // Cuando tengas la API, esto vendrá de PostgreSQL.
  // Por ahora, apuntamos directo a MediaMTX tal como lo diseñaron.
  const cameras = [
    { id: 'cam1', name: 'Entrada Principal', url: 'http://localhost:8888/cam1/index.m3u8' },
    { id: 'cam2', name: 'Zona Carga (Bodega)', url: 'http://localhost:8888/cam2/index.m3u8' },
    // Puedes agregar más si tu MediaMTX redistribuye más flujos
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
      {cameras.map((cam) => (
        <div key={cam.id} className="bg-black rounded-lg border border-gray-800 overflow-hidden relative group shadow-lg">
          
          {/* Overlay Superior: Nombre de cámara y Estado */}
          <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between pointer-events-none">
            <span className="text-sm font-semibold text-gray-200 drop-shadow-md">
              {cam.name}
            </span>
            <span className="text-[10px] text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded border border-green-500/30">
              REC
            </span>
          </div>

          {/* Componente del Reproductor (El que incluye tu código de HLS.js modificado) */}
          <CameraCard streamUrl={cam.url} />
          
        </div>
      ))}
    </div>
  );
}