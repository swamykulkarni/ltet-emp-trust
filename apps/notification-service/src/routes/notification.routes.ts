import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { PreferenceController } from '../controllers/preference.controller';
import { TemplateController } from '../controllers/template.controller';

export function createNotificationRoutes(
  notificationController: NotificationController,
  preferenceController: PreferenceController,
  templateController: TemplateController
): Router {
  const router = Router();

  // Notification endpoints
  router.post('/send', notificationController.sendNotification.bind(notificationController));
  router.post('/send-bulk', notificationController.sendBulkNotification.bind(notificationController));
  router.get('/user/:userId', notificationController.getUserNotifications.bind(notificationController));
  router.put('/:notificationId/read', notificationController.markAsRead.bind(notificationController));
  router.get('/user/:userId/unread-count', notificationController.getUnreadCount.bind(notificationController));
  
  // Admin endpoints
  router.post('/process-pending', notificationController.processPendingNotifications.bind(notificationController));
  router.post('/retry-failed', notificationController.retryFailedNotifications.bind(notificationController));
  router.get('/stats', notificationController.getNotificationStats.bind(notificationController));

  // Preference endpoints
  router.post('/preferences', preferenceController.setPreference.bind(preferenceController));
  router.get('/preferences/:userId', preferenceController.getUserPreferences.bind(preferenceController));
  router.post('/preferences/bulk', preferenceController.setBulkPreferences.bind(preferenceController));
  router.post('/preferences/:userId/reset', preferenceController.resetToDefault.bind(preferenceController));

  // Template endpoints
  router.post('/templates', templateController.createTemplate.bind(templateController));
  router.get('/templates', templateController.getAllTemplates.bind(templateController));
  router.get('/templates/:templateId', templateController.getTemplateById.bind(templateController));
  router.put('/templates/:templateId', templateController.updateTemplate.bind(templateController));
  router.post('/templates/:templateId/render', templateController.renderTemplate.bind(templateController));
  router.post('/templates/initialize-defaults', templateController.initializeDefaultTemplates.bind(templateController));

  return router;
}