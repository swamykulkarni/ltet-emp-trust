import * as AWS from 'aws-sdk';
import { environment } from '../environments/environment';
import { OCRData, ExtractedField, OCRProcessingResult, BoundingBox } from '../models/document.model';
import { INTEGRATION_CONSTANTS } from '@ltet/shared-constants';

export class OCRService {
  private textract: AWS.Textract;

  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: environment.aws.region,
      accessKeyId: environment.aws.accessKeyId,
      secretAccessKey: environment.aws.secretAccessKey,
    });

    this.textract = new AWS.Textract();
  }

  /**
   * Process document using OCR to extract text and key-value pairs
   */
  async processDocument(filePath: string, documentType: string): Promise<OCRProcessingResult> {
    try {
      console.log(`Starting OCR processing for document: ${filePath}`);
      
      const startTime = Date.now();
      
      // Read file from S3 or local storage
      const documentBytes = await this.getDocumentBytes(filePath);
      
      // Process with AWS Textract
      const result = await this.extractTextAndFields(documentBytes, documentType);
      
      const processingTime = Date.now() - startTime;
      console.log(`OCR processing completed in ${processingTime}ms`);
      
      return {
        success: true,
        ocrData: result,
        confidenceScore: result.confidence
      };
      
    } catch (error) {
      console.error('OCR processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error',
        confidenceScore: 0
      };
    }
  }

  /**
   * Extract text and key-value pairs using AWS Textract
   */
  private async extractTextAndFields(documentBytes: Buffer, documentType: string): Promise<OCRData> {
    const params: AWS.Textract.AnalyzeDocumentRequest = {
      Document: {
        Bytes: documentBytes
      },
      FeatureTypes: ['FORMS', 'TABLES']
    };

    const response = await this.textract.analyzeDocument(params).promise();
    
    if (!response.Blocks) {
      throw new Error('No blocks found in OCR response');
    }

    // Extract text content
    const extractedText = this.extractFullText(response.Blocks);
    
    // Extract key-value pairs
    const extractedFields = this.extractKeyValuePairs(response.Blocks, documentType);
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(response.Blocks);

    return {
      extractedText,
      extractedFields,
      confidence,
      processedAt: new Date(),
      provider: 'aws-textract',
      rawResponse: response
    };
  }

  /**
   * Extract full text from OCR blocks
   */
  private extractFullText(blocks: AWS.Textract.Block[]): string {
    const textBlocks = blocks.filter(block => block.BlockType === 'LINE');
    return textBlocks
      .map(block => block.Text || '')
      .join('\n');
  }

  /**
   * Extract key-value pairs from OCR blocks
   */
  private extractKeyValuePairs(blocks: AWS.Textract.Block[], documentType: string): ExtractedField[] {
    const keyValuePairs: ExtractedField[] = [];
    const keyBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY'));
    
    for (const keyBlock of keyBlocks) {
      if (!keyBlock.Relationships) continue;
      
      // Find the value block
      const valueRelationship = keyBlock.Relationships.find(rel => rel.Type === 'VALUE');
      if (!valueRelationship?.Ids) continue;
      
      const valueBlock = blocks.find(block => valueRelationship.Ids?.includes(block.Id || ''));
      if (!valueBlock) continue;
      
      // Extract key text
      const keyText = this.extractTextFromBlock(keyBlock, blocks);
      const valueText = this.extractTextFromBlock(valueBlock, blocks);
      
      if (keyText && valueText) {
        const field = this.createExtractedField(keyText, valueText, keyBlock, documentType);
        if (field) {
          keyValuePairs.push(field);
        }
      }
    }
    
    // Add document-specific field extraction
    const documentSpecificFields = this.extractDocumentSpecificFields(blocks, documentType);
    keyValuePairs.push(...documentSpecificFields);
    
    return keyValuePairs;
  }

  /**
   * Extract text from a specific block and its children
   */
  private extractTextFromBlock(block: AWS.Textract.Block, allBlocks: AWS.Textract.Block[]): string {
    if (block.Text) {
      return block.Text;
    }
    
    if (!block.Relationships) {
      return '';
    }
    
    const childRelationship = block.Relationships.find(rel => rel.Type === 'CHILD');
    if (!childRelationship?.Ids) {
      return '';
    }
    
    const childTexts = childRelationship.Ids
      .map(id => allBlocks.find(b => b.Id === id))
      .filter(b => b && b.Text)
      .map(b => b!.Text!);
    
    return childTexts.join(' ');
  }

  /**
   * Create an extracted field with proper data type detection
   */
  private createExtractedField(
    keyText: string, 
    valueText: string, 
    block: AWS.Textract.Block,
    documentType: string
  ): ExtractedField | null {
    const fieldName = this.normalizeFieldName(keyText);
    const dataType = this.detectDataType(valueText, fieldName);
    const confidence = block.Confidence || 0;
    
    // Skip fields with very low confidence
    if (confidence < INTEGRATION_CONSTANTS.OCR.CONFIDENCE_THRESHOLD * 100) {
      return null;
    }
    
    const boundingBox = this.extractBoundingBox(block);
    
    return {
      fieldName,
      value: valueText.trim(),
      confidence: confidence / 100, // Convert to 0-1 scale
      boundingBox,
      dataType
    };
  }

  /**
   * Extract document-specific fields based on document type
   */
  private extractDocumentSpecificFields(blocks: AWS.Textract.Block[], documentType: string): ExtractedField[] {
    const fields: ExtractedField[] = [];
    
    switch (documentType.toLowerCase()) {
      case 'income_certificate':
      case 'salary_slip':
        fields.push(...this.extractIncomeFields(blocks));
        break;
      case 'medical_bill':
      case 'medical_report':
        fields.push(...this.extractMedicalFields(blocks));
        break;
      case 'education_certificate':
      case 'marksheet':
        fields.push(...this.extractEducationFields(blocks));
        break;
      case 'bank_statement':
        fields.push(...this.extractBankFields(blocks));
        break;
    }
    
    return fields;
  }

  /**
   * Extract income-related fields
   */
  private extractIncomeFields(blocks: AWS.Textract.Block[]): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const text = this.extractFullText(blocks);
    
    // Extract salary amount
    const salaryPatterns = [
      /(?:salary|income|amount)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)/g
    ];
    
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.push({
          fieldName: 'salary_amount',
          value: match[1].replace(/,/g, ''),
          confidence: 0.85,
          dataType: 'currency'
        });
        break;
      }
    }
    
    // Extract employee ID
    const empIdPattern = /(?:emp|employee|id)[:\s]*([A-Z0-9]{6,10})/i;
    const empIdMatch = text.match(empIdPattern);
    if (empIdMatch) {
      fields.push({
        fieldName: 'employee_id',
        value: empIdMatch[1],
        confidence: 0.9,
        dataType: 'text'
      });
    }
    
    return fields;
  }

  /**
   * Extract medical-related fields
   */
  private extractMedicalFields(blocks: AWS.Textract.Block[]): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const text = this.extractFullText(blocks);
    
    // Extract bill amount
    const amountPattern = /(?:total|amount|bill)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i;
    const amountMatch = text.match(amountPattern);
    if (amountMatch) {
      fields.push({
        fieldName: 'bill_amount',
        value: amountMatch[1].replace(/,/g, ''),
        confidence: 0.85,
        dataType: 'currency'
      });
    }
    
    // Extract patient name
    const patientPattern = /(?:patient|name)[:\s]*([A-Za-z\s]+)/i;
    const patientMatch = text.match(patientPattern);
    if (patientMatch) {
      fields.push({
        fieldName: 'patient_name',
        value: patientMatch[1].trim(),
        confidence: 0.8,
        dataType: 'text'
      });
    }
    
    return fields;
  }

  /**
   * Extract education-related fields
   */
  private extractEducationFields(blocks: AWS.Textract.Block[]): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const text = this.extractFullText(blocks);
    
    // Extract percentage/grade
    const gradePatterns = [
      /(?:percentage|grade|marks)[:\s]*([0-9]+(?:\.[0-9]{2})?)\s*%?/i,
      /([0-9]+(?:\.[0-9]{2})?)\s*%/g
    ];
    
    for (const pattern of gradePatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.push({
          fieldName: 'grade_percentage',
          value: match[1],
          confidence: 0.85,
          dataType: 'percentage'
        });
        break;
      }
    }
    
    // Extract student name
    const studentPattern = /(?:student|name)[:\s]*([A-Za-z\s]+)/i;
    const studentMatch = text.match(studentPattern);
    if (studentMatch) {
      fields.push({
        fieldName: 'student_name',
        value: studentMatch[1].trim(),
        confidence: 0.8,
        dataType: 'text'
      });
    }
    
    return fields;
  }

  /**
   * Extract bank-related fields
   */
  private extractBankFields(blocks: AWS.Textract.Block[]): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const text = this.extractFullText(blocks);
    
    // Extract account number
    const accountPattern = /(?:account|a\/c)[:\s]*([0-9]{9,18})/i;
    const accountMatch = text.match(accountPattern);
    if (accountMatch) {
      fields.push({
        fieldName: 'account_number',
        value: accountMatch[1],
        confidence: 0.9,
        dataType: 'text'
      });
    }
    
    // Extract IFSC code
    const ifscPattern = /(?:ifsc|code)[:\s]*([A-Z]{4}0[A-Z0-9]{6})/i;
    const ifscMatch = text.match(ifscPattern);
    if (ifscMatch) {
      fields.push({
        fieldName: 'ifsc_code',
        value: ifscMatch[1],
        confidence: 0.9,
        dataType: 'text'
      });
    }
    
    return fields;
  }

  /**
   * Normalize field names for consistency
   */
  private normalizeFieldName(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Detect data type based on value and field name
   */
  private detectDataType(value: string, fieldName: string): 'text' | 'number' | 'date' | 'currency' | 'percentage' {
    // Check for currency
    if (/₹|rupees?|rs\.?/i.test(value) || fieldName.includes('amount') || fieldName.includes('salary')) {
      return 'currency';
    }
    
    // Check for percentage
    if (/%/.test(value) || fieldName.includes('percentage') || fieldName.includes('grade')) {
      return 'percentage';
    }
    
    // Check for date
    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(value) || fieldName.includes('date')) {
      return 'date';
    }
    
    // Check for number
    if (/^\d+(\.\d+)?$/.test(value.replace(/,/g, ''))) {
      return 'number';
    }
    
    return 'text';
  }

  /**
   * Extract bounding box from block geometry
   */
  private extractBoundingBox(block: AWS.Textract.Block): BoundingBox | undefined {
    if (!block.Geometry?.BoundingBox) {
      return undefined;
    }
    
    const bbox = block.Geometry.BoundingBox;
    return {
      left: bbox.Left || 0,
      top: bbox.Top || 0,
      width: bbox.Width || 0,
      height: bbox.Height || 0
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(blocks: AWS.Textract.Block[]): number {
    const confidenceValues = blocks
      .filter(block => block.Confidence !== undefined)
      .map(block => block.Confidence!);
    
    if (confidenceValues.length === 0) {
      return 0;
    }
    
    const average = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
    return average / 100; // Convert to 0-1 scale
  }

  /**
   * Get document bytes from file path (S3 or local)
   */
  private async getDocumentBytes(filePath: string): Promise<Buffer> {
    if (filePath.startsWith('s3://')) {
      return this.getS3DocumentBytes(filePath);
    } else {
      // For local files, you would read from filesystem
      const fs = await import('fs');
      return fs.promises.readFile(filePath);
    }
  }

  /**
   * Get document bytes from S3
   */
  private async getS3DocumentBytes(s3Path: string): Promise<Buffer> {
    const s3 = new AWS.S3();
    const bucket = environment.aws.s3Bucket;
    const key = s3Path.replace(`s3://${bucket}/`, '');
    
    const params = {
      Bucket: bucket,
      Key: key
    };
    
    const result = await s3.getObject(params).promise();
    return result.Body as Buffer;
  }
}

export const ocrService = new OCRService();