import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UpdateUserRequest } from '../models/user.model';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await this.userService.getUserById(req.user.userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Profile retrieved successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const result = await this.userService.getUserById(userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'User retrieved successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  getUserByEmployeeId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId } = req.params;
      const result = await this.userService.getUserByEmployeeId(employeeId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'User retrieved successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const updateData: UpdateUserRequest = req.body;
      const result = await this.userService.updateUserProfile(req.user.userId, updateData);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Profile updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  updateUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updateData: UpdateUserRequest = req.body;
      const result = await this.userService.updateUserProfile(userId, updateData);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'User profile updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  syncFromHRMS = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await this.userService.syncUserFromHRMS(req.user.employeeId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Profile synced from HRMS successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  addDependent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { name, relationship, dateOfBirth, documents } = req.body;

      if (!name || !relationship || !dateOfBirth) {
        res.status(400).json({
          success: false,
          error: 'Name, relationship, and date of birth are required'
        });
        return;
      }

      const dependent = {
        name,
        relationship,
        dateOfBirth: new Date(dateOfBirth),
        documents: documents || []
      };

      const result = await this.userService.addDependent(req.user.userId, dependent);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Dependent added successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  removeDependent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { dependentName } = req.params;
      const result = await this.userService.removeDependent(req.user.userId, dependentName);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Dependent removed successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  updateBankDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { accountNumber, ifscCode, bankName } = req.body;

      if (!accountNumber || !ifscCode || !bankName) {
        res.status(400).json({
          success: false,
          error: 'Account number, IFSC code, and bank name are required'
        });
        return;
      }

      const bankDetails = { accountNumber, ifscCode, bankName };
      const result = await this.userService.updateBankDetails(req.user.userId, bankDetails);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'Bank details updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  verifyIFSC = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ifscCode } = req.params;

      if (!ifscCode) {
        res.status(400).json({
          success: false,
          error: 'IFSC code is required'
        });
        return;
      }

      const result = await this.userService.verifyIFSC(ifscCode);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: 'IFSC verification completed'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}