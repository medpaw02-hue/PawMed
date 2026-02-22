export interface Patient {
  id: string;
  // Datos del Paciente
  nombre: string;
  edad: string;
  especie: string;
  raza: string;
  color?: string;
  sexo?: string;
  esterilizado?: string;
  // Datos del Propietario
  propietario: string;
  cedula?: string;
  telefono: string;
  direccion?: string;
  email: string;
  // Otros
  notas?: string;
}

export interface Consultation {
  id: string;
  pacienteId: string;
  fecha: string;
  motivo: string;
  // Examen Físico
  temperatura?: string;
  peso?: string;
  condicionCorporal?: string;
  frecuenciaCardiaca?: string;
  frecuenciaRespiratoria?: string;
  mucosas?: string;
  tiempoLlenadoCapilar?: string;
  ganglios?: string;
  reflejoDeglutorio?: string;
  reflejoTusigeno?: string;
  estadoHidratacion?: string;
  // Otros campos
  hallazgos?: string;
  diagnosticoPresuntivo?: string;
  diagnosticoDefinitivo?: string;
  tratamiento: string;
  indicacionEvolucion?: string;
  valor: string;
  notas: string;
}

