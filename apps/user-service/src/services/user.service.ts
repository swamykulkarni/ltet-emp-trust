import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '@ltet/shared-types';
import { UserValidator, ValidationHelper } from '@ltet/shared-validation';
import { ValidationUtils, performanceService, cacheService } from '@ltet/shared-utils';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserRequest, UpdateUserRequest, ChangePasswordRequest } from '../models/user.model';
import { environment } from '../environments/environment';
import { HRMSService } from './hrms.service';
import { IFSCVerificationService } from './ifsc-verification.service';

export interface UserServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class UserService {
  private userRepository: UserRepository;
  private userValidator: UserValidator;
  private hrmsService: HRMSService;
  private ifscVerificationService: IFSCVerificationService;

  constructor() {
    this.userRepository = new UserRepository();
    this.userValidator = new UserValidator();
    this.hrmsService = new HRMSService();
    this.ifscVerificationService = new IFSCVerificationService();
  }

  async getUserById(userId: string): Promise<UserServiceResult<User>> {
    try {
      // Try to get from cache first
      const cachedUser = await performanceService.cacheFrequentData(
        `user:${userId}`,
        async () => {
          const userEntity = await this.userRepository.findById(userId);
          return userEntity ? this.toPublicUser(userEntity) : null;
        },
        { 
          category: 'user',
          priority: 'high',
          ttl: 300 // 5 minutes
        }
      );

      if (!cachedUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        data: cachedUser
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve user'
      };
    }
  }

  async getUserByEmployeeId(employeeId: string): Promise<UserServiceResult<User>> {
    try {
      // Try to get from cache first
      const cachedUser = await performanceService.cacheFrequentData(
        `user:employee:${employeeId}`,
        async () => {
          const userEntity = await this.userRepository.findByEmployeeId(employeeId);
          return userEntity ? this.toPublicUser(userEntity) : null;
        },
        { 
          category: 'user',
          priority: 'high',
          ttl: 300 // 5 minutes
        }
      );

      if (!cachedUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        data: cachedUser
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve user'
      };
    }
  }

