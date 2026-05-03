import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Logo from '../assets/tuberiafd.png';

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const data = await login(username, password);
      nav(data.is_supervisor ? '/supervisor' : '/operario');
    } catch (err) {
      setError(err.message || 'Error al ingresar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30"
           style={{ backgroundImage: 'linear-gradient(rgba(43,108,176,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(43,108,176,.15) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(59,130,246,.12) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-7">
          <div className=" mx-auto mb-3 bg-blue-500/20 border rounded-2xl flex items-center justify-center overflow-hidden">
            <img src={Logo} alt="Tubería" className="" />
          </div>
          <h1 className="font-mono text-base text-white tracking-widest">CONTROL DE PROCESOS</h1>
          <p className="text-xs text-white/45 mt-1">Valor Agregador</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-7">
          <h2 className="text-white font-semibold mb-5 text-center">Inicia sesión para continuar</h2>

          {error && <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm px-3 py-2 rounded mb-3">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Usuario" autoFocus required autoComplete="username"
                className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 outline-none focus:border-blue-500/60 focus:bg-white/10 text-sm" />
            </div>
            <div className="relative">
              
              <input type={showPass ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña" required autoComplete="current-password"
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 outline-none focus:border-blue-500/60 focus:bg-white/10 text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">👁</button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm tracking-wider mt-3 transition disabled:opacity-50">
              {loading ? 'INGRESANDO...' : 'INGRESAR'}
            </button>
          </form>
        </div>
        <div className="text-center mt-5 text-white/30 text-xs">📶 Conexión local activada</div>
      </div>
    </div>
  );
}
