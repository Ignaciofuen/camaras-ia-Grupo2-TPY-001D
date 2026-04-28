export default function AlertCard({ alert }) {
  return (
    <div className="bg-gray-800 border-l-4 border-red-600 rounded-md p-3 shadow-lg hover:bg-gray-700 transition-colors duration-200">
      
      {/* Cabecera de la alerta */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
          {alert.label || "Amenaza Detectada"}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">
          {alert.timestamp || new Date().toLocaleTimeString()}
        </span>
      </div>
      
      {/* Descripción generada por Ollama */}
      <p className="text-sm text-gray-200 mb-3 leading-relaxed">
        {alert.description}
      </p>
      
      {/* Fotografía de la detección (Frame capturado por YOLO/OpenCV) */}
      {alert.image && (
        <div className="relative rounded overflow-hidden border border-gray-700">
          <img 
            src={alert.image} 
            alt="Evidencia" 
            className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity"
          />
          {/* Pequeña marca de agua sobre la foto */}
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
            IA Verificado
          </span>
        </div>
      )}
    </div>
  );
}