  async createUser(userData: CreateUserRequest): Promise<UserServiceResult<User>> {
    try {
      // Validate user data
      const userForValidation = {
        personalInfo: userData.personalInfo,
        employmentInfo: userData.employmentInfo
      };
      ValidationHelper.validateAndThrow(this.userValidator, userForValidation);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmployeeId(userData.employeeId);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this employee ID already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, environment.bcryptRounds);

      // Create user
      const userEntity = await this.userRepository.create(userData, passwordHash);
      const user = this.toPublicUser(userEntity);

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.validationErrors ? 
          error.validationErrors.map((e: any) => e.message).join(', ') : 
          error.message || 'Failed to create user'
      };
    }
  }

  async updateUserProfile(userId: string, updateData: UpdateUserRequest): Promise<UserServiceResult<User>> {
    try {
      // Validate update data
      if (updateData.personalInfo || updateData.bankDetails) {
        const dataForValidation: any = {};
        if (updateData.personalInfo) {
          dataForValidation.personalInfo = updateData.personalInfo;
        }
        if (updateData.bankDetails) {
          dataForValidation.bankDetails = updateData.bankDetails;
        }
        ValidationHelper.validateAndThrow(this.userValidator, dataForValidation);
      }

      // Additional bank details validation
      if (updateData.bankDetails) {
        const ifscVerification = await this.ifscVerificationService.verifyIFSC(updateData.bankDetails.ifscCode);
        if (!ifscVerification.success) {
          return {
            success: false,
            error: 'IFSC verification service unavailable. Please try again later.'
          };
        }
        
        if (!ifscVerification.valid) {
          return {
            success: false,
            error: ifscVerification.error || 'Invalid IFSC code'
          };
        }

        // Optionally update bank name with verified information
        if (ifscVerification.details) {
          updateData.bankDetails.bankName = ifscVerification.details.bank;
        }
      }

      // Update user
      const userEntity = await this.userRepository.update(userId, updateData);
      const user = this.toPublicUser(userEntity);

      // Invalidate cache after update
      await performanceService.invalidateCache(`user:${userId}`, 'user');
      await performanceService.invalidateCache(`user:employee:${user.employeeId}`, 'user');

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.validationErrors ? 
          error.validationErrors.map((e: any) => e.message).join(', ') : 
          error.message || 'Failed to update user profile'
      };
    }
  }

  async syncUserFromHRMS(employeeId: string): Promise<UserServiceResult<User>> {
    try {
      // Fetch user data from HRMS
      const hrmsData = await this.hrmsService.getEmployeeData(employeeId);
      if (!hrmsData.success || !hrmsData.data) {
        return {
          success: false,
          error: hrmsData.error || 'Failed to fetch data from HRMS'
        };
      }

      // Check if user exists
      const existingUser = await this.userRepository.findByEmployeeId(employeeId);
      if (!existingUser) {
        return {
          success: false,
          error: 'User not found in local database'
        };
      }

      // Update user with HRMS data
      const updateData: UpdateUserRequest = {
        personalInfo: {
          name: hrmsData.data.name,
          email: hrmsData.data.email,
          phone: hrmsData.data.phone,
          address: hrmsData.data.address
        }
      };

      const result = await this.updateUserProfile(existingUser.userId, updateData);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to sync user from HRMS'
      };
    }
  }

  async addDependent(userId: string, dependent: { name: string; relationship: string; dateOfBirth: Date; documents: string[] }): Promise<UserServiceResult<User>> {
    try {
      // Get current user
      const userResult = await this.getUserById(userId);
      if (!userResult.success || !userResult.data) {
        return userResult;
      }

      // Add new dependent
      const updatedDependents = [...userResult.data.dependents, dependent];
      
      const result = await this.updateUserProfile(userId, {
        dependents: updatedDependents
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to add dependent'
      };
    }
  }

  async removeDependent(userId: string, dependentName: string): Promise<UserServiceResult<User>> {
    try {
      // Get current user
      const userResult = await this.getUserById(userId);
      if (!userResult.success || !userResult.data) {
        return userResult;
      }

      // Remove dependent
      const updatedDependents = userResult.data.dependents.filter(
        dep => dep.name !== dependentName
      );
      
      const result = await this.updateUserProfile(userId, {
        dependents: updatedDependents
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to remove dependent'
      };
    }
  }

  async updateBankDetails(userId: string, bankDetails: { accountNumber: string; ifscCode: string; bankName: string }): Promise<UserServiceResult<User>> {
    try {
      // Verify IFSC code
      const ifscVerification = await this.ifscVerificationService.verifyIFSC(bankDetails.ifscCode);
      if (!ifscVerification.success) {
        return {
          success: false,
          error: 'IFSC verification service unavailable. Please try again later.'
        };
      }
      
      if (!ifscVerification.valid) {
        return {
          success: false,
          error: ifscVerification.error || 'Invalid IFSC code'
        };
      }

      // Use verified bank name if available
      const verifiedBankDetails = {
        ...bankDetails,
        bankName: ifscVerification.details?.bank || bankDetails.bankName
      };

      const result = await this.updateUserProfile(userId, {
        bankDetails: verifiedBankDetails
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update bank details'
      };
    }
  }

  async verifyIFSC(ifscCode: string): Promise<UserServiceResult<any>> {
    try {
      // Cache IFSC verification results for 24 hours since they rarely change
      const result = await performanceService.cacheFrequentData(
        `ifsc:${ifscCode}`,
        async () => {
          return await this.ifscVerificationService.verifyIFSC(ifscCode);
        },
        { 
          category: 'static',
          priority: 'medium',
          ttl: 86400 // 24 hours
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: 'IFSC verification service unavailable'
        };
      }

      return {
        success: true,
        data: {
          valid: result.valid,
          details: result.details,
          error: result.error
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify IFSC code'
      };
    }
  }

  private toPublicUser(userEntity: any): User {
    return {
      userId: userEntity.userId,
      employeeId: userEntity.employeeId,
      personalInfo: userEntity.personalInfo,
      employmentInfo: userEntity.employmentInfo,
      bankDetails: userEntity.bankDetails,
      dependents: userEntity.dependents,
      roles: userEntity.roles,
      createdAt: userEntity.createdAt,
      updatedAt: userEntity.updatedAt
    };
  }
}