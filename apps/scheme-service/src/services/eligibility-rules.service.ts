import { User, Scheme } from '@ltet/shared-types';
import { EligibilityRule, RuleBuilder } from '../models/scheme.model';

export class EligibilityRulesService {
  /**
   * Evaluates if a user is eligible for a scheme based on eligibility rules
   */
  async evaluateEligibility(user: User, scheme: Scheme): Promise<boolean> {
    const rules = scheme.eligibilityRules;

    // Check service years
    if (rules.serviceYears !== undefined) {
      const serviceYears = this.calculateServiceYears(user.employmentInfo.joiningDate);
      if (serviceYears < rules.serviceYears) {
        return false;
      }
    }

    // Check salary range (if available in user data)
    if (rules.salaryRange && (user.employmentInfo as any).salary) {
      const salary = (user.employmentInfo as any).salary;
      if (salary < rules.salaryRange.min || salary > rules.salaryRange.max) {
        return false;
      }
    }

    // Check IC restrictions
    if (rules.icRestrictions && rules.icRestrictions.length > 0) {
      if (!rules.icRestrictions.includes(user.employmentInfo.ic)) {
        return false;
      }
    }

    // Check dependent age (for schemes that require dependents)
    if (rules.dependentAge !== undefined) {
      const hasEligibleDependent = user.dependents.some(dependent => {
        const age = this.calculateAge(dependent.dateOfBirth);
        return age <= rules.dependentAge!;
      });

      if (!hasEligibleDependent) {
        return false;
      }
    }

    return true;
  }

  /**
   * Creates a visual rule builder configuration
   */
  createRuleBuilder(existingRules?: any): RuleBuilder {
    const rules: EligibilityRule[] = [];

    if (existingRules) {
      if (existingRules.serviceYears !== undefined) {
        rules.push({
          id: 'service_years',
          type: 'service_years',
          operator: 'greater_than',
          value: existingRules.serviceYears,
          description: `Service years must be greater than ${existingRules.serviceYears}`
        });
      }

      if (existingRules.salaryRange) {
        rules.push({
          id: 'salary_range',
          type: 'salary_range',
          operator: 'between',
          value: [existingRules.salaryRange.min, existingRules.salaryRange.max],
          description: `Salary must be between ${existingRules.salaryRange.min} and ${existingRules.salaryRange.max}`
        });
      }

      if (existingRules.icRestrictions && existingRules.icRestrictions.length > 0) {
        rules.push({
          id: 'ic_restrictions',
          type: 'ic_restriction',
          operator: 'in',
          value: existingRules.icRestrictions,
          description: `IC must be one of: ${existingRules.icRestrictions.join(', ')}`
        });
      }

      if (existingRules.dependentAge !== undefined) {
        rules.push({
          id: 'dependent_age',
          type: 'dependent_age',
          operator: 'less_than',
          value: existingRules.dependentAge,
          description: `Must have at least one dependent under ${existingRules.dependentAge} years`
        });
      }
    }

    return {
      rules,
      logic: 'AND'
    };
  }

  /**
   * Converts rule builder configuration back to eligibility rules
   */
  buildEligibilityRules(ruleBuilder: RuleBuilder): any {
    const eligibilityRules: any = {};

    ruleBuilder.rules.forEach(rule => {
      switch (rule.type) {
        case 'service_years':
          eligibilityRules.serviceYears = rule.value;
          break;
        case 'salary_range':
          eligibilityRules.salaryRange = {
            min: rule.value[0],
            max: rule.value[1]
          };
          break;
        case 'ic_restriction':
          eligibilityRules.icRestrictions = rule.value;
          break;
        case 'dependent_age':
          eligibilityRules.dependentAge = rule.value;
          break;
      }
    });

    return eligibilityRules;
  }

  /**
   * Validates rule builder configuration
   */
  validateRuleBuilder(ruleBuilder: RuleBuilder): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    ruleBuilder.rules.forEach(rule => {
      switch (rule.type) {
        case 'service_years':
          if (typeof rule.value !== 'number' || rule.value < 0) {
            errors.push('Service years must be a positive number');
          }
          break;
        case 'salary_range':
          if (!Array.isArray(rule.value) || rule.value.length !== 2 || 
              rule.value[0] >= rule.value[1]) {
            errors.push('Salary range must have valid min and max values');
          }
          break;
        case 'ic_restriction':
          if (!Array.isArray(rule.value) || rule.value.length === 0) {
            errors.push('IC restrictions must be a non-empty array');
          }
          break;
        case 'dependent_age':
          if (typeof rule.value !== 'number' || rule.value < 0 || rule.value > 100) {
            errors.push('Dependent age must be between 0 and 100');
          }
          break;
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets available rule types for the visual builder
   */
  getAvailableRuleTypes(): Array<{
    type: string;
    label: string;
    description: string;
    operators: string[];
    valueType: 'number' | 'string' | 'array' | 'range';
  }> {
    return [
      {
        type: 'service_years',
        label: 'Service Years',
        description: 'Minimum years of service required',
        operators: ['greater_than', 'equals'],
        valueType: 'number'
      },
      {
        type: 'salary_range',
        label: 'Salary Range',
        description: 'Salary must be within specified range',
        operators: ['between'],
        valueType: 'range'
      },
      {
        type: 'ic_restriction',
        label: 'IC Restriction',
        description: 'Restrict to specific Independent Companies',
        operators: ['in', 'not_in'],
        valueType: 'array'
      },
      {
        type: 'dependent_age',
        label: 'Dependent Age',
        description: 'Maximum age of dependents',
        operators: ['less_than', 'equals'],
        valueType: 'number'
      }
    ];
  }

  private calculateServiceYears(joiningDate: Date): number {
    const now = new Date();
    const joining = new Date(joiningDate);
    const diffTime = Math.abs(now.getTime() - joining.getTime());
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    return diffYears;
  }

  private calculateAge(birthDate: Date): number {
    const now = new Date();
    const birth = new Date(birthDate);
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    const age = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    return age;
  }
}