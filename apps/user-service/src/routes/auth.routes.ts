import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.post('/logout', authMiddleware.authenticate, authController.logout);
router.post('/change-password', authMiddleware.authenticate, authController.changePassword);
router.get('/verify-token', authMiddleware.authenticate, authController.verifyToken);

export { router as authRoutes };