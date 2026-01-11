import { UserService } from '../user.service';
import { UserRepository } from '../../repositories/user.repository';
import { HRMSService } from '../hrms.service';
import { IFSCVerificationService } from '../ifsc-verification.service';
import { UserEntity } from '../../models/user.model';

// Mock dependencies
jest.mock('../../repositories/user.repository');
jest.mock('../hrms.service');
jest.mock('../ifsc-verification.service');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockHRMSService: jest.Mocked<HRMSService>;
  let mockIFSCService: jest.Mocked<IFSCVerificationService>;

  const mockUser: UserEntity = {
    userId: 'user-123',
    employeeId: 'EMP001',
    passwordHash: 'hashed-password',
    personalInfo: {
      name: 'John Doe',
      email: 'john.doe@lnt.com',
      phone: '9876543210',
      address: {
        street: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India'
      }
    },
    employmentInfo: {
      department: 'Engineering',
      ic: 'LTTS',
      joiningDate: new Date('2020-01-01'),
      status: 'active'
    },
    dependents: [],
    roles: ['employee'],
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockHRMSService = new HRMSService() as jest.Mocked<HRMSService>;
    mockIFSCService = new IFSCVerificationService() as jest.Mocked<IFSCVerificationService>;
    
    (userService as any).userRepository = mockUserRepository;
    (userService as any).hrmsService = mockHRMSService;
    (userService as any).ifscVerificationService = mockIFSCService;
  });

  describe('getUserById', () => {
    it('should successfully retrieve user by ID', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.employeeId).toBe('EMP001');
    });

    it('should return error when user not found', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await userService.getUserById('user-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should successfully update user profile', async () => {
      // Arrange
      const updateData = {
        personalInfo: {
          name: 'John Updated',
          email: 'john.updated@lnt.com',
          phone: '9876543210' // Include required phone number
        }
      };
      const updatedUser = { ...mockUser, personalInfo: { ...mockUser.personalInfo, ...updateData.personalInfo } };
      
      // Mock findById to return the updated user (called by getUserById in the service)
      mockUserRepository.findById.mockResolvedValue(updatedUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserProfile('user-123', updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.personalInfo.name).toBe('John Updated');
      expect(result.data?.personalInfo.email).toBe('john.updated@lnt.com');
    });

    it('should validate bank details with IFSC verification', async () => {
      // Arrange
      const updateData = {
        bankDetails: {
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India'
        }
      };

      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: true,
        details: {
          ifsc: 'SBIN0001234',
          bank: 'State Bank of India',
          branch: 'Main Branch',
          address: '123 Bank Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          rtgs: true,
          neft: true,
          imps: true,
          upi: true
        }
      });

      const updatedUser = { ...mockUser, bankDetails: updateData.bankDetails };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserProfile('user-123', updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(mockIFSCService.verifyIFSC).toHaveBeenCalledWith('SBIN0001234');
      expect(result.data?.bankDetails?.bankName).toBe('State Bank of India');
    });

    it('should fail with invalid IFSC code', async () => {
      // Arrange
      const updateData = {
        bankDetails: {
          accountNumber: '1234567890',
          ifscCode: 'INVALID123',
          bankName: 'Some Bank'
        }
      };

      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: false,
        error: 'Invalid IFSC code format'
      });

      // Act
      const result = await userService.updateUserProfile('user-123', updateData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IFSC code format');
    });
  });

  describe('syncUserFromHRMS', () => {
    it('should successfully sync user data from HRMS', async () => {
      // Arrange
      const hrmsData = {
        employeeId: 'EMP001',
        name: 'John HRMS',
        email: 'john.hrms@lnt.com',
        phone: '9876543210',
        address: {
          street: '456 HRMS St',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
          country: 'India'
        },
        department: 'Engineering',
        ic: 'LTTS',
        joiningDate: new Date('2020-01-01'),
        status: 'active' as const
      };

      mockHRMSService.getEmployeeData.mockResolvedValue({
        success: true,
        data: hrmsData
      });

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      
      const updatedUser = {
        ...mockUser,
        personalInfo: {
          ...mockUser.personalInfo,
          name: hrmsData.name,
          email: hrmsData.email,
          address: hrmsData.address
        }
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.syncUserFromHRMS('EMP001');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.personalInfo.name).toBe('John HRMS');
      expect(result.data?.personalInfo.email).toBe('john.hrms@lnt.com');
      expect(mockHRMSService.getEmployeeData).toHaveBeenCalledWith('EMP001');
    });

    it('should fail when HRMS data is unavailable', async () => {
      // Arrange
      mockHRMSService.getEmployeeData.mockResolvedValue({
        success: false,
        error: 'Employee not found in HRMS'
      });

      // Act
      const result = await userService.syncUserFromHRMS('EMP001');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found in HRMS');
    });
  });

  describe('addDependent', () => {
    it('should successfully add a dependent', async () => {
      // Arrange
      const dependent = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        dateOfBirth: new Date('1990-01-01'),
        documents: ['doc1.pdf']
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const updatedUser = {
        ...mockUser,
        dependents: [dependent]
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.addDependent('user-123', dependent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.dependents).toHaveLength(1);
      expect(result.data?.dependents[0].name).toBe('Jane Doe');
    });
  });

  describe('removeDependent', () => {
    it('should successfully remove a dependent', async () => {
      // Arrange
      const userWithDependent = {
        ...mockUser,
        dependents: [{
          name: 'Jane Doe',
          relationship: 'Spouse',
          dateOfBirth: new Date('1990-01-01'),
          documents: ['doc1.pdf']
        }]
      };

      mockUserRepository.findById.mockResolvedValue(userWithDependent);
      mockUserRepository.update.mockResolvedValue({ ...userWithDependent, dependents: [] });

      // Act
      const result = await userService.removeDependent('user-123', 'Jane Doe');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.dependents).toHaveLength(0);
    });
  });

  describe('updateBankDetails', () => {
    it('should successfully update bank details with IFSC verification', async () => {
      // Arrange
      const bankDetails = {
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India'
      };

      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: true,
        details: {
          ifsc: 'SBIN0001234',
          bank: 'State Bank of India - Verified',
          branch: 'Main Branch',
          address: '123 Bank Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          rtgs: true,
          neft: true,
          imps: true,
          upi: true
        }
      });

      const updatedUser = {
        ...mockUser,
        bankDetails: {
          ...bankDetails,
          bankName: 'State Bank of India - Verified'
        }
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateBankDetails('user-123', bankDetails);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.bankDetails?.bankName).toBe('State Bank of India - Verified');
      expect(mockIFSCService.verifyIFSC).toHaveBeenCalledWith('SBIN0001234');
    });

    it('should fail with invalid IFSC code', async () => {
      // Arrange
      const bankDetails = {
        accountNumber: '1234567890',
        ifscCode: 'INVALID123',
        bankName: 'Some Bank'
      };

      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: false,
        error: 'Invalid IFSC code format'
      });

      // Act
      const result = await userService.updateBankDetails('user-123', bankDetails);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IFSC code format');
    });
  });

  describe('verifyIFSC', () => {
    it('should successfully verify IFSC code', async () => {
      // Arrange
      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: true,
        details: {
          ifsc: 'SBIN0001234',
          bank: 'State Bank of India',
          branch: 'Main Branch',
          address: '123 Bank Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          rtgs: true,
          neft: true,
          imps: true,
          upi: true
        }
      });

      // Act
      const result = await userService.verifyIFSC('SBIN0001234');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.details?.bank).toBe('State Bank of India');
    });

    it('should return invalid for bad IFSC code', async () => {
      // Arrange
      mockIFSCService.verifyIFSC.mockResolvedValue({
        success: true,
        valid: false,
        error: 'IFSC code not found'
      });

      // Act
      const result = await userService.verifyIFSC('INVALID123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.error).toBe('IFSC code not found');
    });
  });
});