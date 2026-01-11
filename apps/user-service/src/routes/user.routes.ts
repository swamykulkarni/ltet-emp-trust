import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { USER_ROLES } from '@ltet/shared-constants';

const router = Router();
const userController = new UserController();

// Protected routes - user profile management
router.get('/profile', authMiddleware.authenticate, userController.getProfile);
router.put('/profile', authMiddleware.authenticate, userController.updateProfile);
router.post('/profile/sync-hrms', authMiddleware.authenticate, userController.syncFromHRMS);

// Dependent management
router.post('/dependents', authMiddleware.authenticate, userController.addDependent);
router.delete('/dependents/:dependentName', authMiddleware.authenticate, userController.removeDependent);

// Bank details management
router.put('/bank-details', authMiddleware.authenticate, userController.updateBankDetails);
router.get('/verify-ifsc/:ifscCode', userController.verifyIFSC);

// Admin routes - user management
router.get('/:userId', 
  authMiddleware.authenticate, 
  authMiddleware.canAccessUserResource, 
  userController.getUserById
);

router.put('/:userId', 
  authMiddleware.authenticate, 
  authMiddleware.authorize([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN]), 
  userController.updateUserProfile
);

router.get('/employee/:employeeId', 
  authMiddleware.authenticate, 
  authMiddleware.authorize([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.APPROVER, USER_ROLES.FINANCE]), 
  userController.getUserByEmployeeId
);

export { router as userRoutes };