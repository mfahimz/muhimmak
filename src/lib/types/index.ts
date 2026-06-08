export type UserRole = 'customer' | 'staff' | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  createdAt: string;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'rating' // Star rating (1-5)
  | 'emoji'; // Emoji feedback (e.g. Sad, Neutral, Happy)

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: FormFieldOption[]; // For select, radio, checkbox
  minRating?: number; // For rating (default 1)
  maxRating?: number; // For rating (default 5)
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  isPublished: boolean;
  createdBy: string; // User ID
  createdAt: string;
  updatedAt: string;
  templateId?: string; // Optional reference to the template it was created from
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, any>; // maps fieldId -> value(s)
  metadata?: {
    device?: string;
    userAgent?: string;
    submittedAt: string;
  };
  createdAt: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: FormField[];
}

export interface DashboardStats {
  totalForms: number;
  totalResponses: number;
  activeForms: number;
  averageRating?: number;
}
