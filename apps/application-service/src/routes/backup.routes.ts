/**
 * Backup and Disaster Recovery Routes for LTET Employee Trust Portal
 */

import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();
const backupController = new BackupController();

// Initialize backup services
backupController.initialize().catch(console.error);

// Apply authentication middleware to all backup routes
router.use(authMiddleware);

// Backup Management Routes (Admin and System Admin only)
router.post('/create', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.createBackup.bind(backupController)
);

router.get('/list', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.listBackups.bind(backupController)
);

router.get('/statistics', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.getBackupStatistics.bind(backupController)
);

router.get('/:backupId', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.getBackupDetails.bind(backupController)
);

router.post('/restore', 
  roleMiddleware(['system_admin']), 
  backupController.restoreFromBackup.bind(backupController)
);

router.delete('/:backupId', 
  roleMiddleware(['system_admin']), 
  backupController.deleteBackup.bind(backupController)
);

router.post('/:backupId/verify', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.verifyBackup.bind(backupController)
);

// Disaster Recovery Routes (System Admin only)
router.get('/dr/status', 
  roleMiddleware(['system_admin']), 
  backupController.getDRStatus.bind(backupController)
);

router.post('/dr/failover', 
  roleMiddleware(['system_admin']), 
  backupController.initiateFailover.bind(backupController)
);

router.post('/dr/test-failover', 
  roleMiddleware(['system_admin']), 
  backupController.testFailover.bind(backupController)
);

router.post('/dr/recover', 
  roleMiddleware(['system_admin']), 
  backupController.performDisasterRecovery.bind(backupController)
);

router.get('/dr/health-history', 
  roleMiddleware(['admin', 'system_admin']), 
  backupController.getHealthHistory.bind(backupController)
);

export default router;