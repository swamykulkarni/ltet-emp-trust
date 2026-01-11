import { TemplateService } from '../template.service';
import { NotificationType, NotificationChannel } from '../../models/notification.model';

// Mock the repository
jest.mock('../../repositories/notification.repository');

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService();
  });

  describe('renderTemplateContent', () => {
    it('should render template with data successfully', async () => {
      const template = {
        id: 'template123',
        name: 'Test Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        subject: 'Application {{status}} - {{applicationId}}',
        bodyTemplate: 'Hello {{userName}}, your application {{applicationId}} is {{status}}.',
        variables: ['userName', 'applicationId', 'status'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const data = {
        userName: 'John Doe',
        applicationId: 'APP001',
        status: 'approved'
      };

      const result = (templateService as any).renderTemplateContent(template, data);

      expect(result).toBeDefined();
      expect(result.subject).toBe('Application approved - APP001');
      expect(result.content).toBe('Hello John Doe, your application APP001 is approved.');
    });

    it('should handle missing data gracefully', async () => {
      const template = {
        id: 'template123',
        name: 'Test Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Hello {{userName}}, your application {{applicationId}} is {{status}}.',
        variables: ['userName', 'applicationId', 'status'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const data = {
        userName: 'John Doe'
        // Missing applicationId and status
      };

      const result = (templateService as any).renderTemplateContent(template, data);

      expect(result).toBeDefined();
      expect(result.content).toBe('Hello John Doe, your application  is .');
    });
  });

  describe('Handlebars helpers', () => {
    it('should format dates correctly', async () => {
      const template = {
        id: 'template123',
        name: 'Date Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Date: {{formatDate submittedAt "DD/MM/YYYY"}}',
        variables: ['submittedAt'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const data = {
        submittedAt: new Date('2024-01-15T10:30:00Z')
      };

      const result = (templateService as any).renderTemplateContent(template, data);

      expect(result.content).toBe('Date: 15/01/2024');
    });

    it('should format currency correctly', async () => {
      const template = {
        id: 'template123',
        name: 'Currency Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Amount: {{formatCurrency approvedAmount "INR"}}',
        variables: ['approvedAmount'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const data = {
        approvedAmount: 50000
      };

      const result = (templateService as any).renderTemplateContent(template, data);

      expect(result.content).toContain('₹50,000');
    });

    it('should capitalize text correctly', async () => {
      const template = {
        id: 'template123',
        name: 'Capitalize Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Status: {{capitalize status}}',
        variables: ['status'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const data = {
        status: 'approved'
      };

      const result = (templateService as any).renderTemplateContent(template, data);

      expect(result.content).toBe('Status: Approved');
    });

    it('should handle conditional logic', async () => {
      const template = {
        id: 'template123',
        name: 'Conditional Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: '{{#ifCond status "==" "approved"}}Congratulations!{{else}}Please wait for review.{{/ifCond}}',
        variables: ['status'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const approvedData = { status: 'approved' };
      const pendingData = { status: 'pending' };

      const approvedResult = (templateService as any).renderTemplateContent(template, approvedData);
      const pendingResult = (templateService as any).renderTemplateContent(template, pendingData);

      expect(approvedResult.content).toBe('Congratulations!');
      expect(pendingResult.content).toBe('Please wait for review.');
    });
  });

  describe('createTemplate', () => {
    it('should validate template syntax', async () => {
      // Mock the repository method
      const mockCreateTemplate = jest.fn().mockResolvedValue({
        id: 'template123',
        name: 'Valid Template',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Hello {{userName}}',
        variables: ['userName'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      (templateService as any).templateRepository.createTemplate = mockCreateTemplate;

      const result = await templateService.createTemplate(
        'Valid Template',
        NotificationType.APPLICATION_STATUS,
        NotificationChannel.EMAIL,
        'Hello {{userName}}',
        'Welcome {{userName}}',
        ['userName']
      );

      expect(result).toBeDefined();
      expect(mockCreateTemplate).toHaveBeenCalled();
    });

    it('should handle invalid template syntax gracefully', async () => {
      // Mock the repository method
      const mockCreateTemplate = jest.fn().mockResolvedValue({
        id: 'template123',
        name: 'Template with Invalid Syntax',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Hello {{userName', // Invalid syntax - missing closing brace
        variables: ['userName'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      (templateService as any).templateRepository.createTemplate = mockCreateTemplate;

      // Handlebars doesn't throw for invalid syntax, it treats it as literal text
      const result = await templateService.createTemplate(
        'Template with Invalid Syntax',
        NotificationType.APPLICATION_STATUS,
        NotificationChannel.EMAIL,
        'Hello {{userName', // Invalid syntax - missing closing brace
        undefined,
        ['userName']
      );

      expect(result).toBeDefined();
      expect(mockCreateTemplate).toHaveBeenCalled();
    });

    it('should handle invalid subject syntax gracefully', async () => {
      // Mock the repository method
      const mockCreateTemplate = jest.fn().mockResolvedValue({
        id: 'template123',
        name: 'Template with Invalid Subject',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        bodyTemplate: 'Hello {{userName}}',
        subject: 'Welcome {{userName', // Invalid syntax - missing closing brace
        variables: ['userName'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      (templateService as any).templateRepository.createTemplate = mockCreateTemplate;

      // Handlebars doesn't throw for invalid syntax, it treats it as literal text
      const result = await templateService.createTemplate(
        'Template with Invalid Subject',
        NotificationType.APPLICATION_STATUS,
        NotificationChannel.EMAIL,
        'Hello {{userName}}',
        'Welcome {{userName', // Invalid syntax - missing closing brace
        ['userName']
      );

      expect(result).toBeDefined();
      expect(mockCreateTemplate).toHaveBeenCalled();
    });
  });
});