import { Scheme, DocumentRequirement } from '@ltet/shared-types';

export interface SchemeEntity extends Omit<Scheme, 'schemeId' | 'createdAt' | 'updatedAt'> {
  scheme_id: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSchemeRequest {
  name: string;
  category: 'medical' | 'education' | 'skill_building';
  description: string;
  eligibilityRules: {
    serviceYears?: number;
    salaryRange?: {
      min: number;
      max: number;
    };
    dependentAge?: number;
    icRestrictions?: string[];
  };
  documentRequirements: DocumentRequirement[];
  approvalWorkflow: {
    levels: string[];
    slaHours: number;
    escalationRules: Record<string, any>;
  };
  budgetInfo: {
    maxAmount: number;
    fiscalYear: string;
    utilizationLimit: number;
  };
  validFrom: Date;
  validTo: Date;
}

export interface UpdateSchemeRequest extends Partial<CreateSchemeRequest> {
  status?: 'active' | 'inactive' | 'draft';
}

export interface SchemeFilter {
  category?: 'medical' | 'education' | 'skill_building';
  status?: 'active' | 'inactive' | 'draft';
  validDate?: Date;
  icRestrictions?: string[];
  search?: string;
}

export interface EligibilityRule {
  id: string;
  type: 'service_years' | 'salary_range' | 'dependent_age' | 'ic_restriction' | 'custom';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  description: string;
}

export interface RuleBuilder {
  rules: EligibilityRule[];
  logic: 'AND' | 'OR';
}

export interface SchemeVersion {
  versionId: string;
  schemeId: string;
  version: number;
  changes: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}