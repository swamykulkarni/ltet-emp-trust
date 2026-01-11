import { Router } from 'express';
import { HRMSIntegrationController } from '../controllers/hrms-integration.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const hrmsIntegrationController = new HRMSIntegrationController();

// All HRMS integration routes require authentication
router.use(authMiddleware);

// Employee data lookup
router.get('/employees/:employeeId', 
  hrmsIntegrationController.getEmployeeData.bind(hrmsIntegrationController)
);

// Synchronization endpoints (admin only)
router.post('/sync/batch', 
  // TODO: Add admin role check middleware
  hrmsIntegrationController.triggerBatchSync.bind(hrmsIntegrationController)
);

router.post('/sync/full', 
  // TODO: Add admin role check middleware
  hrmsIntegrationController.triggerFullSync.bind(hrmsIntegrationController)
);

router.get('/sync/status', 
  // TODO: Add admin role check middleware
  hrmsIntegrationController.getSyncStatus.bind(hrmsIntegrationController)
);

// Connectivity validation
router.get('/connectivity', 
  // TODO: Add admin role check middleware
  hrmsIntegrationController.validateConnectivity.bind(hrmsIntegrationController)
);

export { router as hrmsIntegrationRoutes };