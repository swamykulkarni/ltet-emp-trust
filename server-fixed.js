const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'LTET Employee Trust Portal',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mock Authentication API
app.post('/api/auth/login', (req, res) => {
  const { employeeId, password } = req.body;
  
  // Demo credentials
  const validCredentials = [
    { employeeId: 'AB123456', password: 'demo123', name: 'Rajesh Kumar', role: 'employee' },
    { employeeId: 'CD789012', password: 'admin123', name: 'Priya Sharma', role: 'admin' },
    { employeeId: 'EF345678', password: 'approver123', name: 'Amit Singh', role: 'approver' }
  ];
  
  const user = validCredentials.find(u => u.employeeId === employeeId && u.password === password);
  
  if (user) {
    const token = `mock-jwt-token-${Date.now()}`;
    res.json({
      success: true,
      token,
      user: {
        userId: `user_${user.employeeId}`,
        employeeId: user.employeeId,
        personalInfo: {
          name: user.name,
          email: `${user.employeeId.toLowerCase()}@lnt.com`,
          phone: '+91 98765 43210',
          department: 'Engineering',
          designation: 'Senior Engineer',
          ic: 'L&T Technology Services'
        },
        role: user.role,
        permissions: user.role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write']
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Mock User Profile API
app.get('/api/users/:userId/profile', (req, res) => {
  const { userId } = req.params;
  
  res.json({
    userId,
    personalInfo: {
      name: 'Rajesh Kumar',
      email: 'ab123456@lnt.com',
      phone: '+91 98765 43210',
      department: 'Engineering',
      designation: 'Senior Engineer',
      ic: 'L&T Technology Services',
      employeeId: 'AB123456',
      dateOfJoining: '2020-01-15',
      location: 'Chennai'
    },
    bankDetails: {
      accountNumber: '****1234',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branchName: 'Chennai Main Branch'
    },
    dependents: [
      {
        id: 'dep_1',
        name: 'Kavya Kumar',
        relationship: 'Spouse',
        dateOfBirth: '1992-05-20',
        documents: ['marriage_certificate.pdf']
      },
      {
        id: 'dep_2',
        name: 'Arjun Kumar',
        relationship: 'Child',
        dateOfBirth: '2018-08-15',
        documents: ['birth_certificate.pdf']
      }
    ]
  });
});

// Mock Schemes API
app.get('/api/schemes', (req, res) => {
  const schemes = [
    {
      id: 'scheme_medical_1',
      title: 'Medical Reimbursement',
      category: 'Medical',
      description: 'Reimbursement for medical expenses incurred by employee and dependents',
      maxAmount: 50000,
      eligibility: ['All permanent employees', 'Dependents covered'],
      documents: ['Medical bills', 'Prescription', 'Discharge summary'],
      deadline: '2024-03-31',
      status: 'active',
      applicationCount: 1250,
      approvalRate: 92
    },
    {
      id: 'scheme_education_1',
      title: 'Education Loan Assistance',
      category: 'Education',
      description: 'Financial assistance for higher education of employee children',
      maxAmount: 200000,
      eligibility: ['Children pursuing higher education', 'Age limit: 25 years'],
      documents: ['Admission letter', 'Fee structure', 'Academic records'],
      deadline: '2024-06-30',
      status: 'active',
      applicationCount: 450,
      approvalRate: 88
    },
    {
      id: 'scheme_skill_1',
      title: 'Skill Development Program',
      category: 'Skill Building',
      description: 'Certification and training programs for professional development',
      maxAmount: 75000,
      eligibility: ['All employees', 'Relevant to job role'],
      documents: ['Course details', 'Certification body approval'],
      deadline: '2024-12-31',
      status: 'active',
      applicationCount: 890,
      approvalRate: 95
    },
    {
      id: 'scheme_emergency_1',
      title: 'Emergency Financial Aid',
      category: 'Emergency',
      description: 'Immediate financial assistance for emergency situations',
      maxAmount: 100000,
      eligibility: ['All employees', 'Emergency situations only'],
      documents: ['Emergency proof', 'Supporting documents'],
      deadline: 'No deadline',
      status: 'active',
      applicationCount: 125,
      approvalRate: 78
    }
  ];
  
  res.json({
    success: true,
    schemes,
    total: schemes.length
  });
});

// Mock Applications API - Role-based data
app.get('/api/applications', (req, res) => {
  const userRole = req.headers['x-user-role'] || 'employee';
  const userId = req.headers['x-user-id'] || 'user_AB123456';
  
  // Employee applications
  const employeeApplications = [
    {
      id: 'app_001',
      schemeId: 'scheme_medical_1',
      schemeName: 'Medical Reimbursement',
      applicantName: 'Rajesh Kumar',
      applicantId: 'AB123456',
      amount: 25000,
      status: 'approved',
      submittedDate: '2024-01-15',
      lastUpdated: '2024-01-20',
      documents: ['medical_bill.pdf', 'prescription.pdf'],
      approver: 'Amit Singh',
      timeline: [
        { status: 'submitted', date: '2024-01-15', comment: 'Application submitted', user: 'Rajesh Kumar' },
        { status: 'under_review', date: '2024-01-16', comment: 'Under review by approver', user: 'Amit Singh' },
        { status: 'approved', date: '2024-01-20', comment: 'Approved for full amount', user: 'Amit Singh' }
      ]
    },
    {
      id: 'app_002',
      schemeId: 'scheme_education_1',
      schemeName: 'Education Loan Assistance',
      applicantName: 'Rajesh Kumar',
      applicantId: 'AB123456',
      amount: 150000,
      status: 'under_review',
      submittedDate: '2024-01-25',
      lastUpdated: '2024-01-26',
      documents: ['admission_letter.pdf', 'fee_structure.pdf'],
      approver: 'Amit Singh',
      timeline: [
        { status: 'submitted', date: '2024-01-25', comment: 'Application submitted', user: 'Rajesh Kumar' },
        { status: 'under_review', date: '2024-01-26', comment: 'Document verification in progress', user: 'Amit Singh' }
      ]
    }
  ];
  
  // Approver applications (all pending applications)
  const approverApplications = [
    ...employeeApplications.filter(app => app.status === 'under_review'),
    {
      id: 'app_003',
      schemeId: 'scheme_skill_1',
      schemeName: 'Skill Development Program',
      applicantName: 'Priya Sharma',
      applicantId: 'CD789012',
      amount: 45000,
      status: 'submitted',
      submittedDate: '2024-01-28',
      lastUpdated: '2024-01-28',
      documents: ['course_details.pdf', 'certification_info.pdf'],
      priority: 'high',
      timeline: [
        { status: 'submitted', date: '2024-01-28', comment: 'Application submitted', user: 'Priya Sharma' }
      ]
    },
    {
      id: 'app_004',
      schemeId: 'scheme_medical_1',
      schemeName: 'Medical Reimbursement',
      applicantName: 'Suresh Patel',
      applicantId: 'GH901234',
      amount: 35000,
      status: 'needs_clarification',
      submittedDate: '2024-01-20',
      lastUpdated: '2024-01-27',
      documents: ['medical_bill.pdf'],
      priority: 'medium',
      timeline: [
        { status: 'submitted', date: '2024-01-20', comment: 'Application submitted', user: 'Suresh Patel' },
        { status: 'under_review', date: '2024-01-22', comment: 'Under review', user: 'Amit Singh' },
        { status: 'needs_clarification', date: '2024-01-27', comment: 'Additional documents required', user: 'Amit Singh' }
      ]
    }
  ];
  
  // Admin applications (all applications)
  const adminApplications = [
    ...employeeApplications,
    ...approverApplications.filter(app => !employeeApplications.find(ea => ea.id === app.id)),
    {
      id: 'app_005',
      schemeId: 'scheme_emergency_1',
      schemeName: 'Emergency Financial Aid',
      applicantName: 'Kavita Reddy',
      applicantId: 'IJ567890',
      amount: 75000,
      status: 'approved',
      submittedDate: '2024-01-10',
      lastUpdated: '2024-01-12',
      documents: ['emergency_proof.pdf', 'medical_emergency.pdf'],
      approver: 'Amit Singh',
      timeline: [
        { status: 'submitted', date: '2024-01-10', comment: 'Emergency application submitted', user: 'Kavita Reddy' },
        { status: 'approved', date: '2024-01-12', comment: 'Emergency approval granted', user: 'Amit Singh' }
      ]
    }
  ];
  
  let applications;
  if (userRole === 'approver') {
    applications = approverApplications;
  } else if (userRole === 'admin') {
    applications = adminApplications;
  } else {
    applications = employeeApplications;
  }
  
  res.json({
    success: true,
    applications,
    total: applications.length,
    role: userRole
  });
});

// Mock Application Submission - Enhanced
app.post('/api/applications', (req, res) => {
  const { 
    schemeId, 
    amount, 
    documents, 
    personalInfo, 
    applicationData,
    beneficiaryInfo,
    step 
  } = req.body;
  
  const userId = req.headers['x-user-id'] || 'user_AB123456';
  
  // If this is a draft save (step provided), save as draft
  if (step && step < 4) {
    const draftApplication = {
      id: `draft_${Date.now()}`,
      userId,
      schemeId,
      currentStep: step,
      applicationData: applicationData || {},
      personalInfo: personalInfo || {},
      beneficiaryInfo: beneficiaryInfo || {},
      documents: documents || [],
      status: 'draft',
      lastSaved: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    return res.json({
      success: true,
      application: draftApplication,
      message: 'Application draft saved successfully'
    });
  }
  
  // Full application submission
  const newApplication = {
    id: `app_${Date.now()}`,
    userId,
    schemeId,
    schemeName: getSchemeNameById(schemeId),
    applicantName: personalInfo?.name || 'Rajesh Kumar',
    applicantId: personalInfo?.employeeId || 'AB123456',
    amount: amount || applicationData?.claimAmount,
    applicationData: {
      claimAmount: amount || applicationData?.claimAmount,
      purpose: applicationData?.purpose || 'Medical treatment',
      beneficiary: beneficiaryInfo?.name || personalInfo?.name,
      treatmentDetails: applicationData?.treatmentDetails,
      hospitalName: applicationData?.hospitalName,
      treatmentDate: applicationData?.treatmentDate,
      customFields: applicationData?.customFields || {}
    },
    beneficiaryInfo: beneficiaryInfo || {
      name: personalInfo?.name,
      relationship: 'Self',
      age: 35
    },
    status: 'submitted',
    submittedDate: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString().split('T')[0],
    documents: documents || [],
    approver: 'Amit Singh',
    priority: amount > 50000 ? 'high' : amount > 25000 ? 'medium' : 'low',
    timeline: [
      { 
        status: 'submitted', 
        date: new Date().toISOString().split('T')[0], 
        comment: 'Application submitted successfully',
        user: personalInfo?.name || 'Rajesh Kumar'
      }
    ],
    workflow: {
      currentStatus: 'submitted',
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days
      escalationLevel: 0
    }
  };
  
  res.json({
    success: true,
    application: newApplication,
    message: 'Application submitted successfully'
  });
});

// Helper function to get scheme name by ID
function getSchemeNameById(schemeId) {
  const schemeNames = {
    'scheme_medical_1': 'Medical Reimbursement',
    'scheme_education_1': 'Education Loan Assistance',
    'scheme_skill_1': 'Skill Development Program',
    'scheme_emergency_1': 'Emergency Financial Aid'
  };
  return schemeNames[schemeId] || 'Unknown Scheme';
}

// Get Application Drafts
app.get('/api/applications/drafts', (req, res) => {
  const userId = req.headers['x-user-id'] || 'user_AB123456';
  
  // Mock draft applications
  const drafts = [
    {
      id: 'draft_001',
      userId,
      schemeId: 'scheme_medical_1',
      schemeName: 'Medical Reimbursement',
      currentStep: 2,
      applicationData: {
        claimAmount: 15000,
        purpose: 'Dental treatment',
        treatmentDate: '2024-01-20'
      },
      lastSaved: '2024-01-28T10:30:00Z',
      expiresAt: '2024-02-04T10:30:00Z'
    }
  ];
  
  res.json({
    success: true,
    drafts: drafts.filter(d => d.userId === userId),
    total: drafts.length
  });
});

// Resume Draft Application
app.get('/api/applications/drafts/:id', (req, res) => {
  const { id } = req.params;
  
  // Mock draft data
  const draft = {
    id,
    schemeId: 'scheme_medical_1',
    schemeName: 'Medical Reimbursement',
    currentStep: 2,
    applicationData: {
      claimAmount: 15000,
      purpose: 'Dental treatment',
      treatmentDate: '2024-01-20',
      hospitalName: 'Apollo Hospital'
    },
    personalInfo: {
      name: 'Rajesh Kumar',
      employeeId: 'AB123456',
      department: 'Engineering'
    },
    beneficiaryInfo: {
      name: 'Rajesh Kumar',
      relationship: 'Self',
      age: 35
    },
    documents: []
  };
  
  res.json({
    success: true,
    draft
  });
});

// Mock Application Approval (Approver only)
app.put('/api/applications/:id/approve', (req, res) => {
  const { id } = req.params;
  const { decision, comments, amount } = req.body;
  
  // Simulate approval process
  setTimeout(() => {
    res.json({
      success: true,
      application: {
        id,
        status: decision, // 'approved', 'rejected', 'needs_clarification'
        approverComments: comments,
        approvedAmount: amount,
        approvedDate: new Date().toISOString().split('T')[0],
        approver: 'Amit Singh'
      },
      message: `Application ${decision} successfully`
    });
  }, 1000);
});

// Mock Application Details
app.get('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  
  const applicationDetails = {
    id,
    schemeId: 'scheme_medical_1',
    schemeName: 'Medical Reimbursement',
    applicantName: 'Rajesh Kumar',
    applicantId: 'AB123456',
    amount: 25000,
    status: 'under_review',
    submittedDate: '2024-01-25',
    lastUpdated: '2024-01-26',
    documents: [
      { name: 'medical_bill.pdf', size: '2.3 MB', uploadDate: '2024-01-25' },
      { name: 'prescription.pdf', size: '1.1 MB', uploadDate: '2024-01-25' }
    ],
    applicantDetails: {
      employeeId: 'AB123456',
      name: 'Rajesh Kumar',
      department: 'Engineering',
      designation: 'Senior Engineer',
      email: 'rajesh.kumar@lnt.com',
      phone: '+91 98765 43210'
    },
    schemeDetails: {
      maxAmount: 50000,
      eligibility: ['All permanent employees', 'Dependents covered'],
      requiredDocuments: ['Medical bills', 'Prescription', 'Discharge summary']
    },
    timeline: [
      { status: 'submitted', date: '2024-01-25', comment: 'Application submitted', user: 'Rajesh Kumar' },
      { status: 'under_review', date: '2024-01-26', comment: 'Document verification in progress', user: 'Amit Singh' }
    ]
  };
  
  res.json({
    success: true,
    application: applicationDetails
  });
});

// Mock Admin Analytics API
app.get('/api/admin/analytics', (req, res) => {
  res.json({
    success: true,
    analytics: {
      totalApplications: 2715,
      pendingReview: 245,
      approvedThisMonth: 189,
      totalDisbursed: 12500000,
      schemeUtilization: [
        { scheme: 'Medical Reimbursement', applications: 1250, amount: 5200000 },
        { scheme: 'Education Loan', applications: 450, amount: 4800000 },
        { scheme: 'Skill Development', applications: 890, amount: 2100000 },
        { scheme: 'Emergency Aid', applications: 125, amount: 400000 }
      ],
      monthlyTrends: [
        { month: 'Jan', applications: 220, amount: 1100000 },
        { month: 'Feb', applications: 195, amount: 980000 },
        { month: 'Mar', applications: 245, amount: 1250000 },
        { month: 'Apr', applications: 210, amount: 1050000 }
      ]
    }
  });
});

// Mock Document Upload - Enhanced
app.post('/api/documents/upload', (req, res) => {
  const { filename, size, fileType, applicationId } = req.body;
  
  // Validate file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (fileType && !allowedTypes.includes(fileType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Only PDF, JPG, and PNG files are allowed.'
    });
  }
  
  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (size && size > maxSize) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds 5MB limit. Please compress your file and try again.'
    });
  }
  
  // Simulate file upload processing
  setTimeout(() => {
    const documentId = `doc_${Date.now()}`;
    res.json({
      success: true,
      document: {
        documentId,
        filename: filename || 'uploaded_document.pdf',
        size: size || 1024000,
        fileType: fileType || 'application/pdf',
        uploadedAt: new Date().toISOString(),
        applicationId: applicationId || null,
        validationStatus: 'pending',
        ocrStatus: 'processing'
      },
      message: 'Document uploaded successfully'
    });
  }, 1000);
});

