import { Router } from 'express';
import { SchemeDiscoveryController } from '../controllers/scheme-discovery.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const discoveryController = new SchemeDiscoveryController();

// Apply authentication to all routes
router.use(authenticateToken);

// Scheme discovery endpoints
router.get('/discover', discoveryController.discoverSchemes);
router.get('/search', discoveryController.searchSchemes);
router.get('/recommendations', discoveryController.getSchemeRecommendations);
router.get('/categories', discoveryController.getSchemeCategories);
router.get('/updates', discoveryController.getSchemeUpdates);

// Detailed scheme information
router.get('/:schemeId/detail', discoveryController.getSchemeDetail);

export default router;