import Handlebars from 'handlebars';
import { 
  NotificationTemplate, 
  NotificationType, 
  NotificationChannel 
} from '../models/notification.model';
import { NotificationTemplateRepository } from '../repositories/notification.repository';

export interface TemplateRenderResult {
  subject?: string;
  content: string;
}

export class TemplateService {
  private templateRepository: NotificationTemplateRepository;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.templateRepository = new NotificationTemplateRepository();
    this.registerHelpers();
  }

  async renderTemplate(
    templateId: string,
    data: Record<string, any>
  ): Promise<TemplateRenderResult | null> {
    try {
      const template = await this.templateRepository.getTemplateById(templateId);
      if (!template || !template.isActive) {
        return null;
      }

      return this.renderTemplateContent(template, data);
    } catch (error) {
      console.error('Failed to render template:', error);
      return null;
    }
  }

  async renderTemplateByType(
    type: NotificationType,
    channel: NotificationChannel,
    data: Record<string, any>
  ): Promise<TemplateRenderResult | null> {
    try {
      const template = await this.templateRepository.getTemplateByTypeAndChannel(type, channel);
      if (!template || !template.isActive) {
        return null;
      }

      return this.renderTemplateContent(template, data);
    } catch (error) {
      console.error('Failed to render template by type:', error);
      return null;
    }
  }

  private renderTemplateContent(
    template: NotificationTemplate,
    data: Record<string, any>
  ): TemplateRenderResult {
    const cacheKey = `${template.id}_${template.updatedAt.getTime()}`;
    
    let compiledTemplate = this.compiledTemplates.get(cacheKey);
    if (!compiledTemplate) {
      compiledTemplate = Handlebars.compile(template.bodyTemplate);
      this.compiledTemplates.set(cacheKey, compiledTemplate);
      
      // Clean up old cached templates (keep only last 100)
      if (this.compiledTemplates.size > 100) {
        const firstKey = this.compiledTemplates.keys().next().value;
        if (firstKey) {
          this.compiledTemplates.delete(firstKey);
        }
      }
    }

    const content = compiledTemplate(data);
    
    let subject: string | undefined;
    if (template.subject) {
      const compiledSubject = Handlebars.compile(template.subject);
      subject = compiledSubject(data);
    }

    return { subject, content };
  }

  async createTemplate(
    name: string,
    type: NotificationType,
    channel: NotificationChannel,
    bodyTemplate: string,
    subject?: string,
    variables: string[] = []
  ): Promise<NotificationTemplate> {
    // Validate template syntax
    try {
      Handlebars.compile(bodyTemplate);
      if (subject) {
        Handlebars.compile(subject);
      }
    } catch (error) {
      throw new Error(`Invalid template syntax: ${error}`);
    }

    return this.templateRepository.createTemplate({
      name,
      type,
      channel,
      subject,
      bodyTemplate,
      variables,
      isActive: true
    });
  }

  async updateTemplate(
    id: string,
    updates: Partial<NotificationTemplate>
  ): Promise<void> {
    // Validate template syntax if bodyTemplate or subject is being updated
    if (updates.bodyTemplate) {
      try {
        Handlebars.compile(updates.bodyTemplate);
      } catch (error) {
        throw new Error(`Invalid body template syntax: ${error}`);
      }
    }

    if (updates.subject) {
      try {
        Handlebars.compile(updates.subject);
      } catch (error) {
        throw new Error(`Invalid subject template syntax: ${error}`);
      }
    }

    await this.templateRepository.updateTemplate(id, updates);
    
    // Clear cached compiled templates for this template
    for (const key of this.compiledTemplates.keys()) {
      if (key.startsWith(id)) {
        this.compiledTemplates.delete(key);
      }
    }
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    return this.templateRepository.getAllTemplates();
  }

  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    return this.templateRepository.getTemplateById(id);
  }

  private registerHelpers(): void {
    // Register custom Handlebars helpers
    Handlebars.registerHelper('formatDate', (date: Date, format: string = 'YYYY-MM-DD') => {
      if (!date) return '';
      
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      switch (format) {
        case 'YYYY-MM-DD':
          return `${year}-${month}-${day}`;
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'DD-MM-YYYY HH:mm':
          return `${day}-${month}-${year} ${hours}:${minutes}`;
        default:
          return d.toLocaleDateString();
      }
    });

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'INR') => {
      if (typeof amount !== 'number') return '';
      
      // Handle case where currency might be passed as an object from Handlebars
      const currencyCode = typeof currency === 'string' ? currency : 'INR';
      
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    Handlebars.registerHelper('ifCond', (v1: any, operator: string, v2: any, options: any) => {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '===':
          return (v1 === v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '!=':
          return (v1 != v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '!==':
          return (v1 !== v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '<':
          return (v1 < v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '<=':
          return (v1 <= v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '>':
          return (v1 > v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '>=':
          return (v1 >= v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '&&':
          return (v1 && v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        case '||':
          return (v1 || v2) ? options.fn(options.data?.root) : options.inverse(options.data?.root);
        default:
          return options.inverse(options.data?.root);
      }
    });
  }

  // Initialize default templates
  async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      // Application Status Templates
      {
        name: 'Application Submitted - Email',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.EMAIL,
        subject: 'Application Submitted - {{applicationId}}',
        bodyTemplate: `
          <h2>Application Submitted Successfully</h2>
          <p>Dear {{userName}},</p>
          <p>Your application for <strong>{{schemeName}}</strong> has been submitted successfully.</p>
          <p><strong>Application Details:</strong></p>
          <ul>
            <li>Application ID: {{applicationId}}</li>
            <li>Scheme: {{schemeName}}</li>
            <li>Amount: {{formatCurrency claimAmount}}</li>
            <li>Submitted On: {{formatDate submittedAt 'DD-MM-YYYY HH:mm'}}</li>
          </ul>
          <p>You can track your application status in the portal.</p>
          <p>Best regards,<br>LTET Portal Team</p>
        `,
        variables: ['userName', 'applicationId', 'schemeName', 'claimAmount', 'submittedAt']
      },
      {
        name: 'Application Approved - SMS',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.SMS,
        bodyTemplate: 'Good news! Your application {{applicationId}} for {{schemeName}} has been approved. Amount: {{formatCurrency approvedAmount}}. Check portal for details.',
        variables: ['applicationId', 'schemeName', 'approvedAmount']
      },
      {
        name: 'Application Status - In-App',
        type: NotificationType.APPLICATION_STATUS,
        channel: NotificationChannel.IN_APP,
        bodyTemplate: 'Your application {{applicationId}} status has been updated to: {{status}}',
        variables: ['applicationId', 'status']
      },
      // Scheme Deadline Templates
      {
        name: 'Scheme Deadline Reminder - Email',
        type: NotificationType.SCHEME_DEADLINE,
        channel: NotificationChannel.EMAIL,
        subject: 'Reminder: {{schemeName}} deadline approaching',
        bodyTemplate: `
          <h2>Scheme Deadline Reminder</h2>
          <p>Dear {{userName}},</p>
          <p>This is a reminder that the application deadline for <strong>{{schemeName}}</strong> is approaching.</p>
          <p><strong>Deadline:</strong> {{formatDate deadline 'DD-MM-YYYY'}}</p>
          <p><strong>Days Remaining:</strong> {{daysRemaining}}</p>
          <p>Don't miss out on this opportunity. Apply now through the LTET portal.</p>
          <p>Best regards,<br>LTET Portal Team</p>
        `,
        variables: ['userName', 'schemeName', 'deadline', 'daysRemaining']
      },
      // System Maintenance Templates
      {
        name: 'System Maintenance - Email',
        type: NotificationType.SYSTEM_MAINTENANCE,
        channel: NotificationChannel.EMAIL,
        subject: 'Scheduled System Maintenance - {{maintenanceDate}}',
        bodyTemplate: `
          <h2>Scheduled System Maintenance</h2>
          <p>Dear User,</p>
          <p>We will be performing scheduled maintenance on the LTET portal.</p>
          <p><strong>Maintenance Window:</strong></p>
          <ul>
            <li>Start: {{formatDate startTime 'DD-MM-YYYY HH:mm'}}</li>
            <li>End: {{formatDate endTime 'DD-MM-YYYY HH:mm'}}</li>
            <li>Duration: {{duration}}</li>
          </ul>
          <p>During this time, the portal will be temporarily unavailable.</p>
          <p>We apologize for any inconvenience.</p>
          <p>Best regards,<br>LTET Portal Team</p>
        `,
        variables: ['startTime', 'endTime', 'duration']
      }
    ];

    for (const template of defaultTemplates) {
      try {
        const existing = await this.templateRepository.getTemplateByTypeAndChannel(
          template.type as NotificationType,
          template.channel as NotificationChannel
        );
        
        if (!existing) {
          await this.createTemplate(
            template.name,
            template.type as NotificationType,
            template.channel as NotificationChannel,
            template.bodyTemplate,
            template.subject,
            template.variables
          );
          console.log(`Created default template: ${template.name}`);
        }
      } catch (error) {
        console.error(`Failed to create default template ${template.name}:`, error);
      }
    }
  }
}