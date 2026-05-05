import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';

import Login from './pages/Login';
import Layout from './components/Layout';

import SupervisorDashboard from './pages/SupervisorDashboard';
import BatchList   from './pages/BatchList';
import BatchDetail from './pages/BatchDetail';
import CreateBatch from './pages/CreateBatch';

import OperatorDashboard from './pages/OperatorDashboard';
import ProcessStart  from './pages/ProcessStart';
import ProcessFinish from './pages/ProcessFinish';

import QualityForm   from './pages/QualityForm';
import QualityDetail from './pages/QualityDetail';
import QualityReport from './pages/QualityReport';
import DimensionalLog from './pages/DimensionalLog';
import DimensionalAdd from './pages/DimensionalAdd';

import CuttingProgramList     from './pages/CuttingProgramList';
import CuttingProgramDetail   from './pages/CuttingProgramDetail';
import CuttingProgramOperator from './pages/CuttingProgramOperator';
import MachinesStatus         from './pages/MachinesStatus';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.is_supervisor ? '/supervisor' : '/operario'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<Protected><Layout /></Protected>}>
        {/* Supervisor */}
        <Route path="/supervisor"          element={<SupervisorDashboard />} />
        <Route path="/lotes"               element={<BatchList />} />
        <Route path="/nuevo-lote"          element={<CreateBatch />} />
        <Route path="/lote/:id"            element={<BatchDetail />} />
        {/* Operario */}
        <Route path="/operario"            element={<OperatorDashboard />} />
        <Route path="/proceso/iniciar/:id" element={<ProcessStart />} />
        <Route path="/proceso/terminar/:id" element={<ProcessFinish />} />
        {/* Calidad */}
        <Route path="/calidad/reporte"     element={<QualityReport />} />
        <Route path="/calidad/nuevo/:rid"  element={<QualityForm />} />
        <Route path="/calidad/editar/:rid" element={<QualityForm edit />} />
        <Route path="/calidad/ver/:rid"    element={<QualityDetail />} />
        <Route path="/dimensional/:rid"        element={<DimensionalLog />} />
        <Route path="/dimensional/:rid/nueva"  element={<DimensionalAdd />} />
        {/* Programa de corte */}
        <Route path="/programa"       element={<CuttingProgramList />} />
        <Route path="/programa/:id"   element={<CuttingProgramDetail />} />
        <Route path="/corte/programa" element={<CuttingProgramOperator />} />
        {/* Estado de máquinas */}
        <Route path="/maquinas"       element={<MachinesStatus />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