// Document Validation Status
app.get('/api/documents/:id/status', (req, res) => {
  const { id } = req.params;
  
  // Simulate OCR processing
  setTimeout(() => {
    res.json({
      success: true,
      document: {
        documentId: id,
        validationStatus: 'validated',
        ocrStatus: 'completed',
        extractedData: {
          amount: '25000',
          date: '2024-01-15',
          hospitalName: 'Apollo Hospital',
          patientName: 'Rajesh Kumar'
        },
        validationResults: {
          amountMatch: true,
          dateValid: true,
          signaturePresent: true,
          qualityScore: 95
        }
      }
    });
  }, 2000);
});

// Bulk Document Upload
app.post('/api/documents/bulk-upload', (req, res) => {
  const { files, applicationId } = req.body;
  
  const uploadedDocuments = files.map((file, index) => ({
    documentId: `doc_${Date.now()}_${index}`,
    filename: file.filename,
    size: file.size,
    fileType: file.fileType,
    uploadedAt: new Date().toISOString(),
    applicationId,
    validationStatus: 'pending'
  }));
  
  res.json({
    success: true,
    documents: uploadedDocuments,
    message: `${files.length} documents uploaded successfully`
  });
});

// Mock Notifications API
app.get('/api/notifications', (req, res) => {
  const notifications = [
    {
      id: 'notif_1',
      title: 'Application Approved',
      message: 'Your medical reimbursement application has been approved',
      type: 'success',
      date: '2024-01-20',
      read: false
    },
    {
      id: 'notif_2',
      title: 'Document Required',
      message: 'Additional documents needed for education loan application',
      type: 'warning',
      date: '2024-01-26',
      read: false
    },
    {
      id: 'notif_3',
      title: 'New Scheme Available',
      message: 'Skill Development Program now accepting applications',
      type: 'info',
      date: '2024-01-28',
      read: true
    }
  ];
  
  res.json({
    success: true,
    notifications,
    unreadCount: notifications.filter(n => !n.read).length
  });
});

