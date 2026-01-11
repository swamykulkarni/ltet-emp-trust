import { db } from '../database/connection';
import { Document, DocumentSearchQuery, DocumentValidationStatus } from '../models/document.model';

export class DocumentRepository {

  /**
   * Create a new document record
   */
  async create(document: Document): Promise<Document> {
    const query = `
      INSERT INTO documents.documents (
        document_id, application_id, file_name, original_name, mime_type, 
        file_size, file_path, document_type, validation_status, 
        validation_results, ocr_data, confidence_score, uploaded_by, 
        uploaded_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      document.documentId,
      document.applicationId,
      document.fileName,
      document.originalName,
      document.mimeType,
      document.fileSize,
      document.filePath,
      document.documentType,
      document.validationStatus,
      document.validationResults ? JSON.stringify(document.validationResults) : null,
      document.ocrData ? JSON.stringify(document.ocrData) : null,
      document.confidenceScore,
      document.uploadedBy,
      document.uploadedAt,
      document.updatedAt,
      document.version
    ];

    const result = await db.query(query, values);
    return this.mapRowToDocument(result.rows[0]);
  }

  /**
   * Find document by ID
   */
  async findById(documentId: string): Promise<Document | null> {
    const query = `
      SELECT * FROM documents.documents 
      WHERE document_id = $1
    `;

    const result = await db.query(query, [documentId]);
    return result.rows.length > 0 ? this.mapRowToDocument(result.rows[0]) : null;
  }

  /**
   * Find documents by application ID
   */
  async findByApplicationId(applicationId: string): Promise<Document[]> {
    const query = `
      SELECT * FROM documents.documents 
      WHERE application_id = $1
      ORDER BY uploaded_at DESC
    `;

    const result = await db.query(query, [applicationId]);
    return result.rows.map(row => this.mapRowToDocument(row));
  }

  /**
   * Update document
   */
  async update(documentId: string, updates: Partial<Document>): Promise<Document> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic SET clause
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const columnName = this.camelToSnakeCase(key);
        
        if (key === 'validationResults' || key === 'ocrData') {
          setClause.push(`${columnName} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${columnName} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    // Always update the updated_at timestamp
    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    // Add document ID for WHERE clause
    values.push(documentId);

    const query = `
      UPDATE documents.documents 
      SET ${setClause.join(', ')}
      WHERE document_id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    return this.mapRowToDocument(result.rows[0]);
  }

  /**
   * Delete document
   */
  async delete(documentId: string): Promise<void> {
    const query = `
      DELETE FROM documents.documents 
      WHERE document_id = $1
    `;

    const result = await db.query(query, [documentId]);
    if (result.rowCount === 0) {
      throw new Error('Document not found');
    }
  }

  /**
   * Search documents with filters
   */
  async search(searchQuery: DocumentSearchQuery): Promise<{ documents: Document[], total: number }> {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (searchQuery.applicationId) {
      conditions.push(`application_id = $${paramIndex}`);
      values.push(searchQuery.applicationId);
      paramIndex++;
    }

    if (searchQuery.documentType) {
      conditions.push(`document_type = $${paramIndex}`);
      values.push(searchQuery.documentType);
      paramIndex++;
    }

    if (searchQuery.validationStatus) {
      conditions.push(`validation_status = $${paramIndex}`);
      values.push(searchQuery.validationStatus);
      paramIndex++;
    }

    if (searchQuery.uploadedBy) {
      conditions.push(`uploaded_by = $${paramIndex}`);
      values.push(searchQuery.uploadedBy);
      paramIndex++;
    }

    if (searchQuery.dateFrom) {
      conditions.push(`uploaded_at >= $${paramIndex}`);
      values.push(searchQuery.dateFrom);
      paramIndex++;
    }

    if (searchQuery.dateTo) {
      conditions.push(`uploaded_at <= $${paramIndex}`);
      values.push(searchQuery.dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM documents.documents 
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Data query with pagination
    const limit = searchQuery.limit || 20;
    const offset = searchQuery.offset || 0;

    const dataQuery = `
      SELECT * FROM documents.documents 
      ${whereClause}
      ORDER BY uploaded_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const dataResult = await db.query(dataQuery, values);
    const documents = dataResult.rows.map(row => this.mapRowToDocument(row));

    return { documents, total };
  }

