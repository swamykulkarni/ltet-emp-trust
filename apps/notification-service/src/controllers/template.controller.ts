import { Request, Response } from 'express';
import { TemplateService } from '../services/template.service';
import { 
  NotificationChannel,
  NotificationType
} from '../models/notification.model';
import Joi from 'joi';

export class TemplateController {
  private templateService: TemplateService;

  constructor(templateService: TemplateService) {
    this.templateService = templateService;
  }

  // Create new template
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid(...Object.values(NotificationType)).required(),
        channel: Joi.string().valid(...Object.values(NotificationChannel)).required(),
        subject: Joi.string().optional(),
        bodyTemplate: Joi.string().required(),
        variables: Joi.array().items(Joi.string()).default([])
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { name, type, channel, subject, bodyTemplate, variables } = value;

      const template = await this.templateService.createTemplate(
        name,
        type,
        channel,
        bodyTemplate,
        subject,
        variables
      );

      res.status(201).json({
        success: true,
        template,
        message: 'Template created successfully'
      });
    } catch (error: any) {
      console.error('Failed to create template:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create template'
      });
    }
  }

  // Get all templates
  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await this.templateService.getAllTemplates();

      res.json({
        success: true,
        templates,
        count: templates.length
      });
    } catch (error: any) {
      console.error('Failed to get templates:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get templates'
      });
    }
  }

  // Get template by ID
  async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        templateId: Joi.string().uuid().required()
      });

      const { error, value } = schema.validate({
        templateId: req.params.templateId
      });

      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { templateId } = value;
      const template = await this.templateService.getTemplateById(templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        template
      });
    } catch (error: any) {
      console.error('Failed to get template:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get template'
      });
    }
  }

  // Update template
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const paramsSchema = Joi.object({
        templateId: Joi.string().uuid().required()
      });

      const bodySchema = Joi.object({
        name: Joi.string().optional(),
        subject: Joi.string().optional(),
        bodyTemplate: Joi.string().optional(),
        variables: Joi.array().items(Joi.string()).optional(),
        isActive: Joi.boolean().optional()
      });

      const { error: paramsError, value: paramsValue } = paramsSchema.validate({
        templateId: req.params.templateId
      });

      if (paramsError) {
        res.status(400).json({ error: paramsError.details[0].message });
        return;
      }

      const { error: bodyError, value: bodyValue } = bodySchema.validate(req.body);

      if (bodyError) {
        res.status(400).json({ error: bodyError.details[0].message });
        return;
      }

      const { templateId } = paramsValue;

      // Check if template exists
      const existingTemplate = await this.templateService.getTemplateById(templateId);
      if (!existingTemplate) {
        res.status(404).json({
          success: false,
          error: 'Template not found'
        });
        return;
      }

      await this.templateService.updateTemplate(templateId, bodyValue);

      res.json({
        success: true,
        message: 'Template updated successfully'
      });
    } catch (error: any) {
      console.error('Failed to update template:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update template'
      });
    }
  }

  // Render template (for testing)
  async renderTemplate(req: Request, res: Response): Promise<void> {
    try {
      const paramsSchema = Joi.object({
        templateId: Joi.string().uuid().required()
      });

      const bodySchema = Joi.object({
        data: Joi.object().default({})
      });

      const { error: paramsError, value: paramsValue } = paramsSchema.validate({
        templateId: req.params.templateId
      });

      if (paramsError) {
        res.status(400).json({ error: paramsError.details[0].message });
        return;
      }

      const { error: bodyError, value: bodyValue } = bodySchema.validate(req.body);

      if (bodyError) {
        res.status(400).json({ error: bodyError.details[0].message });
        return;
      }

      const { templateId } = paramsValue;
      const { data } = bodyValue;

      const result = await this.templateService.renderTemplate(templateId, data);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Template not found or inactive'
        });
        return;
      }

      res.json({
        success: true,
        rendered: result
      });
    } catch (error: any) {
      console.error('Failed to render template:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to render template'
      });
    }
  }

  // Initialize default templates (admin endpoint)
  async initializeDefaultTemplates(req: Request, res: Response): Promise<void> {
    try {
      await this.templateService.initializeDefaultTemplates();

      res.json({
        success: true,
        message: 'Default templates initialized successfully'
      });
    } catch (error: any) {
      console.error('Failed to initialize default templates:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to initialize default templates'
      });
    }
  }
}