import { Router } from 'express';
import { LockoutController } from '../controllers/lockout.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { USER_ROLES } from '@ltet/shared-constants';

const router = Router();
const lockoutController = new LockoutController();

// Public routes for account unlock
router.get('/status/:employeeId', lockoutController.checkLockoutStatus);
router.post('/request-unlock-otp', lockoutController.requestUnlockOTP);
router.post('/unlock', lockoutController.unlockAccount);

// Admin routes
router.delete('/:userId/clear', 
  authMiddleware.authenticate, 
  authMiddleware.authorize([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN]), 
  lockoutController.clearLockout
);

router.get('/stats', 
  authMiddleware.authenticate, 
  authMiddleware.authorize([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN]), 
  lockoutController.getLockoutStats
);

export { router as lockoutRoutes };