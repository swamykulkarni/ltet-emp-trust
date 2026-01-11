import { db } from '../database/connection';
import { Scheme } from '@ltet/shared-types';
import { 
  SchemeEntity, 
  CreateSchemeRequest, 
  UpdateSchemeRequest, 
  SchemeFilter,
  SchemeVersion 
} from '../models/scheme.model';

export class SchemeRepository {
  async create(schemeData: CreateSchemeRequest, createdBy: string): Promise<Scheme> {
    const query = `
      INSERT INTO schemes.schemes (
        name, category, description, eligibility_rules, document_requirements,
        approval_workflow, budget_info, status, valid_from, valid_to, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      schemeData.name,
      schemeData.category,
      schemeData.description,
      JSON.stringify(schemeData.eligibilityRules),
      JSON.stringify(schemeData.documentRequirements),
      JSON.stringify(schemeData.approvalWorkflow),
      JSON.stringify(schemeData.budgetInfo),
      'draft',
      schemeData.validFrom,
      schemeData.validTo,
      createdBy
    ];

    const result = await db.query(query, values);
    return this.mapToScheme(result.rows[0]);
  }

  async findById(schemeId: string): Promise<Scheme | null> {
    const query = 'SELECT * FROM schemes.schemes WHERE scheme_id = $1';
    const result = await db.query(query, [schemeId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToScheme(result.rows[0]);
  }

  async findAll(filter: SchemeFilter = {}): Promise<Scheme[]> {
    let query = 'SELECT * FROM schemes.schemes WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;

    if (filter.category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      values.push(filter.category);
    }

    if (filter.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(filter.status);
    }

    if (filter.validDate) {
      paramCount++;
      query += ` AND valid_from <= $${paramCount} AND valid_to >= $${paramCount}`;
      values.push(filter.validDate);
    }

    if (filter.search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      values.push(`%${filter.search}%`);
    }

    if (filter.icRestrictions && filter.icRestrictions.length > 0) {
      paramCount++;
      query += ` AND (
        eligibility_rules->>'icRestrictions' IS NULL OR 
        eligibility_rules->'icRestrictions' ?| $${paramCount}
      )`;
      values.push(filter.icRestrictions);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    return result.rows.map((row: any) => this.mapToScheme(row));
  }

  async update(schemeId: string, updateData: UpdateSchemeRequest): Promise<Scheme | null> {
    const existingScheme = await this.findById(schemeId);
    if (!existingScheme) {
      return null;
    }

    // Create version before updating
    await this.createVersion(schemeId, existingScheme, 'update');

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        if (key === 'eligibilityRules' || key === 'documentRequirements' || 
            key === 'approvalWorkflow' || key === 'budgetInfo') {
          fields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) {
      return existingScheme;
    }

    paramCount++;
    const query = `
      UPDATE schemes.schemes 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE scheme_id = $${paramCount}
      RETURNING *
    `;
    values.push(schemeId);

    const result = await db.query(query, values);
    return this.mapToScheme(result.rows[0]);
  }

  async delete(schemeId: string): Promise<boolean> {
    const query = 'DELETE FROM schemes.schemes WHERE scheme_id = $1';
    const result = await db.query(query, [schemeId]);
    return result.rowCount > 0;
  }

  async publish(schemeId: string): Promise<Scheme | null> {
    const scheme = await this.findById(schemeId);
    if (!scheme) {
      return null;
    }

    // Create version before publishing
    await this.createVersion(schemeId, scheme, 'publish');

    const query = `
      UPDATE schemes.schemes 
      SET status = 'active', updated_at = NOW()
      WHERE scheme_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [schemeId]);
    return this.mapToScheme(result.rows[0]);
  }

  async getVersions(schemeId: string): Promise<SchemeVersion[]> {
    const query = `
      SELECT * FROM schemes.scheme_versions 
      WHERE scheme_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [schemeId]);
    return result.rows.map((row: any) => ({
      versionId: row.version_id,
      schemeId: row.scheme_id,
      version: row.version,
      changes: row.changes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      isActive: row.is_active
    }));
  }

  private async createVersion(schemeId: string, schemeData: Scheme, changeType: string): Promise<void> {
    // First, ensure the scheme_versions table exists
    await this.ensureVersionTableExists();

    const query = `
      INSERT INTO schemes.scheme_versions (
        scheme_id, version, changes, created_by, change_type
      ) VALUES (
        $1, 
        COALESCE((SELECT MAX(version) FROM schemes.scheme_versions WHERE scheme_id = $1), 0) + 1,
        $2, 
        $3, 
        $4
      )
    `;

    await db.query(query, [
      schemeId,
      JSON.stringify(schemeData),
      'system', // TODO: Get from context
      changeType
    ]);
  }

  private async ensureVersionTableExists(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schemes.scheme_versions (
        version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scheme_id UUID NOT NULL REFERENCES schemes.schemes(scheme_id),
        version INTEGER NOT NULL,
        changes JSONB NOT NULL,
        created_by UUID,
        change_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await db.query(createTableQuery);

    // Create index if not exists
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_scheme_versions_scheme_id 
      ON schemes.scheme_versions(scheme_id)
    `;

    await db.query(createIndexQuery);
  }

  private mapToScheme(row: any): Scheme {
    return {
      schemeId: row.scheme_id,
      name: row.name,
      category: row.category,
      description: row.description,
      eligibilityRules: row.eligibility_rules || {},
      documentRequirements: row.document_requirements || [],
      approvalWorkflow: row.approval_workflow || {},
      budgetInfo: row.budget_info || {},
      status: row.status,
      validFrom: row.valid_from,
      validTo: row.valid_to
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}