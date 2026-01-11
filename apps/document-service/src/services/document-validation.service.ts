import { 
  Document, 
  ValidationResults, 
  ValidationError, 
  ValidationWarning, 
  ValidationRule, 
  ExtractedField, 
  OCRData,
  DocumentMetadata 
} from '../models/document.model';
import { INTEGRATION_CONSTANTS, DOCUMENT_CONSTANTS } from '@ltet/shared-constants';

export class DocumentValidationService {

  /**
   * Validate document against application data and business rules
   */
  async validateDocument(
    document: Document, 
    applicationData: any, 
    validationRules: ValidationRule[] = []
  ): Promise<ValidationResults> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      // Basic document validation
      this.validateBasicDocument(document, errors, warnings);
      
      // OCR data validation
      if (document.ocrData) {
        await this.validateOCRData(document.ocrData, applicationData, validationRules, errors, warnings);
      }
      
      // Document-specific validation
      this.validateDocumentSpecific(document, applicationData, errors, warnings);
      
      // Generate metadata
      const metadata = this.generateDocumentMetadata(document);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata
      };
      
    } catch (error) {
      console.error('Document validation error:', error);
      errors.push({
        field: 'general',
        message: 'Validation process failed',
        code: 'VALIDATION_ERROR'
      });
      
      return {
        isValid: false,
        errors,
        warnings,
        metadata: this.generateDocumentMetadata(document)
      };
    }
  }

  /**
   * Validate basic document properties
   */
  private validateBasicDocument(
    document: Document, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check file size (5MB limit as per requirements)
    if (document.fileSize > DOCUMENT_CONSTANTS.MAX_FILE_SIZE) {
      errors.push({
        field: 'fileSize',
        message: `File size exceeds ${DOCUMENT_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        code: 'FILE_SIZE_EXCEEDED'
      });
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(document.mimeType)) {
      errors.push({
        field: 'mimeType',
        message: 'Invalid file type. Only PDF, JPG, and PNG files are allowed',
        code: 'INVALID_FILE_TYPE'
      });
    }
    
    // Check confidence score
    if (document.confidenceScore !== undefined && document.confidenceScore < INTEGRATION_CONSTANTS.OCR.CONFIDENCE_THRESHOLD) {
      warnings.push({
        field: 'confidenceScore',
        message: `Document quality is low (confidence: ${(document.confidenceScore * 100).toFixed(1)}%)`,
        code: 'LOW_CONFIDENCE'
      });
    }
  }

  /**
   * Validate OCR extracted data against application data
   */
  private async validateOCRData(
    ocrData: OCRData,
    applicationData: any,
    validationRules: ValidationRule[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Validate extracted fields against application data
    for (const field of ocrData.extractedFields) {
      await this.validateExtractedField(field, applicationData, errors, warnings);
    }
    
    // Apply custom validation rules
    for (const rule of validationRules) {
      this.applyValidationRule(rule, ocrData.extractedFields, errors, warnings);
    }
    
    // Check overall OCR confidence
    if (ocrData.confidence < INTEGRATION_CONSTANTS.OCR.CONFIDENCE_THRESHOLD) {
      warnings.push({
        field: 'ocrConfidence',
        message: `OCR confidence is below threshold (${(ocrData.confidence * 100).toFixed(1)}%)`,
        code: 'LOW_OCR_CONFIDENCE'
      });
    }
  }

  /**
   * Validate individual extracted field
   */
  private async validateExtractedField(
    field: ExtractedField,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check field confidence
    if (field.confidence < INTEGRATION_CONSTANTS.OCR.CONFIDENCE_THRESHOLD) {
      warnings.push({
        field: field.fieldName,
        message: `Low confidence for field ${field.fieldName} (${(field.confidence * 100).toFixed(1)}%)`,
        code: 'LOW_FIELD_CONFIDENCE'
      });
    }
    
    // Validate against application data
    const applicationValue = this.getApplicationValue(field.fieldName, applicationData);
    if (applicationValue) {
      const isMatch = await this.compareValues(field.value, applicationValue, field.dataType);
      if (!isMatch) {
        errors.push({
          field: field.fieldName,
          message: `Document value "${field.value}" does not match application data "${applicationValue}"`,
          code: 'DATA_MISMATCH'
        });
      }
    }
    
    // Validate data format
    this.validateFieldFormat(field, errors, warnings);
  }

  /**
   * Apply custom validation rule
   */
  private applyValidationRule(
    rule: ValidationRule,
    extractedFields: ExtractedField[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const field = extractedFields.find(f => f.fieldName === rule.fieldName);
    
    if (rule.required && !field) {
      errors.push({
        field: rule.fieldName,
        message: `Required field ${rule.fieldName} not found in document`,
        code: 'REQUIRED_FIELD_MISSING'
      });
      return;
    }
    
    if (!field) return;
    
    // Validate expected value
    if (rule.expectedValue && field.value !== rule.expectedValue) {
      errors.push({
        field: rule.fieldName,
        message: `Expected "${rule.expectedValue}" but found "${field.value}"`,
        code: 'EXPECTED_VALUE_MISMATCH'
      });
    }
    
    // Validate pattern
    if (rule.expectedPattern) {
      const pattern = new RegExp(rule.expectedPattern);
      if (!pattern.test(field.value)) {
        errors.push({
          field: rule.fieldName,
          message: `Value "${field.value}" does not match expected pattern`,
          code: 'PATTERN_MISMATCH'
        });
      }
    }
    
    // Validate data type
    if (rule.dataType !== field.dataType) {
      warnings.push({
        field: rule.fieldName,
        message: `Expected data type ${rule.dataType} but detected ${field.dataType}`,
        code: 'DATA_TYPE_MISMATCH'
      });
    }
  }

  /**
   * Validate field format based on data type
   */
  private validateFieldFormat(
    field: ExtractedField,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    switch (field.dataType) {
      case 'currency':
        if (!this.isValidCurrency(field.value)) {
          errors.push({
            field: field.fieldName,
            message: `Invalid currency format: ${field.value}`,
            code: 'INVALID_CURRENCY_FORMAT'
          });
        }
        break;
        
      case 'percentage':
        if (!this.isValidPercentage(field.value)) {
          errors.push({
            field: field.fieldName,
            message: `Invalid percentage format: ${field.value}`,
            code: 'INVALID_PERCENTAGE_FORMAT'
          });
        }
        break;
        
      case 'date':
        if (!this.isValidDate(field.value)) {
          errors.push({
            field: field.fieldName,
            message: `Invalid date format: ${field.value}`,
            code: 'INVALID_DATE_FORMAT'
          });
        }
        break;
        
      case 'number':
        if (!this.isValidNumber(field.value)) {
          errors.push({
            field: field.fieldName,
            message: `Invalid number format: ${field.value}`,
            code: 'INVALID_NUMBER_FORMAT'
          });
        }
        break;
    }
  }

  /**
   * Document-specific validation based on document type
   */
  private validateDocumentSpecific(
    document: Document,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    switch (document.documentType.toLowerCase()) {
      case 'income_certificate':
      case 'salary_slip':
        this.validateIncomeDocument(document, applicationData, errors, warnings);
        break;
        
      case 'medical_bill':
      case 'medical_report':
        this.validateMedicalDocument(document, applicationData, errors, warnings);
        break;
        
      case 'education_certificate':
      case 'marksheet':
        this.validateEducationDocument(document, applicationData, errors, warnings);
        break;
        
      case 'bank_statement':
        this.validateBankDocument(document, applicationData, errors, warnings);
        break;
    }
  }

  /**
   * Validate income-related documents
   */
  private validateIncomeDocument(
    document: Document,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!document.ocrData) return;
    
    const salaryField = document.ocrData.extractedFields.find(f => f.fieldName.includes('salary') || f.fieldName.includes('amount'));
    const empIdField = document.ocrData.extractedFields.find(f => f.fieldName.includes('employee_id'));
    
    // Validate salary amount
    if (salaryField && applicationData.claimAmount) {
      const extractedAmount = parseFloat(salaryField.value.replace(/,/g, ''));
      const claimAmount = parseFloat(applicationData.claimAmount);
      
      if (claimAmount > extractedAmount) {
        errors.push({
          field: 'salary_amount',
          message: `Claim amount (${claimAmount}) exceeds documented salary (${extractedAmount})`,
          code: 'CLAIM_EXCEEDS_SALARY'
        });
      }
    }
    
    // Validate employee ID
    if (empIdField && applicationData.employeeId) {
      if (empIdField.value !== applicationData.employeeId) {
        errors.push({
          field: 'employee_id',
          message: `Employee ID mismatch: document shows ${empIdField.value}, application shows ${applicationData.employeeId}`,
          code: 'EMPLOYEE_ID_MISMATCH'
        });
      }
    }
  }

  /**
   * Validate medical documents
   */
  private validateMedicalDocument(
    document: Document,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!document.ocrData) return;
    
    const billAmountField = document.ocrData.extractedFields.find(f => f.fieldName.includes('bill_amount') || f.fieldName.includes('amount'));
    const patientNameField = document.ocrData.extractedFields.find(f => f.fieldName.includes('patient_name') || f.fieldName.includes('name'));
    
    // Validate bill amount
    if (billAmountField && applicationData.claimAmount) {
      const extractedAmount = parseFloat(billAmountField.value.replace(/,/g, ''));
      const claimAmount = parseFloat(applicationData.claimAmount);
      
      if (Math.abs(claimAmount - extractedAmount) > extractedAmount * 0.05) { // 5% tolerance
        warnings.push({
          field: 'bill_amount',
          message: `Claim amount (${claimAmount}) differs from bill amount (${extractedAmount})`,
          code: 'AMOUNT_DISCREPANCY'
        });
      }
    }
    
    // Validate patient name
    if (patientNameField && applicationData.beneficiaryName) {
      const similarity = this.calculateStringSimilarity(patientNameField.value, applicationData.beneficiaryName);
      if (similarity < 0.8) {
        warnings.push({
          field: 'patient_name',
          message: `Patient name "${patientNameField.value}" may not match beneficiary "${applicationData.beneficiaryName}"`,
          code: 'NAME_SIMILARITY_LOW'
        });
      }
    }
  }

  /**
   * Validate education documents
   */
  private validateEducationDocument(
    document: Document,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!document.ocrData) return;
    
    const gradeField = document.ocrData.extractedFields.find(f => f.fieldName.includes('grade') || f.fieldName.includes('percentage'));
    const studentNameField = document.ocrData.extractedFields.find(f => f.fieldName.includes('student_name') || f.fieldName.includes('name'));
    
    // Validate minimum grade requirement
    if (gradeField && applicationData.minimumGrade) {
      const extractedGrade = parseFloat(gradeField.value);
      const minimumGrade = parseFloat(applicationData.minimumGrade);
      
      if (extractedGrade < minimumGrade) {
        errors.push({
          field: 'grade_percentage',
          message: `Grade ${extractedGrade}% is below minimum requirement of ${minimumGrade}%`,
          code: 'GRADE_BELOW_MINIMUM'
        });
      }
    }
    
    // Validate student name
    if (studentNameField && applicationData.studentName) {
      const similarity = this.calculateStringSimilarity(studentNameField.value, applicationData.studentName);
      if (similarity < 0.8) {
        warnings.push({
          field: 'student_name',
          message: `Student name "${studentNameField.value}" may not match application "${applicationData.studentName}"`,
          code: 'NAME_SIMILARITY_LOW'
        });
      }
    }
  }

  /**
   * Validate bank documents
   */
  private validateBankDocument(
    document: Document,
    applicationData: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!document.ocrData) return;
    
    const accountField = document.ocrData.extractedFields.find(f => f.fieldName.includes('account_number'));
    const ifscField = document.ocrData.extractedFields.find(f => f.fieldName.includes('ifsc_code'));
    
    // Validate account number
    if (accountField && applicationData.bankAccount) {
      if (accountField.value !== applicationData.bankAccount) {
        errors.push({
          field: 'account_number',
          message: `Account number mismatch: document shows ${accountField.value}, application shows ${applicationData.bankAccount}`,
          code: 'ACCOUNT_NUMBER_MISMATCH'
        });
      }
    }
    
    // Validate IFSC code
    if (ifscField && applicationData.ifscCode) {
      if (ifscField.value !== applicationData.ifscCode) {
        errors.push({
          field: 'ifsc_code',
          message: `IFSC code mismatch: document shows ${ifscField.value}, application shows ${applicationData.ifscCode}`,
          code: 'IFSC_CODE_MISMATCH'
        });
      }
    }
  }

  /**
   * Get application value for a field
   */
  private getApplicationValue(fieldName: string, applicationData: any): string | null {
    const fieldMappings: { [key: string]: string } = {
      'employee_id': 'employeeId',
      'salary_amount': 'salary',
      'bill_amount': 'claimAmount',
      'patient_name': 'beneficiaryName',
      'student_name': 'studentName',
      'grade_percentage': 'grade',
      'account_number': 'bankAccount',
      'ifsc_code': 'ifscCode'
    };
    
    const applicationField = fieldMappings[fieldName];
    return applicationField ? applicationData[applicationField] : null;
  }

  /**
   * Compare values based on data type
   */
  private async compareValues(documentValue: string, applicationValue: string, dataType: string): Promise<boolean> {
    switch (dataType) {
      case 'currency':
      case 'number':
        const docNum = parseFloat(documentValue.replace(/,/g, ''));
        const appNum = parseFloat(applicationValue.replace(/,/g, ''));
        return Math.abs(docNum - appNum) < 0.01; // Allow small floating point differences
        
      case 'percentage':
        const docPct = parseFloat(documentValue.replace(/%/g, ''));
        const appPct = parseFloat(applicationValue.replace(/%/g, ''));
        return Math.abs(docPct - appPct) < 0.1;
        
      case 'date':
        return this.compareDates(documentValue, applicationValue);
        
      default:
        return this.calculateStringSimilarity(documentValue, applicationValue) > 0.9;
    }
  }

  /**
   * Generate document metadata
   */
  private generateDocumentMetadata(document: Document): DocumentMetadata {
    const metadata: DocumentMetadata = {
      isReadable: document.ocrData ? document.ocrData.extractedText.length > 0 : false,
      hasText: document.ocrData ? document.ocrData.extractedText.trim().length > 0 : false
    };
    
    // Determine quality based on confidence score
    if (document.confidenceScore !== undefined) {
      if (document.confidenceScore > 0.9) {
        metadata.quality = 'high';
      } else if (document.confidenceScore > 0.7) {
        metadata.quality = 'medium';
      } else {
        metadata.quality = 'low';
      }
    }
    
    return metadata;
  }

  /**
   * Validation helper methods
   */
  private isValidCurrency(value: string): boolean {
    return /^\d+(\.\d{2})?$/.test(value.replace(/,/g, ''));
  }

  private isValidPercentage(value: string): boolean {
    const num = parseFloat(value.replace(/%/g, ''));
    return !isNaN(num) && num >= 0 && num <= 100;
  }

  private isValidDate(value: string): boolean {
    return !isNaN(Date.parse(value));
  }

  private isValidNumber(value: string): boolean {
    return !isNaN(parseFloat(value.replace(/,/g, '')));
  }

  private compareDates(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs(d1.getTime() - d2.getTime()) < 24 * 60 * 60 * 1000; // 1 day tolerance
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export const documentValidationService = new DocumentValidationService();