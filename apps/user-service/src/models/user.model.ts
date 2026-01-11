import { User as IUser, UserRole } from '@ltet/shared-types';

export interface UserEntity extends IUser {
  passwordHash: string;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  // MFA fields
  mfaEnabled?: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: string;
  mfaEnabledAt?: Date;
  mfaLastUsed?: Date;
}

export interface CreateUserRequest {
  employeeId: string;
  password: string;
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };
  employmentInfo: {
    department: string;
    ic: string;
    joiningDate: Date;
    retirementDate?: Date;
    status: 'active' | 'retired';
  };
  roles: UserRole[];
}

export interface UpdateUserRequest {
  personalInfo?: Partial<IUser['personalInfo']>;
  bankDetails?: IUser['bankDetails'];
  dependents?: IUser['dependents'];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  employeeId: string;
  newPassword: string;
  resetToken: string;
}