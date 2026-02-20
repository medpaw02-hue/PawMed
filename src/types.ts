export interface Patient {
  id: string;
  nombre: string;
  especie: string;
  raza: string;
  edad: string;
  propietario: string;
  telefono: string;
  email: string;
}

export interface Consultation {
  id: string;
  pacienteId: string;
  fecha: string;
  motivo: string;
  diagnostico: string;
  tratamiento: string;
  valor: string;
  notas: string;
}
