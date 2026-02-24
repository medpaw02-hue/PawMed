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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Consultation } from './types';

console.log(">>> App component loading...");

// --- Components ---

// --- Constants & Types ---

const LOGO_BASE64 = 'DATA_IMAGE_PNG_BASE64_HERE'; // User should replace this with the actual base64 of image.png

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-200 ${
      active 
        ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' 
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
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-brand-pink outline-none transition-all"
    />
  </div>
);

const TextArea = ({ label, ...props }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-brand-pink outline-none transition-all min-h-[100px]"
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'patients' | 'consultations' | 'prescriptions' | 'setup' | 'login'>('login');
  const [user, setUser] = useState<{ username: string, role: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [patientSubView, setPatientSubView] = useState<'menu' | 'form' | 'list' | 'detail'>('menu');
  const [consultationSubView, setConsultationSubView] = useState<'menu' | 'form' | 'list' | 'prescription'>('menu');
  const [prescriptionSubView, setPrescriptionSubView] = useState<'menu' | 'form' | 'list'>('menu');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [config, setConfig] = useState({ 
    hasPatientsUrl: false, 
    hasConsultationsUrl: false, 
    hasPrescriptionsUrl: false,
    hasAuthUrl: false,
    patientsUrl: '', 
    consultationsUrl: '', 
    prescriptionsUrl: '',
    authUrl: '',
    isAuthConfigured: false 
  });

  // Form States
  const [patientForm, setPatientForm] = useState<Partial<Patient>>({});
  const [consultationForm, setConsultationForm] = useState<Partial<Consultation>>({});
  const [prescriptionForm, setPrescriptionForm] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    fetchData();
  }, [view, patientSubView, consultationSubView, prescriptionSubView]);

  const apiFetch = async (url: string, options: any = {}) => {
    return fetch(url, options);
  };

  const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      if (text.includes("Rate exceeded")) {
        throw new Error("Límite de peticiones excedido. Por favor, espera unos segundos.");
      }
      throw new Error("Respuesta no válida del servidor.");
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch('/api/config');
      const data = await safeJson(res);
      setConfig(data);
      if (!data.hasPatientsUrl || !data.hasConsultationsUrl || !data.hasAuthUrl) {
        setView('setup');
      } else if (!user) {
        setView('login');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'auth',
          data: loginForm
        })
      });
      const result = await safeJson(res);
      if (result.status === 'success') {
        setUser({ username: result.user.username, role: result.user.role });
        setView('home');
        setStatus({ type: 'success', message: `Bienvenido, ${result.user.username}` });
      } else {
        setStatus({ type: 'error', message: result.message || 'Usuario o contraseña incorrectos' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patientsUrl: config.patientsUrl, 
          consultationsUrl: config.consultationsUrl,
          prescriptionsUrl: config.prescriptionsUrl,
          authUrl: config.authUrl
        })
      });
      if (res.ok) {
        setStatus({ type: 'success', message: 'Configuración guardada correctamente.' });
        fetchConfig();
      } else {
        throw new Error('Error al guardar la configuración.');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const fetchData = async () => {
    if (view === 'setup') return;
    setLoading(true);
    try {
      const [pRes, cRes, prRes] = await Promise.all([
        apiFetch('/api/data/patients'),
        apiFetch('/api/data/consultations'),
        apiFetch('/api/data/prescriptions')
      ]);
      
      const pData = await safeJson(pRes);
      const cData = await safeJson(cRes);
      const prData = await safeJson(prRes);
      
      const normalize = (data: any[]) => {
        if (!Array.isArray(data)) return [];
        const camelKeys = [
          'pacienteId', 'condicionCorporal', 'frecuenciaCardiaca', 
          'frecuenciaRespiratoria', 'tiempoLlenadoCapilar', 'reflejoDeglutorio', 
          'reflejoTusigeno', 'estadoHidratacion', 'diagnosticoPresuntivo', 
          'diagnosticoDefinitivo', 'indicacionEvolucion'
        ];
        
        return data.map(item => {
          const normalized: any = { ...item };
          const lowerItem: any = {};
          Object.keys(item).forEach(k => lowerItem[k.toLowerCase()] = item[k]);
          
          camelKeys.forEach(ck => {
            const lck = ck.toLowerCase();
            if (lowerItem[lck] !== undefined) {
              normalized[ck] = lowerItem[lck];
            }
          });
          
          // Ensure 'id' is always available as 'id'
          if (lowerItem['id'] !== undefined) normalized.id = lowerItem['id'];
          
          return normalized;
        });
      };

      setPatients(normalize(pData));
      setConsultations(normalize(cData));
      setPrescriptions(normalize(prData));
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
      
      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error(">>> Non-JSON response from proxy:", text);
        throw new Error(`El servidor devolvió una respuesta no válida. Status: ${res.status}`);
      }

      if (res.ok) {
        setStatus({ type: 'success', message: isEditing ? 'Paciente actualizado correctamente' : 'Paciente guardado correctamente' });
        setPatientForm({});
        setPatientSubView('list');
        fetchData();
      } else {
        const errorMsg = result.error || result.details || 'Error desconocido';
        throw new Error(errorMsg);
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
      
      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error(">>> Non-JSON response from proxy:", text);
        throw new Error(`El servidor devolvió una respuesta no válida. Status: ${res.status}`);
      }

      if (res.ok) {
        setStatus({ type: 'success', message: isEditing ? 'Consulta actualizada correctamente' : 'Consulta registrada correctamente' });
        setConsultationForm({});
        setConsultationSubView('list');
        fetchData();
      } else {
        const errorMsg = result.error || result.details || 'Error desconocido';
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEditing = !!prescriptionForm.id;
      const newPrescription = { 
        ...prescriptionForm, 
        id: prescriptionForm.id || Date.now().toString(),
        fecha: prescriptionForm.fecha || new Date().toISOString()
      };
      const res = await apiFetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'prescription', data: newPrescription })
      });
      
      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error(">>> Non-JSON response from proxy:", text);
        throw new Error(`El servidor devolvió una respuesta no válida. Status: ${res.status}`);
      }

      if (res.ok) {
        setStatus({ type: 'success', message: isEditing ? 'Receta actualizada correctamente' : 'Receta guardada correctamente' });
        setPrescriptionForm({});
        setConsultationSubView('list');
        fetchData();
      } else {
        const errorMsg = result.error || result.details || 'Error desconocido';
        throw new Error(errorMsg);
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
    console.log(`>>> handleDelete called for ${type} with ID: ${id}`);
    
    if (!id) {
      setStatus({ type: 'error', message: 'Error: No se encontró el ID del registro.' });
      return;
    }

    // Set a clear waiting message
    setStatus({ 
      type: 'warning', 
      message: 'Eliminando registro... Por favor espere 5 segundos para que el proceso se complete correctamente.' 
    });
    setLoading(true);

    const startTime = Date.now();

    try {
      // If deleting a patient, delete associated consultations first
      if (type === 'patients') {
        const associatedConsultations = consultations.filter(c => String(c.pacienteId) === String(id));
        console.log(`>>> Deleting ${associatedConsultations.length} associated consultations...`);
        for (const consultation of associatedConsultations) {
          await apiFetch(`/api/data/consultations/${consultation.id}`, { method: 'DELETE' });
        }
      }
      
      console.log(`>>> Sending delete request to server for ${type}/${id}`);
      const res = await apiFetch(`/api/data/${type}/${id}`, { method: 'DELETE' });
      
      let result;
      const text = await res.text();
      console.log(`>>> Delete response text:`, text);
      
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { error: 'Respuesta no válida del servidor', raw: text };
      }
      
      if (res.ok && result.status !== 'error') {
        // Calculate remaining time to reach 5 seconds
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 5000 - elapsed);
        
        setTimeout(() => {
          setStatus({ type: 'success', message: 'Registro eliminado. Actualizando...' });
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }, remaining);
      } else {
        const errorMsg = result.error || result.message || result.details || 'Error al eliminar';
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      console.error(">>> Delete error:", e);
      setStatus({ type: 'error', message: e.message });
      setLoading(false);
    }
  };

  const handlePrintReport = (patient: Patient, patientConsultations: Consultation[]) => {
    try {
      console.log(">>> Generating PDF report...");
      const doc = new jsPDF();
      
      if (typeof autoTable !== 'function') {
        console.error(">>> autoTable is not a function!", autoTable);
        throw new Error("Error interno: No se pudo cargar el generador de tablas.");
      }

      // Add Logo if available
      if (LOGO_BASE64 !== 'DATA_IMAGE_PNG_BASE64_HERE') {
        try {
          doc.addImage(LOGO_BASE64, 'PNG', 160, 5, 30, 30);
        } catch (e) {
          console.warn("Could not add logo to PDF", e);
        }
      }

    doc.setFillColor(240, 120, 180); // #F078B4
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
    
    autoTable(doc, {
      startY: 70,
      head: [['Especie', 'Raza', 'Edad', 'Sexo', 'Esterilizado', 'Color']],
      body: [[
        patient.especie,
        patient.raza,
        patient.edad,
        patient.sexo || '-',
        patient.esterilizado || '-',
        patient.color || '-'
      ]],
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    const finalY0 = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DATOS DEL PROPIETARIO', 20, finalY0 + 10);

    autoTable(doc, {
      startY: finalY0 + 15,
      head: [['Nombre', 'Cédula', 'Teléfono', 'Email', 'Dirección']],
      body: [[
        patient.propietario,
        patient.cedula || '-',
        patient.telefono,
        patient.email,
        patient.direccion || '-'
      ]],
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    // History
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const finalY1 = (doc as any).lastAutoTable.finalY;
    doc.text('HISTORIAL DE CONSULTAS', 20, finalY1 + 15);

    const historyBody = patientConsultations.map(c => [
      new Date(c.fecha).toLocaleDateString(),
      c.motivo,
      `${c.diagnosticoDefinitivo || c.diagnosticoPresuntivo || 'N/A'}\nTratamiento: ${c.tratamiento}`,
      `$${c.valor || '0.00'}`
    ]);

    autoTable(doc, {
      startY: finalY1 + 20,
      head: [['Fecha', 'Motivo', 'Detalle Médico', 'Valor']],
      body: historyBody,
      theme: 'striped',
      headStyles: { fillColor: [240, 120, 180], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado por PawMed el ${new Date().toLocaleString()}`, 20, 285);

    doc.save(`Reporte_${(patient.nombre || 'Paciente').replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`);
    } catch (error: any) {
      console.error(">>> PDF Generation Error:", error);
      setStatus({ type: 'error', message: `No se pudo generar el PDF: ${error.message}` });
    }
  };

  const handlePrintConsultation = (patient: Patient, c: Consultation) => {
    try {
      console.log(">>> Generating Consultation PDF...");
      const doc = new jsPDF();
      
      // Add Logo if available
      if (LOGO_BASE64 !== 'DATA_IMAGE_PNG_BASE64_HERE') {
        try {
          doc.addImage(LOGO_BASE64, 'PNG', 160, 5, 30, 30);
        } catch (e) {
          console.warn("Could not add logo to PDF", e);
        }
      }

      // Header
      doc.setFillColor(240, 120, 180); // #F078B4
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

      // Examen Físico
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('EXAMEN FÍSICO', 20, 95);
      autoTable(doc, {
        startY: 100,
        body: [
          ['Temp:', c.temperatura || '-', 'Peso:', c.peso || '-', 'C. Corporal:', c.condicionCorporal || '-'],
          ['F. Cardíaca:', c.frecuenciaCardiaca || '-', 'F. Resp:', c.frecuenciaRespiratoria || '-', 'Mucosas:', c.mucosas || '-'],
          ['T. Llenado:', c.tiempoLlenadoCapilar || '-', 'Ganglios:', c.ganglios || '-', 'R. Deglutorio:', c.reflejoDeglutorio || '-'],
          ['R. Tusígeno:', c.reflejoTusigeno || '-', 'Hidratación:', c.estadoHidratacion || '-', '', '']
        ],
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      const addSection = (title: string, content: string | undefined, color: number[] = [51, 65, 85]) => {
        if (!content) return;
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(title, 20, currentY);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(content, 170);
        doc.text(lines, 20, currentY + 8);
        currentY += (lines.length * 6) + 15;
      };

      addSection('HALLAZGOS', c.hallazgos);
      addSection('DIAGNÓSTICO PRESUNTIVO', c.diagnosticoPresuntivo);
      addSection('DIAGNÓSTICO DEFINITIVO', c.diagnosticoDefinitivo);
      addSection('TRATAMIENTO', c.tratamiento, [240, 120, 180]);
      addSection('INDICACIÓN Y EVOLUCIÓN', c.indicacionEvolucion);
      addSection('NOTAS ADICIONALES', c.notas);

      // Amount
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFillColor(248, 250, 252);
      doc.rect(140, currentY, 50, 20, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text('TOTAL COBRADO', 145, currentY + 8);
      doc.setTextColor(240, 120, 180);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${c.valor || '0.00'}`, 145, currentY + 16);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generado por PawMed el ${new Date().toLocaleString()}`, 20, 285);

      doc.save(`Consulta_${(patient.nombre || 'Paciente').replace(/[^a-z0-9]/gi, '_')}_${new Date(c.fecha).toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } catch (error: any) {
      console.error(">>> PDF Generation Error:", error);
      setStatus({ type: 'error', message: `No se pudo generar el PDF: ${error.message}` });
    }
  };

  const handlePrintPrescription = (patient: Patient, c: Consultation, pr: any) => {
    try {
      console.log(">>> Generating Prescription PDF...");
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const brandPink = [240, 120, 180];
      const brandBlue = [137, 207, 240];

      // Header Banner
      doc.setFillColor(brandBlue[0], brandBlue[1], brandBlue[2]);
      doc.rect(70, 0, 227, 35, 'F');

      // Logo
      if (LOGO_BASE64 !== 'DATA_IMAGE_PNG_BASE64_HERE') {
        try {
          doc.addImage(LOGO_BASE64, 'PNG', 15, 5, 45, 45);
        } catch (e) {
          // Fallback to text if image fails
          doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
          doc.setFontSize(40);
          doc.setFont('helvetica', 'bold');
          doc.text('PAW', 15, 25);
          doc.text('Med', 40, 35);
        }
      } else {
        // Logo Placeholder (Using text for now as we don't have the image asset)
        doc.setTextColor(brandPink[0], brandPink[1], brandPink[2]);
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.text('PAW', 15, 25);
        doc.text('Med', 40, 35);
      }

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('VETERINARIA A DOMICILIO', 75, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('DRA. SOFÍA GUTIERREZ Y DRA. MELANY MUÑOZ', 75, 22);
      doc.text('MEDICO VETERINARIO', 75, 28);

      // Contact Info (Right side of header)
      doc.setFontSize(8);
      doc.text('pawmed.uio', 220, 12);
      doc.text('Paw Med', 220, 18);
      doc.text('0963579956', 260, 12);
      doc.text('medpaw02@gmail.com', 260, 18);

      // Patient Info Section
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`PACIENTE: ${patient.nombre.toUpperCase()}`, 15, 50);
      doc.text(`EDAD: ${patient.edad.toUpperCase()}`, 15, 57);
      doc.text(`PESO: ${c.peso || '-'} KG`, 15, 64);

      doc.text(`PROPIETARIO/A: ${patient.propietario.toUpperCase()}`, 140, 50);
      doc.text(`FECHA: ${new Date(pr.fecha).toLocaleDateString()}`, 140, 57);

      // Divider
      doc.setDrawColor(brandBlue[0], brandBlue[1], brandBlue[2]);
      doc.setLineWidth(0.5);
      doc.line(15, 70, 282, 70);

      // Columns Titles
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(12);
      doc.text('PRESCRIPCIÓN', 50, 78);
      doc.text('INDICACIONES', 190, 78);

      // Vertical Divider
      doc.line(148, 70, 148, 180);

      // Content
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      const prescLines = doc.splitTextToSize(pr.prescripcion, 120);
      doc.text(prescLines, 15, 90);

      const indicLines = doc.splitTextToSize(pr.indicaciones, 120);
      doc.text(indicLines, 155, 90);

      // Footer
      doc.setFont('helvetica', 'bold');
      doc.text(`CONTROL: ${pr.control || '-'}`, 15, 190);

      // Signature Area
      doc.setFontSize(9);
      doc.text('Dra. Melany Muñoz V.', 210, 185);
      doc.setFont('helvetica', 'normal');
      doc.text('Médica Veterinaria', 210, 190);
      doc.text('CI. 1725035818', 210, 195);
      doc.text('Senecyt. 1040-2025-3056144', 210, 200);

      // Bottom Banner
      doc.setFillColor(brandPink[0], brandPink[1], brandPink[2]);
      doc.rect(0, 205, 297, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('POR QUÉ LLEVARLO A LA VET - SI LA VET PUEDE IR A TI!', 148, 212, { align: 'center' });

      doc.save(`Receta_${(patient.nombre || 'Paciente').replace(/[^a-z0-9]/gi, '_')}_${new Date(pr.fecha).toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } catch (error: any) {
      console.error(">>> PDF Generation Error:", error);
      setStatus({ type: 'error', message: `No se pudo generar el PDF: ${error.message}` });
    }
  };

  const filteredPatients = patients.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.propietario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const appsScriptCode = `function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data = {};
    
    // Try to get data from postData (JSON)
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch(err) {
        console.log("Error parsing postData: " + err);
      }
    }
    
    // Merge with parameters (Query string or Form params)
    if (e && e.parameter) {
      for (var key in e.parameter) {
        data[key] = e.parameter[key];
      }
    }

    var action = data.action;
    console.log("Action: " + action + ", Data: " + JSON.stringify(data));

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var idIndex = -1;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toString().toLowerCase() === "id") {
        idIndex = i;
        break;
      }
    }
    
    if (action === 'delete') {
      if (idIndex === -1) throw new Error("No se encontró la columna 'id' en la primera fila.");
      var rows = sheet.getDataRange().getValues();
      var deleted = false;
      var targetId = String(data.id).trim();
      
      for (var i = rows.length - 1; i >= 1; i--) {
        var rowId = String(rows[i][idIndex]).trim();
        if (rowId === targetId) {
          sheet.deleteRow(i + 1);
          deleted = true;
        }
      }
      
      var result = deleted ? {status: 'success', message: 'Eliminado'} : {status: 'error', message: 'ID no encontrado: ' + targetId};
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'upsert') {
      delete data.action;
      var rows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      var targetId = String(data.id).trim();

      if (idIndex !== -1) {
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][idIndex]).trim() === targetId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      var rowValues = headers.map(function(h) { 
        var val = data[h];
        if (val === undefined) {
          var lowerH = h.toString().toLowerCase();
          for (var key in data) {
            if (key.toLowerCase() === lowerH) {
              val = data[key];
              break;
            }
          }
        }
        return val !== undefined ? val : ''; 
      });

      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({status: 'success', message: rowIndex > -1 ? 'Actualizado' : 'Creado'})).setMimeType(ContentService.MimeType.JSON);
    }

    // Default: return all data (for doGet or requests without specific write action)
    var rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    var headers = rows[0];
    var resultData = rows.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(resultData)).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    console.error("Error: " + e.toString());
    return ContentService.createTextOutput(JSON.stringify({status: 'error', details: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => setView('home')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {LOGO_BASE64 !== 'DATA_IMAGE_PNG_BASE64_HERE' ? (
              <div className="w-14 h-14 flex items-center justify-center">
                <img src={LOGO_BASE64} alt="PawMed Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-pink/20">
                <Stethoscope size={24} />
              </div>
            )}
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight text-brand-pink">PawMed</h1>
              <p className="text-xs text-brand-blue font-bold uppercase tracking-wider">Servicios Veterinarios</p>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchData()}
              disabled={loading}
              className={`p-2 rounded-xl transition-colors ${loading ? 'animate-spin text-brand-pink' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Refrescar Datos"
            >
              <Download size={24} className="rotate-180" />
            </button>
            <button 
              onClick={() => setView('setup')}
              className={`p-2 rounded-xl transition-colors ${view === 'setup' ? 'bg-brand-pink/10 text-brand-pink' : 'text-slate-400 hover:bg-slate-100'}`}
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
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 z-50 relative border shadow-sm ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                status.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                'bg-brand-pink/10 text-brand-pink border-brand-pink/20'
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
              className="max-w-5xl mx-auto pt-12"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <button
                  onClick={() => { setView('patients'); setPatientSubView('menu'); }}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-brand-pink/10 text-brand-pink rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Users size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Pacientes</h3>
                    <p className="text-slate-500 leading-relaxed">Gestiona el registro de mascotas, propietarios y datos de contacto.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users size={120} />
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-brand-pink font-bold">
                    Entrar <ChevronRight size={20} />
                  </div>
                </button>

                <button
                  onClick={() => { setView('consultations'); setConsultationSubView('menu'); }}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-blue shadow-xl shadow-slate-200/50 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Stethoscope size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Consultas</h3>
                    <p className="text-slate-500 leading-relaxed">Registra visitas médicas, diagnósticos y tratamientos.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Stethoscope size={120} />
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-brand-blue font-bold">
                    Entrar <ChevronRight size={20} />
                  </div>
                </button>

                <button
                  onClick={() => { setView('prescriptions'); setPrescriptionSubView('menu'); }}
                  className="group relative bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-brand-pink/10 text-brand-pink rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <ClipboardList size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Recetas</h3>
                    <p className="text-slate-500 leading-relaxed">Elabora recetas médicas y descarga indicaciones en PDF.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ClipboardList size={120} />
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-brand-pink font-bold">
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
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-brand-pink/10 text-brand-pink rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Registrar Nuevo Paciente</h3>
                    <p className="text-slate-500 text-sm">Añade una nueva mascota al sistema.</p>
                  </button>

                    <button
                      onClick={() => setPatientSubView('list')}
                      className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
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
                      {patientForm.id ? <ClipboardList className="text-brand-pink" size={24} /> : <Plus className="text-brand-pink" size={24} />}
                      {patientForm.id ? 'Editar Paciente' : 'Nuevo Registro de Paciente'}
                    </h2>
                    <form onSubmit={handleAddPatient} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Datos del Paciente</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Input 
                            label="Nombre del Paciente" 
                            placeholder="Ej: Max" 
                            required
                            value={patientForm.nombre || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, nombre: e.target.value})}
                          />
                          <Input 
                            label="Edad" 
                            placeholder="Ej: 3 años" 
                            value={patientForm.edad || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, edad: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Input 
                            label="Especie" 
                            placeholder="Ej: Perro" 
                            value={patientForm.especie || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, especie: e.target.value})}
                          />
                          <Input 
                            label="Raza" 
                            placeholder="Ej: Beagle" 
                            value={patientForm.raza || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, raza: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Input 
                            label="Color" 
                            placeholder="Ej: Blanco/Marrón" 
                            value={patientForm.color || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, color: e.target.value})}
                          />
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sexo</label>
                            <select
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-brand-pink outline-none transition-all"
                              value={patientForm.sexo || ''}
                              onChange={(e) => setPatientForm({...patientForm, sexo: e.target.value})}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="Macho">Macho</option>
                              <option value="Hembra">Hembra</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Esterilizado</label>
                            <select
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-brand-pink outline-none transition-all"
                              value={patientForm.esterilizado || ''}
                              onChange={(e) => setPatientForm({...patientForm, esterilizado: e.target.value})}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="Sí">Sí</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Datos del Propietario</h3>
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input 
                              label="Nombre del Propietario" 
                              placeholder="Nombre completo" 
                              value={patientForm.propietario || ''}
                              onChange={(e: any) => setPatientForm({...patientForm, propietario: e.target.value})}
                            />
                            <Input 
                              label="Cédula / ID" 
                              placeholder="Documento de identidad" 
                              value={patientForm.cedula || ''}
                              onChange={(e: any) => setPatientForm({...patientForm, cedula: e.target.value})}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input 
                              label="Teléfono" 
                              placeholder="Ej: 09..." 
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
                          <Input 
                            label="Dirección" 
                            placeholder="Dirección domiciliaria" 
                            value={patientForm.direccion || ''}
                            onChange={(e: any) => setPatientForm({...patientForm, direccion: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <TextArea 
                          label="Notas" 
                          placeholder="Información adicional relevante..." 
                          value={patientForm.notas || ''}
                          onChange={(e: any) => setPatientForm({...patientForm, notas: e.target.value})}
                        />
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
                              className="flex-1 px-6 py-3 bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-xl font-bold hover:bg-brand-pink/20 transition-colors"
                            >
                              Eliminar
                            </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-brand-pink text-white py-3 rounded-xl font-bold hover:bg-brand-pink/90 transition-colors disabled:opacity-50 shadow-lg shadow-brand-pink/20"
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
                          <div className="w-24 h-24 bg-brand-pink/10 text-brand-pink rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl font-black">
                            {patientForm.nombre?.[0]}
                          </div>
                          <h3 className="text-2xl font-black text-slate-900">{patientForm.nombre}</h3>
                          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{patientForm.especie} • {patientForm.raza}</p>
                        </div>

                        <div className="space-y-4 border-t border-slate-100 pt-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edad</p>
                              <p className="text-slate-700 font-medium">{patientForm.edad}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sexo</p>
                              <p className="text-slate-700 font-medium">{patientForm.sexo || '-'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color</p>
                              <p className="text-slate-700 font-medium">{patientForm.color || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esterilizado</p>
                              <p className="text-slate-700 font-medium">{patientForm.esterilizado || '-'}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Propietario</p>
                            <p className="text-slate-700 font-medium">{patientForm.propietario}</p>
                            <p className="text-[10px] text-slate-400">CI: {patientForm.cedula || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto</p>
                            <p className="text-slate-700 font-medium">{patientForm.telefono}</p>
                            <p className="text-slate-500 text-sm">{patientForm.email}</p>
                            <p className="text-slate-500 text-xs mt-1">{patientForm.direccion || '-'}</p>
                          </div>
                          {patientForm.notas && (
                            <div className="pt-2 border-t border-slate-50">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas</p>
                              <p className="text-slate-600 text-sm italic">{patientForm.notas}</p>
                            </div>
                          )}
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
                            className="w-full py-3 bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-xl font-bold hover:bg-brand-pink/20 transition-colors flex items-center justify-center gap-2"
                          >
                            <Download size={18} />
                            Descargar Reporte PDF
                          </button>
                          <button
                            onClick={() => handleDelete('patients', patientForm.id!)}
                            className="w-full py-3 bg-white text-brand-pink border border-brand-pink/20 rounded-xl font-bold hover:bg-brand-pink/10 transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 size={18} />
                            Eliminar Paciente
                          </button>
                        </div>
                      </Card>
                    </div>

                    {/* Consultation History */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black flex items-center gap-2">
                          <Stethoscope className="text-brand-pink" size={24} />
                          Historial Médico
                        </h3>
                        <button
                          onClick={() => {
                            setConsultationForm({ pacienteId: patientForm.id });
                            setView('consultations');
                            setConsultationSubView('form');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-pink text-white rounded-xl text-sm font-bold hover:bg-brand-pink/90 transition-all"
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
                              className="p-6 hover:border-brand-pink/30 transition-all group cursor-pointer hover:shadow-md"
                              onClick={() => {
                                setConsultationForm(consultation);
                                setView('consultations');
                                setConsultationSubView('form');
                              }}
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <span className="text-xs font-bold text-brand-pink bg-brand-pink/10 px-2 py-1 rounded uppercase tracking-wider">
                                    {new Date(consultation.fecha).toLocaleDateString()}
                                  </span>
                                  <h4 className="text-lg font-bold mt-2 group-hover:text-brand-pink transition-colors">{consultation.motivo}</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                  {consultation.valor && (
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-slate-400 uppercase">Cobro</p>
                                      <p className="text-lg font-black text-brand-pink">${consultation.valor}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintConsultation(patientForm as Patient, consultation);
                                    }}
                                    className="p-2 text-brand-pink hover:bg-brand-pink/10 rounded-lg transition-colors"
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
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-brand-pink transition-all"
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
                          className="p-5 hover:border-brand-pink/30 transition-all group cursor-pointer hover:shadow-md"
                          onClick={() => {
                            setPatientForm(patient);
                            setPatientSubView('detail');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-xl group-hover:bg-brand-pink/10 group-hover:text-brand-pink transition-colors">
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
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete('patients', patient.id);
                                  }}
                                  className="p-2 text-slate-300 hover:text-brand-pink hover:bg-brand-pink/10 rounded-xl transition-all"
                                  title="Eliminar Paciente"
                                >
                                  <Trash2 size={20} />
                                </button>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-brand-pink/10 group-hover:text-brand-pink transition-all">
                                  <ChevronRight size={24} />
                                </div>
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
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-blue shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Nueva Consulta</h3>
                    <p className="text-slate-500 text-sm">Registra una visita médica para un paciente.</p>
                  </button>

                  <button
                    onClick={() => setConsultationSubView('list')}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-blue shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
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
                      {consultationForm.id ? <ClipboardList className="text-brand-blue" size={24} /> : <Plus className="text-brand-blue" size={24} />}
                      {consultationForm.id ? 'Editar Consulta' : 'Nueva Consulta Médica'}
                    </h2>
                    <form onSubmit={handleAddConsultation} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</label>
                          <select
                            required
                            disabled={!!consultationForm.id}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none transition-all disabled:opacity-60"
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
                          label="Fecha" 
                          type="date"
                          required
                          value={consultationForm.fecha ? new Date(consultationForm.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                          onChange={(e: any) => setConsultationForm({...consultationForm, fecha: new Date(e.target.value).toISOString()})}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                          label="Motivo de Consulta" 
                          placeholder="Ej: Vacunación" 
                          required
                          value={consultationForm.motivo || ''}
                          onChange={(e: any) => setConsultationForm({...consultationForm, motivo: e.target.value})}
                        />
                        <Input 
                          label="Valor de la Consulta (USD)" 
                          placeholder="Ej: 50.00" 
                          type="number"
                          step="0.01"
                          value={consultationForm.valor || ''}
                          onChange={(e: any) => setConsultationForm({...consultationForm, valor: e.target.value})}
                        />
                      </div>

                      {/* Examen Físico Section */}
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <Stethoscope size={16} className="text-brand-pink" />
                          Examen Físico
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <Input label="Temperatura (°C)" value={consultationForm.temperatura || ''} onChange={(e: any) => setConsultationForm({...consultationForm, temperatura: e.target.value})} />
                          <Input label="Peso (kg)" value={consultationForm.peso || ''} onChange={(e: any) => setConsultationForm({...consultationForm, peso: e.target.value})} />
                          <Input label="Condición Corporal" value={consultationForm.condicionCorporal || ''} onChange={(e: any) => setConsultationForm({...consultationForm, condicionCorporal: e.target.value})} />
                          <Input label="Frec. Cardíaca" value={consultationForm.frecuenciaCardiaca || ''} onChange={(e: any) => setConsultationForm({...consultationForm, frecuenciaCardiaca: e.target.value})} />
                          <Input label="Frec. Respiratoria" value={consultationForm.frecuenciaRespiratoria || ''} onChange={(e: any) => setConsultationForm({...consultationForm, frecuenciaRespiratoria: e.target.value})} />
                          <Input label="Mucosas" value={consultationForm.mucosas || ''} onChange={(e: any) => setConsultationForm({...consultationForm, mucosas: e.target.value})} />
                          <Input label="T. Llenado Capilar" value={consultationForm.tiempoLlenadoCapilar || ''} onChange={(e: any) => setConsultationForm({...consultationForm, tiempoLlenadoCapilar: e.target.value})} />
                          <Input label="Ganglios" value={consultationForm.ganglios || ''} onChange={(e: any) => setConsultationForm({...consultationForm, ganglios: e.target.value})} />
                          <Input label="Reflejo Deglutorio" value={consultationForm.reflejoDeglutorio || ''} onChange={(e: any) => setConsultationForm({...consultationForm, reflejoDeglutorio: e.target.value})} />
                          <Input label="Reflejo Tusígeno" value={consultationForm.reflejoTusigeno || ''} onChange={(e: any) => setConsultationForm({...consultationForm, reflejoTusigeno: e.target.value})} />
                          <Input label="Estado Hidratación" value={consultationForm.estadoHidratacion || ''} onChange={(e: any) => setConsultationForm({...consultationForm, estadoHidratacion: e.target.value})} />
                        </div>
                      </div>

                      <TextArea 
                        label="Hallazgos" 
                        placeholder="Hallazgos durante el examen..." 
                        value={consultationForm.hallazgos || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, hallazgos: e.target.value})}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextArea 
                          label="Diagnóstico Presuntivo" 
                          placeholder="..." 
                          value={consultationForm.diagnosticoPresuntivo || ''}
                          onChange={(e: any) => setConsultationForm({...consultationForm, diagnosticoPresuntivo: e.target.value})}
                        />
                        <TextArea 
                          label="Diagnóstico Definitivo" 
                          placeholder="..." 
                          value={consultationForm.diagnosticoDefinitivo || ''}
                          onChange={(e: any) => setConsultationForm({...consultationForm, diagnosticoDefinitivo: e.target.value})}
                        />
                      </div>

                      <TextArea 
                        label="Tratamiento" 
                        placeholder="Medicamentos, dosis..." 
                        value={consultationForm.tratamiento || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, tratamiento: e.target.value})}
                      />

                      <TextArea 
                        label="Indicación y Evolución" 
                        placeholder="..." 
                        value={consultationForm.indicacionEvolucion || ''}
                        onChange={(e: any) => setConsultationForm({...consultationForm, indicacionEvolucion: e.target.value})}
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
                            className="flex-1 px-6 py-3 bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-xl font-bold hover:bg-brand-pink/20 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-brand-blue text-white py-3 rounded-xl font-bold hover:bg-brand-blue/90 transition-colors disabled:opacity-50 shadow-lg shadow-brand-blue/20"
                        >
                          {loading ? 'Guardando...' : consultationForm.id ? 'Guardar Cambios' : 'Registrar Consulta'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

              {consultationSubView === 'prescription' && (
                <div className="max-w-4xl mx-auto">
                  <Card className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <ClipboardList className="text-brand-pink" size={24} />
                        Receta Médica
                      </h2>
                      {prescriptionForm.id && (
                        <button
                          onClick={() => {
                            const patient = patients.find(p => String(p.id) === String(prescriptionForm.pacienteId));
                            const consultation = consultations.find(c => String(c.id) === String(prescriptionForm.consultationId));
                            if (patient && consultation) {
                              handlePrintPrescription(patient, consultation, prescriptionForm);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-pink text-white rounded-xl font-bold hover:bg-brand-pink/90 transition-all shadow-lg shadow-brand-pink/20"
                        >
                          <Download size={18} /> Descargar PDF
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleAddPrescription} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Paciente</p>
                          <p className="font-bold text-slate-700">
                            {patients.find(p => String(p.id) === String(prescriptionForm.pacienteId))?.nombre || 'Desconocido'}
                          </p>
                        </div>
                        <Input 
                          label="Fecha de Receta" 
                          type="date" 
                          value={prescriptionForm.fecha ? new Date(prescriptionForm.fecha).toISOString().split('T')[0] : ''} 
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, fecha: e.target.value})} 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TextArea 
                          label="Prescripción (Medicamentos y dosis)" 
                          placeholder="Ej: Meloxicam (1mg) - 2 tabletas..." 
                          value={prescriptionForm.prescripcion || ''}
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, prescripcion: e.target.value})}
                          rows={8}
                        />
                        <TextArea 
                          label="Indicaciones" 
                          placeholder="Ej: Dar 1/2 pastilla cada 24 horas..." 
                          value={prescriptionForm.indicaciones || ''}
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, indicaciones: e.target.value})}
                          rows={8}
                        />
                      </div>

                      <Input 
                        label="Próximo Control" 
                        placeholder="Ej: 6/marzo/2026" 
                        value={prescriptionForm.control || ''}
                        onChange={(e: any) => setPrescriptionForm({...prescriptionForm, control: e.target.value})}
                      />

                      <div className="flex flex-wrap gap-4 pt-6">
                        <button
                          type="button"
                          onClick={() => setConsultationSubView('list')}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-brand-pink text-white py-3 rounded-xl font-bold hover:bg-brand-pink/90 transition-colors disabled:opacity-50 shadow-lg shadow-brand-pink/20"
                        >
                          {loading ? 'Guardando...' : 'Guardar Receta'}
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
                            className="p-6 hover:border-brand-blue/30 transition-all group cursor-pointer hover:shadow-md"
                            onClick={() => {
                              setConsultationForm(consultation);
                              setConsultationSubView('form');
                            }}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-1 rounded uppercase tracking-wider">
                                    {new Date(consultation.fecha).toLocaleDateString()}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold mt-2 group-hover:text-brand-blue transition-colors">{consultation.motivo}</h3>
                                <div className="flex items-center gap-4">
                                  <p className="text-sm text-slate-500">Paciente: <span className="font-semibold text-slate-700">{patient?.nombre || 'Desconocido'}</span></p>
                                  {consultation.valor && (
                                    <p className="text-sm text-brand-blue font-bold">Valor: ${consultation.valor}</p>
                                  )}
                                </div>
                              </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const existing = prescriptions.find(pr => String(pr.consultationId) === String(consultation.id));
                                      if (existing) {
                                        setPrescriptionForm(existing);
                                      } else {
                                        setPrescriptionForm({
                                          consultationId: consultation.id,
                                          pacienteId: consultation.pacienteId,
                                          fecha: new Date().toISOString(),
                                          prescripcion: '',
                                          indicaciones: '',
                                          control: ''
                                        });
                                      }
                                      setConsultationSubView('prescription');
                                    }}
                                    className="px-3 py-1.5 bg-brand-pink/10 text-brand-pink rounded-lg text-xs font-bold hover:bg-brand-pink/20 transition-all flex items-center gap-1"
                                    title="Generar Receta"
                                  >
                                    <ClipboardList size={14} /> Receta
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('consultations', consultation.id);
                                    }}
                                  className="p-2 text-slate-300 hover:text-brand-pink hover:bg-brand-pink/10 rounded-xl transition-all"
                                  title="Eliminar Consulta"
                                >
                                  <Trash2 size={20} />
                                </button>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-all">
                                  <ChevronRight size={24} />
                                </div>
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

          {view === 'prescriptions' && (
            <motion.div
              key="prescriptions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => {
                    if (prescriptionSubView === 'menu') setView('home');
                    else setPrescriptionSubView('menu');
                  }}
                  className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" /> {prescriptionSubView === 'menu' ? 'Volver al Inicio' : 'Volver al Menú'}
                </button>
                <h2 className="text-2xl font-black">Gestión de Recetas</h2>
              </div>

              {prescriptionSubView === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                  <button
                    onClick={() => {
                      setPrescriptionForm({
                        fecha: new Date().toISOString(),
                        prescripcion: '',
                        indicaciones: '',
                        control: ''
                      });
                      setPrescriptionSubView('form');
                    }}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-brand-pink/10 text-brand-pink rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Nueva Receta</h3>
                    <p className="text-slate-500 text-sm">Elabora una receta médica desde cero.</p>
                  </button>

                  <button
                    onClick={() => setPrescriptionSubView('list')}
                    className="group bg-white p-8 rounded-3xl border-2 border-transparent hover:border-brand-pink shadow-xl shadow-slate-200/50 transition-all duration-300 text-center"
                  >
                    <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <ClipboardList size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Historial de Recetas</h3>
                    <p className="text-slate-500 text-sm">Consulta y descarga recetas emitidas anteriormente.</p>
                  </button>
                </div>
              )}

              {prescriptionSubView === 'form' && (
                <div className="max-w-4xl mx-auto">
                  <Card className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <ClipboardList className="text-brand-pink" size={24} />
                        {prescriptionForm.id ? 'Editar Receta' : 'Nueva Receta Médica'}
                      </h2>
                      {prescriptionForm.id && (
                        <button
                          onClick={() => {
                            const patient = patients.find(p => String(p.id) === String(prescriptionForm.pacienteId));
                            const consultation = consultations.find(c => String(c.id) === String(prescriptionForm.consultationId));
                            if (patient) {
                              // If no consultation is linked, we pass a dummy one or handle it in handlePrintPrescription
                              handlePrintPrescription(patient, consultation || { peso: '-' } as any, prescriptionForm);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-pink text-white rounded-xl font-bold hover:bg-brand-pink/90 transition-all shadow-lg shadow-brand-pink/20"
                        >
                          <Download size={18} /> Descargar PDF
                        </button>
                      )}
                    </div>

                    <form onSubmit={async (e) => {
                      await handleAddPrescription(e);
                      setPrescriptionSubView('list');
                    }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</label>
                          <select
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-brand-pink outline-none transition-all"
                            value={prescriptionForm.pacienteId || ''}
                            onChange={(e) => {
                              const pId = e.target.value;
                              setPrescriptionForm({ ...prescriptionForm, pacienteId: pId });
                            }}
                            required
                          >
                            <option value="">Seleccionar Paciente...</option>
                            {patients.map(p => (
                              <option key={p.id} value={p.id}>{p.nombre} ({p.propietario})</option>
                            ))}
                          </select>
                        </div>
                        <Input 
                          label="Fecha de Receta" 
                          type="date" 
                          value={prescriptionForm.fecha ? new Date(prescriptionForm.fecha).toISOString().split('T')[0] : ''} 
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, fecha: e.target.value})} 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TextArea 
                          label="Prescripción (Medicamentos y dosis)" 
                          placeholder="Ej: Meloxicam (1mg) - 2 tabletas..." 
                          value={prescriptionForm.prescripcion || ''}
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, prescripcion: e.target.value})}
                          rows={8}
                          required
                        />
                        <TextArea 
                          label="Indicaciones" 
                          placeholder="Ej: Dar 1/2 pastilla cada 24 horas..." 
                          value={prescriptionForm.indicaciones || ''}
                          onChange={(e: any) => setPrescriptionForm({...prescriptionForm, indicaciones: e.target.value})}
                          rows={8}
                          required
                        />
                      </div>

                      <Input 
                        label="Próximo Control" 
                        placeholder="Ej: 6/marzo/2026" 
                        value={prescriptionForm.control || ''}
                        onChange={(e: any) => setPrescriptionForm({...prescriptionForm, control: e.target.value})}
                      />

                      <div className="flex flex-wrap gap-4 pt-6">
                        <button
                          type="button"
                          onClick={() => setPrescriptionSubView('menu')}
                          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] bg-brand-pink text-white py-3 rounded-xl font-bold hover:bg-brand-pink/90 transition-colors disabled:opacity-50 shadow-lg shadow-brand-pink/20"
                        >
                          {loading ? 'Guardando...' : 'Guardar Receta'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

              {prescriptionSubView === 'list' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 gap-4">
                    {loading && prescriptions.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">Cargando recetas...</div>
                    ) : prescriptions.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        No hay recetas registradas.
                      </div>
                    ) : (
                      prescriptions.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map((pr) => {
                        const patient = patients.find(p => String(p.id) === String(pr.pacienteId));
                        return (
                          <Card 
                            key={pr.id} 
                            className="p-6 hover:border-brand-pink/30 transition-all group cursor-pointer hover:shadow-md"
                            onClick={() => {
                              setPrescriptionForm(pr);
                              setPrescriptionSubView('form');
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-brand-pink/10 text-brand-pink rounded-xl flex items-center justify-center font-bold text-lg">
                                  {patient?.nombre?.[0] || '?'}
                                </div>
                                <div>
                                  <h3 className="font-bold text-lg group-hover:text-brand-pink transition-colors">
                                    Receta para {patient?.nombre || 'Desconocido'}
                                  </h3>
                                  <p className="text-sm text-slate-500">
                                    {new Date(pr.fecha).toLocaleDateString()} • Propietario: {patient?.propietario || '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const consultation = consultations.find(c => String(c.id) === String(pr.consultationId));
                                    if (patient) {
                                      handlePrintPrescription(patient, consultation || { peso: '-' } as any, pr);
                                    }
                                  }}
                                  className="p-2 text-brand-pink hover:bg-brand-pink/10 rounded-lg transition-colors"
                                  title="Descargar PDF"
                                >
                                  <Download size={20} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete('prescriptions' as any, pr.id);
                                  }}
                                  className="p-2 text-slate-300 hover:text-brand-pink hover:bg-brand-pink/10 rounded-xl transition-all"
                                  title="Eliminar Receta"
                                >
                                  <Trash2 size={20} />
                                </button>
                                <ChevronRight className="text-slate-300 group-hover:text-brand-pink transition-colors" size={20} />
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50">
                              <p className="text-sm text-slate-600 line-clamp-2 italic">
                                {pr.prescripcion}
                              </p>
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
                <div className="w-16 h-16 bg-brand-pink/10 text-brand-pink rounded-2xl flex items-center justify-center mx-auto">
                  <Info size={32} />
                </div>
                <h2 className="text-2xl font-bold">Configuración de Google Sheets</h2>
                <p className="text-slate-500">Para que la aplicación funcione, debes configurar los scripts en tus documentos de Google Sheets.</p>
              </div>

              <Card className="p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-brand-pink text-white rounded-full flex items-center justify-center text-xs">1</span>
                    Preparar las Hojas
                  </h3>
                  <p className="text-sm text-slate-600">Asegúrate de que tus hojas tengan los siguientes encabezados en la primera fila:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Pacientes</p>
                      <code className="text-xs text-brand-pink break-all">id, nombre, edad, especie, raza, color, sexo, esterilizado, propietario, cedula, telefono, direccion, email, notas</code>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Consultas</p>
                      <code className="text-xs text-brand-pink break-all">id, pacienteId, fecha, motivo, temperatura, peso, condicionCorporal, frecuenciaCardiaca, frecuenciaRespiratoria, mucosas, tiempoLlenadoCapilar, ganglios, reflejoDeglutorio, reflejoTusigeno, estadoHidratacion, hallazgos, diagnosticoPresuntivo, diagnosticoDefinitivo, tratamiento, indicacionEvolucion, valor, notas</code>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Recetas</p>
                      <code className="text-xs text-brand-pink break-all">id, consultationId, pacienteId, fecha, prescripcion, indicaciones, control</code>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hoja de Usuarios (Auth)</p>
                      <code className="text-xs text-brand-pink break-all">id, username, password, role</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-brand-pink text-white rounded-full flex items-center justify-center text-xs">2</span>
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
                    <span className="w-6 h-6 bg-brand-pink text-white rounded-full flex items-center justify-center text-xs">3</span>
                    Implementar como Web App
                  </h3>
                  <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
                    <li>Haz clic en <strong>Implementar {'>'} Nueva implementación</strong>.</li>
                    <li>Selecciona el tipo <strong>Aplicación web</strong>.</li>
                    <li>En "Quién tiene acceso", selecciona <strong>Cualquier persona</strong> (esto es CRUCIAL).</li>
                    <li>Haz clic en <strong>Implementar</strong>.</li>
                    <li>Copia la URL generada y pégala en la sección de abajo.</li>
                    <li><strong>IMPORTANTE (CRUCIAL):</strong> Cada vez que copies y pegues el código nuevo, debes hacer clic en <strong>Implementar {'>'} Gestionar implementaciones</strong>, editar la implementación actual (icono lápiz), seleccionar <strong>"Nueva versión"</strong> en el desplegable de Versión y hacer clic en <strong>Implementar</strong>. De lo contrario, Google seguirá usando el código viejo.</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-6 h-6 bg-brand-pink text-white rounded-full flex items-center justify-center text-xs">4</span>
                    Configurar URLs de la App Web
                  </h3>
                  <p className="text-sm text-slate-600">Pega aquí las URLs de implementación que copiaste en el paso anterior:</p>
                  <div className="space-y-4">
                    <Input 
                      label="URL Web App Pacientes" 
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={config.patientsUrl}
                      onChange={(e: any) => setConfig({ ...config, patientsUrl: e.target.value })}
                    />
                    <Input 
                      label="URL Web App Consultas" 
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={config.consultationsUrl}
                      onChange={(e: any) => setConfig({ ...config, consultationsUrl: e.target.value })}
                    />
                    <Input 
                      label="URL Web App Recetas" 
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={config.prescriptionsUrl}
                      onChange={(e: any) => setConfig({ ...config, prescriptionsUrl: e.target.value })}
                    />
                    <Input 
                      label="URL Web App Usuarios (Auth)" 
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={config.authUrl}
                      onChange={(e: any) => setConfig({ ...config, authUrl: e.target.value })}
                    />
                    <button
                      onClick={handleSaveConfig}
                      disabled={loading}
                      className="w-full py-3 bg-brand-pink text-white rounded-xl font-bold hover:bg-brand-pink/90 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Guardando...' : 'Guardar Configuración de URLs'}
                    </button>
                  </div>
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
                    <a 
                      href="https://docs.google.com/spreadsheets/d/1aAaCAt90CbskXu_03uAePja2BjP8FYJJMpwtEat1esM/edit" 
                      target="_blank" 
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                      Abrir Hoja Usuarios <ExternalLink size={16} />
                    </a>
                  </div>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await apiFetch('/api/config');
                        const data = await safeJson(res);
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



