import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Users, 
  Stethoscope, 
  ChevronRight, 
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Info,
  Download,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Patient, Consultation, User } from './types';

console.log(">>> App component loading...");

// --- Components ---

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-200 ${
      active 
        ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' 
        : 'bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
    <Icon size={18} />
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div {...props} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
    />
  </div>
);

const TextArea = ({ label, ...props }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all min-h-[100px]"
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pawmed_token'));
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState<'home' | 'patients' | 'consultations' | 'setup'>('home');
  const [patientSubView, setPatientSubView] = useState<'menu' | 'form' | 'list' | 'detail'>('menu');
  const [consultationSubView, setConsultationSubView] = useState<'menu' | 'form' | 'list'>('menu');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [config, setConfig] = useState({ hasPatientsUrl: false, hasConsultationsUrl: false, isAuthConfigured: false });

  // Form States
  const [patientForm, setPatientForm] = useState<Partial<Patient>>({});
  const [consultationForm, setConsultationForm] = useState<Partial<Consultation>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check for token in URL (fallback for some environments)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('pawmed_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    checkAuth();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [view, patientSubView, consultationSubView, user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log(">>> OAuth Success message received with token");
        const newToken = event.data.token;
        if (newToken) {
          localStorage.setItem('pawmed_token', newToken);
          setToken(newToken);
          setUser(event.data.user);
          setStatus({ type: 'success', message: `¡Bienvenido, ${event.data.user.name}!` });
        } else {
          checkAuth();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const apiFetch = async (url: string, options: any = {}) => {
    const currentToken = token || localStorage.getItem('pawmed_token');
    const headers = {
      ...options.headers,
      'Authorization': currentToken ? `Bearer ${currentToken}` : ''
    };
    return fetch(url, { ...options, headers });
  };

  const checkAuth = async () => {
    const currentToken = token || localStorage.getItem('pawmed_token');
    if (!currentToken) {
      console.log(">>> No token found in storage");
      return;
    }

    console.log(">>> Checking auth state with JWT...");
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) throw new Error("Error en la respuesta del servidor");
      const data = await res.json();
      console.log(">>> Auth data received:", data);
      if (data) {
        setUser(data);
        setStatus({ type: 'success', message: `¡Bienvenido, ${data.name}!` });
      } else {
        localStorage.removeItem('pawmed_token');
        setToken(null);
      }
    } catch (e: any) {
      console.error("Auth check failed:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/google/url');
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      
      console.log(">>> Opening OAuth popup:", url);
      const popup = window.open(url, 'google_login', 'width=500,height=600');
      
      if (!popup) {
        throw new Error("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      }

      const checkInterval = setInterval(() => {
        if (popup.closed) {
          console.log(">>> Popup closed, checking auth...");
          clearInterval(checkInterval);
          checkAuth();
        }
      }, 2000);
    } catch (e: any) {
      console.error("Login failed:", e);
      setStatus({ type: 'error', message: e.message });
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('pawmed_token');
      setToken(null);
      setUser(null);
      setView('home');
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch('/api/config');
      const data = await res.json();
      setConfig(data);
      if (!data.hasPatientsUrl || !data.hasConsultationsUrl) {
        setView('setup');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    if (view === 'home' || view === 'setup' || !user) return;
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch('/api/data/patients'),
        apiFetch('/api/data/consultations')
      ]);
      
      const pData = await pRes.json();
      const cData = await cRes.json();
      
      setPatients(pData);
      setConsultations(cData);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!patientForm.id;
      const newPatient = { ...patientForm, id: patientForm.id || Date.now().toString() };
      const res = await apiFetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'patient', data: newPatient })
      });
      const result = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: isEditing ? 'Paciente actualizado correctamente' : 'Paciente guardado correctamente' });
        setPatientForm({});
        setPatientSubView('detail');
        fetchData();
      } else {
        throw new Error(result.error || 'Error al guardar');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleAddConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!consultationForm.id;
      const newConsultation = { ...consultationForm, id: consultationForm.id || Date.now().toString(), fecha: consultationForm.fecha || new Date().toISOString() };
      const res = await apiFetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'consultation', data: newConsultation })
      });
      const result = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: isEditing ? 'Consulta actualizada correctamente' : 'Consulta registrada correctamente' });
        setConsultationForm({});
        setConsultationSubView('list');
        fetchData();
      } else {
        throw new Error(result.error || 'Error al guardar');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleSync = async () => {
    // Sync removed as per user request to use Google Sheets directly
  };

  const handleForceSync = async () => {
    // Force sync removed
  };

  const handleDelete = async (type: 'patients' | 'consultations', id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este registro permanentemente de Google Sheets?')) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/data/${type}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatus({ type: 'success', message: 'Registro eliminado correctamente' });
        if (type === 'patients') setPatientSubView('list');
        else setConsultationSubView('list');
        fetchData();
      } else {
        throw new Error('Error al eliminar');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handlePrintReport = (patient: Patient, patientConsultations: Consultation[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(225, 29, 72);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PawMed - Reporte Médico', 20, 25);
    
    // Patient Info
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(16);
    doc.text(`Paciente: ${patient.nombre}`, 20, 55);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DATOS DEL PACIENTE', 20, 65);
    
    doc.autoTable({
      startY: 70,
      head: [['Especie', 'Raza', 'Edad', 'Propietario', 'Contacto']],
      body: [[
        patient.especie,
        patient.raza,
        patient.edad,
        patient.propietario,
        `${patient.telefono}\n${patient.email}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    // History
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('HISTORIAL DE CONSULTAS', 20, doc.lastAutoTable.finalY + 15);

    const historyBody = patientConsultations.map(c => [
      new Date(c.fecha).toLocaleDateString(),
      c.motivo,
      `${c.diagnostico}\nTratamiento: ${c.tratamiento}`,
      `$${c.valor || '0.00'}`
    ]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Fecha', 'Motivo', 'Detalle Médico', 'Valor']],
      body: historyBody,
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado por PawMed el ${new Date().toLocaleString()}`, 20, 285);

    doc.save(`Reporte_${(patient.nombre || 'Paciente').replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`);
  };

  const handlePrintConsultation = (patient: Patient, c: Consultation) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(225, 29, 72);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PawMed - Resumen de Consulta', 20, 25);
    
    // Patient & Date
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(14);
    doc.text(`Paciente: ${patient.nombre}`, 20, 55);
    doc.text(`Fecha: ${new Date(c.fecha).toLocaleDateString()}`, 140, 55);
    
    // Details
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('MOTIVO DE CONSULTA', 20, 70);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text(c.motivo, 20, 78);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DIAGNÓSTICO', 20, 95);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(11);
    const diagLines = doc.splitTextToSize(c.diagnostico || 'N/A', 170);
    doc.text(diagLines, 20, 103);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('TRATAMIENTO / RECETA', 20, 130);
    doc.setTextColor(225, 29, 72);
    doc.setFontSize(11);
    const treatLines = doc.splitTextToSize(c.tratamiento || 'N/A', 170);
    doc.text(treatLines, 20, 138);

    if (c.notas) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('NOTAS ADICIONALES', 20, 170);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      const noteLines = doc.splitTextToSize(c.notas, 170);
      doc.text(noteLines, 20, 178);
    }

    // Amount
    doc.setFillColor(248, 250, 252);
    doc.rect(140, 200, 50, 20, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text('TOTAL COBRADO', 145, 208);
    doc.setTextColor(225, 29, 72);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${c.valor || '0.00'}`, 145, 216);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado por PawMed el ${new Date().toLocaleString()}`, 20, 285);

    doc.save(`Consulta_${(patient.nombre || 'Paciente').replace(/[^a-z0-9]/gi, '_')}_${new Date(c.fecha).toLocaleDateString().replace(/\//g, '-')}.pdf`);
  };

  const filteredPatients = patients.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.propietario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const appsScriptCode = `function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    
    if (sheet.getLastRow() === 0) {
      // Define headers based on data keys, but ensure 'id' is present
      var keys = Object.keys(data).filter(k => k !== 'action');
      sheet.appendRow(keys);
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var idIndex = headers.indexOf("id");

    if (data.action === 'delete') {
      if (idIndex === -1) throw new Error("No se encontró la columna 'id'");
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][idIndex] == data.id) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Eliminado" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "ID no encontrado" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var newRow = headers.map(function(h) { return data[h] !== undefined ? data[h] : ""; });
    
    // UPSERT logic
    if (idIndex !== -1 && data.id) {
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][idIndex] == data.id) {
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
          return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Actualizado" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Guardado" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": f.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["id", "nombre", "especie", "raza", "edad", "propietario", "telefono", "email", "pacienteId", "fecha", "motivo", "diagnostico", "tratamiento", "valor", "notas"]);
    }
    var rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    var headers = rows[0];
    var data = rows.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } catch (g) {
    return ContentService.createTextOutput(JSON.stringify({ "error": g.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  if (!user && config.isAuthConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-10 text-center space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Stethoscope size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">PawMed</h1>
            <p className="text-slate-500 font-medium">Gestión Veterinaria Profesional</p>
          </div>
          <div className="pt-4 space-y-4">
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 hover:border-rose-200 transition-all shadow-sm group disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {authLoading ? 'Procesando...' : 'Iniciar sesión con Google'}
            </button>
            
            {authLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium">Verificando sesión...</p>
              </div>
            ) : (
              <button 
                onClick={checkAuth}
                className="text-xs text-rose-600 font-bold hover:underline bg-rose-50 px-4 py-2 rounded-lg transition-colors"
              >
                ¿Ya iniciaste sesión? Haz clic aquí para entrar
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Al iniciar sesión, aceptas nuestros términos de servicio y política de privacidad.
          </p>
          
          <div className="pt-8 border-t border-slate-100">
            <p className="text-[10px] text-slate-300 font-mono">
              Debug: {window.location.protocol} // {window.location.hostname} | v1.0.2
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => setView('home')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-100">
              <Stethoscope size={24} />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight">PawMed</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Panel de Control</p>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                </div>
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200" />
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
            <button 
              onClick={() => setView('setup')}
              className={`p-2 rounded-xl transition-colors ${view === 'setup' ? 'bg-rose-50 text-rose-600' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Configuración"
            >
              <Info size={24} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 z-50 relative ${
                status.type === 'success' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{status.message}</span>
            </motion.div>
          )}

          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto pt-12"
            >
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">¡Hola de nuevo!</h2>
                <p className="text-lg text-slate-500">¿Qué gestión necesitas realizar hoy?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button
                  onClick={() => setView('patients')}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-transparent hover:border-rose-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Users size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Pacientes</h3>
                    <p className="text-slate-500 leading-relaxed">Gestiona el registro de mascotas, propietarios y datos de contacto.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users size={120} />
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-rose-600 font-bold">
                    Entrar <ChevronRight size={20} />
                  </div>
                </button>

                <button
                  onClick={() => setView('consultations')}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-transparent hover:border-violet-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <ClipboardList size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Consultas</h3>
                    <p className="text-slate-500 leading-relaxed">Registra visitas médicas, diagnósticos, tratamientos y recetas.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ClipboardList size={120} />
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-violet-600 font-bold">
                    Entrar <ChevronRight size={20} />
                  </div>
                </button>
              </div>

              <div className="mt-12 text-center">
                <p className="text-sm text-slate-400">Conectado directamente a Google Sheets</p>
              </div>
            </motion.div>
          )}

          {view === 'patients' && (
            <motion.div
              key="patients"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => {
                    if (patientSubView === 'menu') setView('home');
                    else if (patientSubView === 'detail') setPatientSubView('list');
                    else if (patientSubView === 'form' && patientForm.id) setPatientSubView('detail');
                    else setPatientSubView('menu');
                  }}
                  className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" /> {patientSubView === 'menu' ? 'Volver al Inicio' : patientSubView === 'detail' ? 'Volver a la Lista' : 'Volver'}
                </button>
                <h2 className="text-2xl font-black">Gestión de Pacientes</h2>
              </div>

              {patientSubView === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                  <button
                    onClick={() => {
                      setPatientForm({});
                      setPatientSubView('form');
                    }}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-rose-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Registrar Nuevo Paciente</h3>
                    <p className="text-slate-500 text-sm">Añade una nueva mascota al sistema.</p>
                  </button>

                  <button
                    onClick={() => setPatientSubView('list')}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-rose-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Search size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Consultar Pacientes</h3>
                    <p className="text-slate-500 text-sm">Busca y edita pacientes existentes.</p>
                  </button>
                </div>
              )}

              {patientSubView === 'form' && (
                <div className="max-w-2xl mx-auto">
                  <Card className="p-8">
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                      {patientForm.id ? <ClipboardList className="text-rose-600" size={24} /> : <Plus className="text-rose-600" size={24} />}
                      {patientForm.id ? 'Editar Paciente' : 'Nuevo Registro de Paciente'}
                    </h2>
                    <form onSubmit={handleAddPatient} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input 
                          label="Nombre del Paciente" 
                          placeholder="Ej: Max" 
                          required
                          value={patientForm.nombre || ''}
                          onChange={(e: any) => setPatientForm({...patientForm, nombre: e.target.value})}
                        />
                        <Input 
                          label="Especie" 
                          placeholder="Ej: Perro" 
                          value={patientForm.especie || ''}
                          onChange={(e: any) => setPatientForm({...patientForm, especie: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input 
                          label="Raza" 
                          placeholder="Ej: Beagle" 
                          value={patientForm.raza || ''}
                          onChange={(e: any) => setPatientForm({...patientForm, raza: e.target.value})}
                        />
                        <Input 
                          label="Edad" 
                          placeholder="Ej: 3 años" 
                          value={patientForm.edad || ''}
                          onChange={(e: any) => setPatientForm({...patientForm, edad: e.target.value})}
                        />
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Información del Propietario</h3>
                        <div className="space-y-6">
                          <Input 
                            label="Nombre del Propietario" 
                            placeholder="Nombre completo" 
                            value={patientForm.propietario || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, propietario: e.target.value})}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input 
                              label="Teléfono" 
                              placeholder="+34 ..." 
                              value={patientForm.telefono || ''}
                              onChange={(e: any) => setPatientForm({...patientForm, telefono: e.target.value})}
                            />
                            <Input 
                              label="Email" 
                              type="email" 
                              placeholder="correo@ejemplo.com" 
                              value={patientForm.email || ''}
                              onChange={(e: any) => setPatientForm({...patientForm, email: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 pt-6">
                        <button
                          type="button"
                          onClick={() => {
                            if (patientForm.id) setPatientSubView('detail');
                            else setPatientSubView('menu');
                          }}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        {patientForm.id && (
                          <button
                            type="button"
                            onClick={() => handleDelete('patients', patientForm.id!)}
                            className="flex-1 px-6 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-lg shadow-rose-100"
                        >
                          {loading ? 'Guardando...' : patientForm.id ? 'Guardar Cambios' : 'Registrar Paciente'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

              {patientSubView === 'detail' && patientForm.id && (
                <div className="max-w-5xl mx-auto space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Patient Profile Card */}
                    <div className="lg:col-span-1">
                      <Card className="p-6 sticky top-24">
                        <div className="text-center mb-6">
                          <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl font-black">
                            {patientForm.nombre?.[0]}
                          </div>
                          <h3 className="text-2xl font-black text-slate-900">{patientForm.nombre}</h3>
                          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{patientForm.especie} • {patientForm.raza}</p>
                        </div>

                        <div className="space-y-4 border-t border-slate-100 pt-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edad</p>
                            <p className="text-slate-700 font-medium">{patientForm.edad}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Propietario</p>
                            <p className="text-slate-700 font-medium">{patientForm.propietario}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto</p>
                            <p className="text-slate-700 font-medium">{patientForm.telefono}</p>
                            <p className="text-slate-500 text-sm">{patientForm.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mt-8">
                          <button
                            onClick={() => setPatientSubView('form')}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                          >
                            <ClipboardList size={18} />
                            Editar Perfil
                          </button>
                          <button
                            onClick={() => handlePrintReport(patientForm as Patient, consultations.filter(c => String(c.pacienteId) === String(patientForm.id)))}
                            className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Download size={18} />
                            Descargar Reporte PDF
                          </button>
                        </div>
                      </Card>
                    </div>

                    {/* Consultation History */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black flex items-center gap-2">
                          <Stethoscope className="text-rose-600" size={24} />
                          Historial Médico
                        </h3>
                        <button
                          onClick={() => {
                            setConsultationForm({ pacienteId: patientForm.id });
                            setView('consultations');
                            setConsultationSubView('form');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all"
                        >
                          <Plus size={16} />
                          Nueva Consulta
                        </button>
                      </div>

                      <div className="space-y-4">
                        {consultations.filter(c => String(c.pacienteId) === String(patientForm.id)).length === 0 ? (
                          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                            No hay consultas registradas para este paciente.
                          </div>
                        ) : (
                          consultations.filter(c => String(c.pacienteId) === String(patientForm.id)).map((consultation) => (
                            <Card 
                              key={consultation.id} 
                              className="p-6 hover:border-rose-200 transition-all group cursor-pointer hover:shadow-md"
                              onClick={() => {
                                setConsultationForm(consultation);
                                setView('consultations');
                                setConsultationSubView('form');
                              }}
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded uppercase tracking-wider">
                                    {new Date(consultation.fecha).toLocaleDateString()}
                                  </span>
                                  <h4 className="text-lg font-bold mt-2 group-hover:text-rose-600 transition-colors">{consultation.motivo}</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                  {consultation.valor && (
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-slate-400 uppercase">Cobro</p>
                                      <p className="text-lg font-black text-rose-600">${consultation.valor}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintConsultation(patientForm as Patient, consultation);
                                    }}
                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Descargar PDF de Consulta"
                                  >
                                    <Download size={20} />
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Diagnóstico</p>
                                  <p className="text-sm text-slate-700 line-clamp-2">{consultation.diagnostico || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tratamiento</p>
                                  <p className="text-sm text-slate-700 line-clamp-2">{consultation.tratamiento || 'N/A'}</p>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {patientSubView === 'list' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre de mascota o dueño..."
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {loading && patients.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">Cargando pacientes...</div>
                    ) : filteredPatients.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        No se encontraron pacientes.
                      </div>
                    ) : (
                      filteredPatients.map((patient) => (
                        <Card 
                          key={patient.id} 
                          className="p-5 hover:border-rose-200 transition-all group cursor-pointer hover:shadow-md"
                          onClick={() => {
                            setPatientForm(patient);
                            setPatientSubView('detail');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-xl group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">
                                {patient.nombre?.[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-lg text-slate-900">{patient.nombre}</h3>
                                </div>
                                <p className="text-sm text-slate-500 font-medium">{patient.especie} • {patient.raza} • {patient.edad}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-700">{patient.propietario}</p>
                                <p className="text-xs text-slate-400 font-medium">{patient.telefono}</p>
                              </div>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-rose-50 group-hover:text-rose-500 transition-all">
                                <ChevronRight size={24} />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'consultations' && (
            <motion.div
              key="consultations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => {
                    if (consultationSubView === 'menu') setView('home');
                    else setConsultationSubView('menu');
                  }}
                  className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" /> {consultationSubView === 'menu' ? 'Volver al Inicio' : 'Volver al Menú'}
                </button>
                <h2 className="text-2xl font-black">Gestión de Consultas</h2>
              </div>

              {consultationSubView === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                  <button
                    onClick={() => {
                      setConsultationForm({});
                      setConsultationSubView('form');
                    }}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-violet-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Nueva Consulta</h3>
                    <p className="text-slate-500 text-sm">Registra una visita médica para un paciente.</p>
                  </button>

                  <button
                    onClick={() => setConsultationSubView('list')}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-violet-500 shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <ClipboardList size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Historial de Consultas</h3>
                    <p className="text-slate-500 text-sm">Consulta visitas y tratamientos anteriores.</p>
                  </button>
                </div>
              )}

              {consultationSubView === 'form' && (
                <div className="max-w-2xl mx-auto">
                  <Card className="p-8">
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                      {consultationForm.id ? <ClipboardList className="text-violet-600" size={24} /> : <Plus className="text-violet-600" size={24} />}
                      {consultationForm.id ? 'Editar Consulta' : 'Nueva Consulta Médica'}
                    </h2>
                    <form onSubmit={handleAddConsultation} className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</label>
                        <select
                          required
                          disabled={!!consultationForm.id}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all disabled:opacity-60"
                          value={consultationForm.pacienteId || ''}
                          onChange={(e) => setConsultationForm({...consultationForm, pacienteId: e.target.value})}
                        >
                          <option value="">Seleccionar paciente...</option>
                          {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.propietario})</option>
                          ))}
                        </select>
                      </div>
                      <Input 
                        label="Motivo de Consulta" 
                        placeholder="Ej: Vacunación" 
                        required
                        value={consultationForm.motivo || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, motivo: e.target.value})}
                      />
                      <Input 
                        label="Valor de la Consulta ($)" 
                        placeholder="Ej: 50.00" 
                        type="number"
                        step="0.01"
                        value={consultationForm.valor || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, valor: e.target.value})}
                      />
                      <TextArea 
                        label="Diagnóstico" 
                        placeholder="Observaciones clínicas..." 
                        value={consultationForm.diagnostico || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, diagnostico: e.target.value})}
                      />
                      <TextArea 
                        label="Tratamiento / Receta" 
                        placeholder="Medicamentos, dosis..." 
                        value={consultationForm.tratamiento || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, tratamiento: e.target.value})}
                      />
                      <TextArea 
                        label="Notas Adicionales" 
                        placeholder="Seguimiento, etc." 
                        value={consultationForm.notas || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, notas: e.target.value})}
                      />
                      <div className="flex flex-wrap gap-4 pt-6">
                        <button
                          type="button"
                          onClick={() => setConsultationSubView('menu')}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        {consultationForm.id && (
                          <button
                            type="button"
                            onClick={() => handleDelete('consultations', consultationForm.id!)}
                            className="flex-1 px-6 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-lg shadow-violet-100"
                        >
                          {loading ? 'Guardando...' : consultationForm.id ? 'Guardar Cambios' : 'Registrar Consulta'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

              {consultationSubView === 'list' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 gap-4">
                    {loading && consultations.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">Cargando consultas...</div>
                    ) : consultations.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        No hay consultas registradas.
                      </div>
                    ) : (
                      consultations.map((consultation) => {
                        const patient = patients.find(p => String(p.id) === String(consultation.pacienteId));
                        return (
                          <Card 
                            key={consultation.id} 
                            className="p-6 hover:border-violet-200 transition-all group cursor-pointer hover:shadow-md"
                            onClick={() => {
                              setConsultationForm(consultation);
                              setConsultationSubView('form');
                            }}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded uppercase tracking-wider">
                                    {new Date(consultation.fecha).toLocaleDateString()}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold mt-2 group-hover:text-violet-600 transition-colors">{consultation.motivo}</h3>
                                <div className="flex items-center gap-4">
                                  <p className="text-sm text-slate-500">Paciente: <span className="font-semibold text-slate-700">{patient?.nombre || 'Desconocido'}</span></p>
                                  {consultation.valor && (
                                    <p className="text-sm text-violet-600 font-bold">Valor: ${consultation.valor}</p>
                                  )}
                                </div>
                              </div>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-violet-50 group-hover:text-violet-500 transition-all">
                                <ChevronRight size={24} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Diagnóstico</h4>
                                <p className="text-sm text-slate-700 line-clamp-2">{consultation.diagnostico || 'N/A'}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Tratamiento</h4>
                                <p className="text-sm text-slate-700 line-clamp-2">{consultation.tratamiento || 'N/A'}</p>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="lg:col-span-3 flex items-center justify-between mb-2">
                <button 
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" /> Volver al Inicio
                </button>
              </div>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Info size={32} />
                </div>
                <h2 className="text-2xl font-bold">Configuración de Google Sheets</h2>
                <p className="text-slate-500">Para que la aplicación funcione, debes configurar los scripts en tus documentos de Google Sheets.</p>
              </div>

              <Card className="p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                    Preparar las Hojas
                  </h3>
                  <p className="text-sm text-slate-600">Asegúrate de que tus hojas tengan los siguientes encabezados en la primera fila:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Pacientes</p>
                      <code className="text-xs text-rose-700 break-all">id, nombre, especie, raza, edad, propietario, telefono, email</code>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Consultas</p>
                      <code className="text-xs text-rose-700 break-all">id, pacienteId, fecha, motivo, diagnostico, tratamiento, notas</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                    Instalar el Script
                  </h3>
                  <p className="text-sm text-slate-600">Copia el siguiente código en <strong>Extensiones {'>'} Apps Script</strong> de cada documento:</p>
                  <div className="relative group">
                    <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl text-xs overflow-x-auto max-h-60">
                      {appsScriptCode}
                    </pre>
                    <button 
                      onClick={() => navigator.clipboard.writeText(appsScriptCode)}
                      className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                    Implementar como Web App
                  </h3>
                  <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
                    <li>Haz clic en <strong>Implementar {'>'} Nueva implementación</strong>.</li>
                    <li>Selecciona el tipo <strong>Aplicación web</strong>.</li>
                    <li>En "Quién tiene acceso", selecciona <strong>Cualquier persona</strong>.</li>
                    <li>Copia la URL generada y añádela a los secretos de AI Studio.</li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <a 
                      href="https://docs.google.com/spreadsheets/d/1yV29qWm04MwwajPAEexgc5KF2NyguCp6aYpeWhE8XyI/edit" 
                      target="_blank" 
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                      Abrir Hoja Pacientes <ExternalLink size={16} />
                    </a>
                    <a 
                      href="https://docs.google.com/spreadsheets/d/1crcq7rg_I0USW8xbpSwzlYSB-ISQ_dnv_WE5pKobdhg/edit" 
                      target="_blank" 
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                      Abrir Hoja Consultas <ExternalLink size={16} />
                    </a>
                  </div>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await apiFetch('/api/config');
                        const data = await res.json();
                        setConfig(data);
                        setStatus({ type: 'success', message: 'Conexión verificada con Google Sheets.' });
                      } catch (e) {
                        setStatus({ type: 'error', message: 'Error al verificar la configuración.' });
                      } finally {
                        setLoading(false);
                        setTimeout(() => setStatus(null), 5000);
                      }
                    }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    Verificar Conexión
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}



