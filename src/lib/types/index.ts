export type UserRole = 'customer' | 'staff' | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  createdAt: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  fields: any[];
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
  fields: any[];
}

export interface DashboardStats {
  totalForms: number;
  totalResponses: number;
  activeForms: number;
  averageRating?: number;
}