  /**
   * Get document statistics
   */
  async getStatistics(applicationId?: string): Promise<any> {
    const conditions = applicationId ? 'WHERE application_id = $1' : '';
    const values = applicationId ? [applicationId] : [];

    const query = `
      SELECT 
        COUNT(*) as total_documents,
        COUNT(CASE WHEN validation_status = 'validated' THEN 1 END) as validated_documents,
        COUNT(CASE WHEN validation_status = 'failed' THEN 1 END) as failed_documents,
        COUNT(CASE WHEN validation_status = 'pending' THEN 1 END) as pending_documents,
        COUNT(CASE WHEN validation_status = 'processing' THEN 1 END) as processing_documents,
        AVG(confidence_score) as average_confidence,
        SUM(file_size) as total_file_size,
        COUNT(DISTINCT document_type) as unique_document_types
      FROM documents.documents 
      ${conditions}
    `;

    const result = await db.query(query, values);
    const stats = result.rows[0];

    // Get document type breakdown
    const typeQuery = `
      SELECT 
        document_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM documents.documents 
      ${conditions}
      GROUP BY document_type
      ORDER BY count DESC
    `;

    const typeResult = await db.query(typeQuery, values);

    return {
      ...stats,
      total_documents: parseInt(stats.total_documents),
      validated_documents: parseInt(stats.validated_documents),
      failed_documents: parseInt(stats.failed_documents),
      pending_documents: parseInt(stats.pending_documents),
      processing_documents: parseInt(stats.processing_documents),
      average_confidence: parseFloat(stats.average_confidence) || 0,
      total_file_size: parseInt(stats.total_file_size) || 0,
      unique_document_types: parseInt(stats.unique_document_types),
      document_type_breakdown: typeResult.rows.map(row => ({
        document_type: row.document_type,
        count: parseInt(row.count),
        avg_confidence: parseFloat(row.avg_confidence) || 0
      }))
    };
  }

