import { Router } from 'express';
import { SchemeController } from '../controllers/scheme.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();
const schemeController = new SchemeController();

// Apply authentication to all routes
router.use(authenticateToken);

// Scheme CRUD operations
router.post('/', requireRole(['admin']), schemeController.createScheme);
router.get('/', schemeController.getSchemes);
router.get('/eligible', schemeController.getEligibleSchemes);
router.get('/statistics', requireRole(['admin', 'head']), schemeController.getSchemeStatistics);
router.get('/:schemeId', schemeController.getSchemeById);
router.put('/:schemeId', requireRole(['admin']), schemeController.updateScheme);
router.delete('/:schemeId', requireRole(['admin']), schemeController.deleteScheme);

// Scheme publishing
router.post('/:schemeId/publish', requireRole(['admin']), schemeController.publishScheme);

// Scheme versioning
router.get('/:schemeId/versions', requireRole(['admin']), schemeController.getSchemeVersions);

// Rule builder APIs
router.get('/rules/builder', requireRole(['admin']), schemeController.createRuleBuilder);
router.get('/rules/types', requireRole(['admin']), schemeController.getAvailableRuleTypes);
router.put('/:schemeId/rules', requireRole(['admin']), schemeController.updateEligibilityRules);

// Eligibility checking
router.get('/:schemeId/eligibility', schemeController.checkEligibility);

export default router;