// Serve static files from Next.js build (if available)
const nextBuildPath = path.join(__dirname, 'apps/web-app/.next');
const nextStaticPath = path.join(__dirname, 'apps/web-app/out');

// Check if we have a Next.js build
if (fs.existsSync(nextBuildPath) || fs.existsSync(nextStaticPath)) {
  // Serve Next.js static files
  app.use('/_next', express.static(path.join(__dirname, 'apps/web-app/.next')));
  app.use('/static', express.static(path.join(__dirname, 'apps/web-app/out')));
}

// Serve the main application - Use the working railway-production.js content
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'), (err) => {
    if (err) {
      // Fallback to simple HTML if file doesn't exist
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LTET Employee Trust Portal</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .credentials { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .btn { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
                .btn:hover { background: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏢 LTET Employee Trust Portal</h1>
                    <p>L&T Employee Trust Digital Platform</p>
                </div>
                
                <div class="status">
                    <h3>✅ System Status: ONLINE</h3>
                    <p>All services are running and ready for use.</p>
                </div>
                
                <div class="credentials">
                    <h3>🔑 Demo Credentials</h3>
                    <p><strong>Employee:</strong> AB123456 / demo123</p>
                    <p><strong>Admin:</strong> CD789012 / admin123</p>
                    <p><strong>Approver:</strong> EF345678 / approver123</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="/health" class="btn">Health Check</a>
                    <a href="/api/schemes" class="btn">View Schemes API</a>
                    <a href="/api/applications" class="btn">Applications API</a>
                </div>
                
                <div style="margin-top: 30px; text-align: center; color: #666;">
                    <p>🚀 Enhanced LTET Portal with Complete Workflows</p>
                    <p>Multi-step forms • Document upload • Role-based dashboards • Real-time tracking</p>
                </div>
            </div>
        </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
    : `http://localhost:${PORT}`;
  
  console.log('🚀 LTET Employee Trust Portal running on port ' + PORT);
  console.log('📊 Health check: ' + baseUrl + '/health');
  console.log('🌐 Web app: ' + baseUrl);
  console.log('🔗 API: ' + baseUrl + '/api');
  console.log('🌍 Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('📝 Demo credentials:');
  console.log('   Employee: AB123456 / demo123');
  console.log('   Admin: CD789012 / admin123');
  console.log('   Approver: EF345678 / approver123');
});