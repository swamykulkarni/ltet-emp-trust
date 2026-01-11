import * as AWS from 'aws-sdk';
import { environment } from '../environments/environment';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';

export class StorageService {
  private s3: AWS.S3;

  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: environment.aws.region,
      accessKeyId: environment.aws.accessKeyId,
      secretAccessKey: environment.aws.secretAccessKey,
    });

    this.s3 = new AWS.S3();
  }

  /**
   * Store file in S3 or local storage
   */
  async storeFile(file: multer.File, documentId: string, version: number = 1): Promise<string> {
    try {
      if (environment.production) {
        return await this.storeFileInS3(file, documentId, version);
      } else {
        return await this.storeFileLocally(file, documentId, version);
      }
    } catch (error) {
      console.error('File storage failed:', error);
      throw new Error(`File storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store file in AWS S3
   */
  private async storeFileInS3(file: multer.File, documentId: string, version: number = 1): Promise<string> {
    const fileExtension = path.extname(file.originalname);
    const key = `documents/${documentId}/v${version}${fileExtension}`;
    
    const params: AWS.S3.PutObjectRequest = {
      Bucket: environment.aws.s3Bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        documentId: documentId,
        version: version.toString(),
        uploadedAt: new Date().toISOString()
      },
      ServerSideEncryption: 'AES256'
    };

    const result = await this.s3.upload(params).promise();
    return `s3://${environment.aws.s3Bucket}/${key}`;
  }

  /**
   * Store file locally (for development)
   */
  private async storeFileLocally(file: multer.File, documentId: string, version: number = 1): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents', documentId);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const fileExtension = path.extname(file.originalname);
    const fileName = `v${version}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);
    
    return filePath;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (filePath.startsWith('s3://')) {
        await this.deleteFileFromS3(filePath);
      } else {
        await this.deleteFileLocally(filePath);
      }
    } catch (error) {
      console.error('File deletion failed:', error);
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from S3
   */
  private async deleteFileFromS3(s3Path: string): Promise<void> {
    const key = s3Path.replace(`s3://${environment.aws.s3Bucket}/`, '');
    
    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: environment.aws.s3Bucket,
      Key: key
    };

    await this.s3.deleteObject(params).promise();
  }

  /**
   * Delete file locally
   */
  private async deleteFileLocally(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * Get file URL for download
   */
  async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (filePath.startsWith('s3://')) {
      return this.getS3FileUrl(filePath, expiresIn);
    } else {
      return this.getLocalFileUrl(filePath);
    }
  }

  /**
   * Get S3 file URL (signed URL)
   */
  private getS3FileUrl(s3Path: string, expiresIn: number): string {
    const key = s3Path.replace(`s3://${environment.aws.s3Bucket}/`, '');
    
    const params = {
      Bucket: environment.aws.s3Bucket,
      Key: key,
      Expires: expiresIn
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  /**
   * Get local file URL
   */
  private getLocalFileUrl(filePath: string): string {
    // In development, return a local file URL
    // This would typically be served by the Express static middleware
    const relativePath = path.relative(path.join(process.cwd(), 'uploads'), filePath);
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Create new version of existing document
   */
  async createDocumentVersion(file: multer.File, documentId: string, version: number): Promise<string> {
    return this.storeFile(file, documentId, version);
  }

  /**
   * List all versions of a document
   */
  async listDocumentVersions(documentId: string): Promise<string[]> {
    if (environment.production) {
      return this.listS3DocumentVersions(documentId);
    } else {
      return this.listLocalDocumentVersions(documentId);
    }
  }

  /**
   * List S3 document versions
   */
  private async listS3DocumentVersions(documentId: string): Promise<string[]> {
    const params = {
      Bucket: environment.aws.s3Bucket,
      Prefix: `documents/${documentId}/`
    };

    const result = await this.s3.listObjectsV2(params).promise();
    return result.Contents?.map(obj => `s3://${environment.aws.s3Bucket}/${obj.Key}`) || [];
  }

  /**
   * List local document versions
   */
  private async listLocalDocumentVersions(documentId: string): Promise<string[]> {
    const documentDir = path.join(process.cwd(), 'uploads', 'documents', documentId);
    
    if (!fs.existsSync(documentDir)) {
      return [];
    }
    
    const files = await fs.promises.readdir(documentDir);
    return files.map(file => path.join(documentDir, file));
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      if (filePath.startsWith('s3://')) {
        return await this.s3FileExists(filePath);
      } else {
        return fs.existsSync(filePath);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if S3 file exists
   */
  private async s3FileExists(s3Path: string): Promise<boolean> {
    try {
      const key = s3Path.replace(`s3://${environment.aws.s3Bucket}/`, '');
      
      const params = {
        Bucket: environment.aws.s3Bucket,
        Key: key
      };

      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<any> {
    if (filePath.startsWith('s3://')) {
      return this.getS3FileMetadata(filePath);
    } else {
      return this.getLocalFileMetadata(filePath);
    }
  }

  /**
   * Get S3 file metadata
   */
  private async getS3FileMetadata(s3Path: string): Promise<any> {
    const key = s3Path.replace(`s3://${environment.aws.s3Bucket}/`, '');
    
    const params = {
      Bucket: environment.aws.s3Bucket,
      Key: key
    };

    const result = await this.s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      metadata: result.Metadata
    };
  }

  /**
   * Get local file metadata
   */
  private async getLocalFileMetadata(filePath: string): Promise<any> {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime,
      contentType: this.getMimeTypeFromExtension(filePath)
    };
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export const storageService = new StorageService();