  /**
   * Get documents with low confidence scores
   */
  async getLowConfidenceDocuments(threshold: number = 0.8, applicationId?: string): Promise<Document[]> {
    const conditions = ['confidence_score < $1'];
    const values: any[] = [threshold];
    let paramIndex = 2;

    if (applicationId) {
      conditions.push(`application_id = $${paramIndex}`);
      values.push(applicationId);
      paramIndex++;
    }

    const query = `
      SELECT * FROM documents.documents 
      WHERE ${conditions.join(' AND ')}
      ORDER BY confidence_score ASC, uploaded_at DESC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => this.mapRowToDocument(row));
  }

  /**
   * Get documents by validation status
   */
  async getDocumentsByStatus(status: DocumentValidationStatus, applicationId?: string): Promise<Document[]> {
    const conditions = ['validation_status = $1'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (applicationId) {
      conditions.push(`application_id = $${paramIndex}`);
      values.push(applicationId);
      paramIndex++;
    }

    const query = `
      SELECT * FROM documents.documents 
      WHERE ${conditions.join(' AND ')}
      ORDER BY uploaded_at DESC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => this.mapRowToDocument(row));
  }

  /**
   * Map database row to Document object
   */
  private mapRowToDocument(row: any): Document {
    return {
      documentId: row.document_id,
      applicationId: row.application_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      documentType: row.document_type,
      validationStatus: row.validation_status,
      validationResults: row.validation_results ? JSON.parse(row.validation_results) : undefined,
      ocrData: row.ocr_data ? JSON.parse(row.ocr_data) : undefined,
      confidenceScore: row.confidence_score,
      uploadedBy: row.uploaded_by,
      uploadedAt: new Date(row.uploaded_at),
      updatedAt: new Date(row.updated_at),
      version: row.version
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Create version record for document
   */
  async createVersion(document: Document): Promise<void> {
    const versionId = this.generateUUID();
    
    const query = `
      INSERT INTO documents.document_versions (
        version_id, document_id, version_number, file_path, file_size,
        validation_status, validation_results, ocr_data, confidence_score,
        created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const values = [
      versionId,
      document.documentId,
      document.version,
      document.filePath,
      document.fileSize,
      document.validationStatus,
      document.validationResults ? JSON.stringify(document.validationResults) : null,
      document.ocrData ? JSON.stringify(document.ocrData) : null,
      document.confidenceScore,
      new Date(),
      document.uploadedBy
    ];

    await db.query(query, values);
  }

  /**
   * Get version history for document
   */
  async getVersionHistory(documentId: string): Promise<any[]> {
    const query = `
      SELECT 
        version_id, version_number, file_path, file_size,
        validation_status, validation_results, ocr_data, confidence_score,
        created_at, created_by
      FROM documents.document_versions 
      WHERE document_id = $1
      ORDER BY version_number DESC
    `;

    const result = await db.query(query, [documentId]);
    return result.rows.map(row => ({
      versionId: row.version_id,
      versionNumber: row.version_number,
      filePath: row.file_path,
      fileSize: row.file_size,
      validationStatus: row.validation_status,
      validationResults: row.validation_results ? JSON.parse(row.validation_results) : null,
      ocrData: row.ocr_data ? JSON.parse(row.ocr_data) : null,
      confidenceScore: row.confidence_score,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    }));
  }

  /**
   * Get specific version of document
   */
  async getVersion(documentId: string, versionNumber: number): Promise<any | null> {
    const query = `
      SELECT 
        version_id, version_number, file_path, file_size,
        validation_status, validation_results, ocr_data, confidence_score,
        created_at, created_by
      FROM documents.document_versions 
      WHERE document_id = $1 AND version_number = $2
    `;

    const result = await db.query(query, [documentId, versionNumber]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      versionId: row.version_id,
      versionNumber: row.version_number,
      filePath: row.file_path,
      fileSize: row.file_size,
      validationStatus: row.validation_status,
      validationResults: row.validation_results ? JSON.parse(row.validation_results) : null,
      ocrData: row.ocr_data ? JSON.parse(row.ocr_data) : null,
      confidenceScore: row.confidence_score,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }

  /**
   * Get document metadata
   */
  async getMetadata(documentId: string): Promise<any | null> {
    const query = `
      SELECT 
        metadata_id, page_count, dimensions_width, dimensions_height,
        quality, is_readable, has_text, created_at
      FROM documents.document_metadata 
      WHERE document_id = $1
    `;

    const result = await db.query(query, [documentId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      metadataId: row.metadata_id,
      pageCount: row.page_count,
      dimensions: row.dimensions_width && row.dimensions_height ? {
        width: row.dimensions_width,
        height: row.dimensions_height
      } : null,
      quality: row.quality,
      isReadable: row.is_readable,
      hasText: row.has_text,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Update document metadata
   */
  async updateMetadata(documentId: string, metadata: any): Promise<void> {
    // Check if metadata exists
    const existingMetadata = await this.getMetadata(documentId);
    
    if (existingMetadata) {
      // Update existing metadata
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (metadata.pageCount !== undefined) {
        setClause.push(`page_count = $${paramIndex}`);
        values.push(metadata.pageCount);
        paramIndex++;
      }

      if (metadata.dimensions) {
        setClause.push(`dimensions_width = $${paramIndex}`);
        values.push(metadata.dimensions.width);
        paramIndex++;
        
        setClause.push(`dimensions_height = $${paramIndex}`);
        values.push(metadata.dimensions.height);
        paramIndex++;
      }

      if (metadata.quality !== undefined) {
        setClause.push(`quality = $${paramIndex}`);
        values.push(metadata.quality);
        paramIndex++;
      }

      if (metadata.isReadable !== undefined) {
        setClause.push(`is_readable = $${paramIndex}`);
        values.push(metadata.isReadable);
        paramIndex++;
      }

      if (metadata.hasText !== undefined) {
        setClause.push(`has_text = $${paramIndex}`);
        values.push(metadata.hasText);
        paramIndex++;
      }

      if (setClause.length > 0) {
        values.push(documentId);
        const query = `
          UPDATE documents.document_metadata 
          SET ${setClause.join(', ')}
          WHERE document_id = $${paramIndex}
        `;
        await db.query(query, values);
      }
    } else {
      // Create new metadata
      const metadataId = this.generateUUID();
      const query = `
        INSERT INTO documents.document_metadata (
          metadata_id, document_id, page_count, dimensions_width, dimensions_height,
          quality, is_readable, has_text, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        metadataId,
        documentId,
        metadata.pageCount || null,
        metadata.dimensions?.width || null,
        metadata.dimensions?.height || null,
        metadata.quality || null,
        metadata.isReadable || false,
        metadata.hasText || false,
        new Date()
      ];

      await db.query(query, values);
    }
  }

  /**
   * Generate UUID (simple implementation)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const documentRepository = new DocumentRepository();