import { Router } from 'express';
import { IntegrationHealthController } from '../controllers/integration-health.controller';

const router = Router();
const healthController = new IntegrationHealthController();

// Health status endpoints
router.get('/status', healthController.getHealthStatus.bind(healthController));
router.get('/metrics', healthController.getHealthMetrics.bind(healthController));
router.get('/history', healthController.getHealthHistory.bind(healthController));

// Alert management endpoints
router.get('/alerts', healthController.getActiveAlerts.bind(healthController));
router.get('/alerts/all', healthController.getAllAlerts.bind(healthController));
router.post('/alerts/:alertIndex/resolve', healthController.resolveAlert.bind(healthController));

// Connectivity testing
router.get('/connectivity', healthController.testConnectivity.bind(healthController));

export { router as integrationHealthRoutes };