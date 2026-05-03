import { useRef, useState, useEffect } from 'react';

export default function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasMark, setHasMark] = useState(!!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    const w = canvas.offsetWidth;
    canvas.width = w;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0D1B35';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, 120);
      img.src = value;
      setHasMark(true);
    }
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const t = e.touches?.[0];
    return {
      x: ((t?.clientX ?? e.clientX) - rect.left) * scaleX,
      y: ((t?.clientY ?? e.clientY) - rect.top)  * scaleX,
    };
  };

  const start = (e) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasMark(true);
  };

  const end = (e) => {
    e.preventDefault();
    setDrawing(false);
    if (hasMark) onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasMark(false);
    onChange?.('');
  };

  return (
    <div className="relative border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-2">
      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button type="button" onClick={clear}
        className="absolute top-2 right-2 text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-400 hover:text-red-600 hover:border-red-400">
        Limpiar
      </button>
      <div className={`text-xs text-center mt-1 ${hasMark ? 'text-emerald-600' : 'text-slate-400'}`}>
        {hasMark ? 'Firmado ✓' : 'Sin firmar'}
      </div>
    </div>
  );
}
