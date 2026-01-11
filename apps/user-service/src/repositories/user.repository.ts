import { PoolClient } from 'pg';
import { User, UserRole, Dependent } from '@ltet/shared-types';
import { UserEntity, CreateUserRequest, UpdateUserRequest } from '../models/user.model';
import { db } from '../database/connection';

export class UserRepository {
  async findByEmployeeId(employeeId: string): Promise<UserEntity | null> {
    const query = `
      SELECT 
        u.user_id,
        u.employee_id,
        u.password_hash,
        u.name,
        u.email,
        u.phone,
        u.address_street,
        u.address_city,
        u.address_state,
        u.address_pincode,
        u.address_country,
        u.department,
        u.ic,
        u.joining_date,
        u.retirement_date,
        u.employment_status,
        u.bank_account_number,
        u.bank_ifsc_code,
        u.bank_name,
        u.roles,
        u.last_login_at,
        u.failed_login_attempts,
        u.locked_until,
        u.refresh_token,
        u.refresh_token_expires_at,
        u.mfa_enabled,
        u.mfa_secret,
        u.mfa_backup_codes,
        u.mfa_enabled_at,
        u.mfa_last_used,
        u.created_at,
        u.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'name', d.name,
              'relationship', d.relationship,
              'dateOfBirth', d.date_of_birth,
              'documents', d.documents
            )
          ) FILTER (WHERE d.dependent_id IS NOT NULL),
          '[]'::json
        ) as dependents
      FROM users u
      LEFT JOIN user_dependents d ON u.user_id = d.user_id
      WHERE u.employee_id = $1
      GROUP BY u.user_id
    `;

    const result = await db.query(query, [employeeId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUserEntity(result.rows[0]);
  }

  async findById(userId: string): Promise<UserEntity | null> {
    const query = `
      SELECT 
        u.user_id,
        u.employee_id,
        u.password_hash,
        u.name,
        u.email,
        u.phone,
        u.address_street,
        u.address_city,
        u.address_state,
        u.address_pincode,
        u.address_country,
        u.department,
        u.ic,
        u.joining_date,
        u.retirement_date,
        u.employment_status,
        u.bank_account_number,
        u.bank_ifsc_code,
        u.bank_name,
        u.roles,
        u.last_login_at,
        u.failed_login_attempts,
        u.locked_until,
        u.refresh_token,
        u.refresh_token_expires_at,
        u.mfa_enabled,
        u.mfa_secret,
        u.mfa_backup_codes,
        u.mfa_enabled_at,
        u.mfa_last_used,
        u.created_at,
        u.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'name', d.name,
              'relationship', d.relationship,
              'dateOfBirth', d.date_of_birth,
              'documents', d.documents
            )
          ) FILTER (WHERE d.dependent_id IS NOT NULL),
          '[]'::json
        ) as dependents
      FROM users u
      LEFT JOIN user_dependents d ON u.user_id = d.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUserEntity(result.rows[0]);
  }

  async create(userData: CreateUserRequest, passwordHash: string): Promise<UserEntity> {
    return db.transaction(async (client: PoolClient) => {
      // Insert user
      const userQuery = `
        INSERT INTO users (
          employee_id, password_hash, name, email, phone,
          address_street, address_city, address_state, address_pincode, address_country,
          department, ic, joining_date, retirement_date, employment_status, roles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING user_id
      `;

      const userValues = [
        userData.employeeId,
        passwordHash,
        userData.personalInfo.name,
        userData.personalInfo.email,
        userData.personalInfo.phone,
        userData.personalInfo.address.street,
        userData.personalInfo.address.city,
        userData.personalInfo.address.state,
        userData.personalInfo.address.pincode,
        userData.personalInfo.address.country,
        userData.employmentInfo.department,
        userData.employmentInfo.ic,
        userData.employmentInfo.joiningDate,
        userData.employmentInfo.retirementDate,
        userData.employmentInfo.status,
        userData.roles
      ];

      const userResult = await client.query(userQuery, userValues);
      const userId = userResult.rows[0].user_id;

      // Return the created user
      const createdUser = await this.findById(userId);
      if (!createdUser) {
        throw new Error('Failed to retrieve created user');
      }

      return createdUser;
    });
  }

  async update(userId: string, updateData: UpdateUserRequest): Promise<UserEntity> {
    return db.transaction(async (client: PoolClient) => {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Handle personal info updates
      if (updateData.personalInfo) {
        if (updateData.personalInfo.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(updateData.personalInfo.name);
        }
        if (updateData.personalInfo.email !== undefined) {
          updates.push(`email = $${paramIndex++}`);
          values.push(updateData.personalInfo.email);
        }
        if (updateData.personalInfo.phone !== undefined) {
          updates.push(`phone = $${paramIndex++}`);
          values.push(updateData.personalInfo.phone);
        }
        if (updateData.personalInfo.address) {
          const addr = updateData.personalInfo.address;
          if (addr.street !== undefined) {
            updates.push(`address_street = $${paramIndex++}`);
            values.push(addr.street);
          }
          if (addr.city !== undefined) {
            updates.push(`address_city = $${paramIndex++}`);
            values.push(addr.city);
          }
          if (addr.state !== undefined) {
            updates.push(`address_state = $${paramIndex++}`);
            values.push(addr.state);
          }
          if (addr.pincode !== undefined) {
            updates.push(`address_pincode = $${paramIndex++}`);
            values.push(addr.pincode);
          }
          if (addr.country !== undefined) {
            updates.push(`address_country = $${paramIndex++}`);
            values.push(addr.country);
          }
        }
      }

      // Handle bank details updates
      if (updateData.bankDetails) {
        updates.push(`bank_account_number = $${paramIndex++}`);
        values.push(updateData.bankDetails.accountNumber);
        updates.push(`bank_ifsc_code = $${paramIndex++}`);
        values.push(updateData.bankDetails.ifscCode);
        updates.push(`bank_name = $${paramIndex++}`);
        values.push(updateData.bankDetails.bankName);
      }

      if (updates.length > 0) {
        const query = `
          UPDATE users 
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $${paramIndex}
        `;
        values.push(userId);

        await client.query(query, values);
      }

      // Handle dependents updates
      if (updateData.dependents) {
        // Delete existing dependents
        await client.query('DELETE FROM user_dependents WHERE user_id = $1', [userId]);

        // Insert new dependents
        for (const dependent of updateData.dependents) {
          const dependentQuery = `
            INSERT INTO user_dependents (user_id, name, relationship, date_of_birth, documents)
            VALUES ($1, $2, $3, $4, $5)
          `;
          await client.query(dependentQuery, [
            userId,
            dependent.name,
            dependent.relationship,
            dependent.dateOfBirth,
            dependent.documents
          ]);
        }
      }

      // Return updated user
      const updatedUser = await this.findById(userId);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      return updatedUser;
    });
  }

  async updateLoginAttempts(userId: string, attempts: number, lockedUntil?: Date): Promise<void> {
    const query = `
      UPDATE users 
      SET failed_login_attempts = $1, locked_until = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `;
    await db.query(query, [attempts, lockedUntil, userId]);
  }

  async updateLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    await db.query(query, [userId]);
  }

  async updateRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    const query = `
      UPDATE users 
      SET refresh_token = $1, refresh_token_expires_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `;
    await db.query(query, [refreshToken, expiresAt, userId]);
  }

  async clearRefreshToken(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET refresh_token = NULL, refresh_token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    await db.query(query, [userId]);
  }

  // MFA-related methods
  async storeMFASecret(userId: string, encryptedSecret: string, encryptedBackupCodes: string[]): Promise<void> {
    const query = `
      UPDATE users 
      SET mfa_secret = $2, mfa_backup_codes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId, encryptedSecret, JSON.stringify(encryptedBackupCodes)]);
  }

  async enableMFA(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET mfa_enabled = true, mfa_enabled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId]);
  }

  async disableMFA(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL, 
          mfa_last_used = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId]);
  }

  async updateMFALastUsed(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET mfa_last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId]);
  }

  async removeUsedBackupCode(userId: string, codeIndex: number): Promise<void> {
    const user = await this.findById(userId);
    if (!user || !user.mfaBackupCodes) return;

    const backupCodes = JSON.parse(user.mfaBackupCodes);
    backupCodes.splice(codeIndex, 1);

    const query = `
      UPDATE users 
      SET mfa_backup_codes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId, JSON.stringify(backupCodes)]);
  }

  async updateBackupCodes(userId: string, encryptedBackupCodes: string[]): Promise<void> {
    const query = `
      UPDATE users 
      SET mfa_backup_codes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await db.query(query, [userId, JSON.stringify(encryptedBackupCodes)]);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `;
    await db.query(query, [passwordHash, userId]);
  }

  async getAllEmployeeIds(): Promise<string[]> {
    const query = 'SELECT employee_id FROM users ORDER BY employee_id';
    const result = await db.query(query);
    return result.rows.map(row => row.employee_id);
  }

  async getEmployeesNeedingSync(cutoffTime: Date): Promise<string[]> {
    const query = `
      SELECT employee_id 
      FROM users 
      WHERE updated_at < $1 OR updated_at IS NULL
      ORDER BY employee_id
    `;
    const result = await db.query(query, [cutoffTime]);
    return result.rows.map(row => row.employee_id);
  }

  async updateEmployeeFromHRMS(hrmsData: any): Promise<void> {
    const query = `
      UPDATE users 
      SET 
        name = $2,
        email = $3,
        phone = $4,
        address_street = $5,
        address_city = $6,
        address_state = $7,
        address_pincode = $8,
        address_country = $9,
        department = $10,
        ic = $11,
        joining_date = $12,
        retirement_date = $13,
        employment_status = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1
    `;
    
    await db.query(query, [
      hrmsData.employeeId,
      hrmsData.name,
      hrmsData.email,
      hrmsData.phone,
      hrmsData.address.street,
      hrmsData.address.city,
      hrmsData.address.state,
      hrmsData.address.pincode,
      hrmsData.address.country,
      hrmsData.department,
      hrmsData.ic,
      hrmsData.joiningDate,
      hrmsData.retirementDate,
      hrmsData.status
    ]);
  }

  private mapRowToUserEntity(row: any): UserEntity {
    return {
      userId: row.user_id,
      employeeId: row.employee_id,
      passwordHash: row.password_hash,
      personalInfo: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        address: {
          street: row.address_street || '',
          city: row.address_city || '',
          state: row.address_state || '',
          pincode: row.address_pincode || '',
          country: row.address_country || 'India'
        }
      },
      employmentInfo: {
        department: row.department,
        ic: row.ic,
        joiningDate: new Date(row.joining_date),
        retirementDate: row.retirement_date ? new Date(row.retirement_date) : undefined,
        status: row.employment_status
      },
      bankDetails: row.bank_account_number ? {
        accountNumber: row.bank_account_number,
        ifscCode: row.bank_ifsc_code,
        bankName: row.bank_name
      } : undefined,
      dependents: row.dependents || [],
      roles: row.roles as UserRole[],
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
      refreshToken: row.refresh_token,
      refreshTokenExpiresAt: row.refresh_token_expires_at ? new Date(row.refresh_token_expires_at) : undefined,
      // MFA fields
      mfaEnabled: row.mfa_enabled || false,
      mfaSecret: row.mfa_secret,
      mfaBackupCodes: row.mfa_backup_codes,
      mfaEnabledAt: row.mfa_enabled_at ? new Date(row.mfa_enabled_at) : undefined,
      mfaLastUsed: row.mfa_last_used ? new Date(row.mfa_last_used) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}