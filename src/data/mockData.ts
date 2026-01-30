// Mock data for ETDA School System

export interface Student {
  id: string;
  name: string;
  email: string;
  cpf: string;
  birthDate: string;
  classId: string;
  className?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subjectId: string;
  subjectName?: string;
}

export interface Subject {
  id: string;
  name: string;
  workload: number;
}

export interface Class {
  id: string;
  name: string;
  academicYear: string;
}

export interface Bimester {
  id: string;
  name: string;
  subjectId: string;
  subjectName?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  bimesterId: string;
  grade1: number;
  grade2: number;
  absences: number;
  average: number;
  status: 'approved' | 'recovery' | 'failed';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'secretary' | 'teacher' | 'student';
  avatar?: string;
}

// Helper function to calculate status
export const calculateStatus = (average: number): 'approved' | 'recovery' | 'failed' => {
  const normalized = Number.isFinite(average) ? average : 0;
  const total = Math.round(normalized * 10) / 10;

  if (total >= 5) return 'approved';
  if (total >= 3) return 'recovery';
  return 'failed';
};

// Helper function to calculate average
export const calculateAverage = (grade1: number, grade2: number): number => {
  return (grade1 + grade2) / 2;
};
