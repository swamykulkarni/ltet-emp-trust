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

// Serve the main application
app.get('*', (req, res) => {
  // Serve the comprehensive React application
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LTET Employee Trust Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
            .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card-hover { transition: transform 0.2s, box-shadow 0.2s; }
            .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body class="bg-gray-50">
        <div id="root"></div>
        
        <script type="text/babel">
            const { useState, useEffect } = React;
            
            function App() {
                const [currentView, setCurrentView] = useState('login');
                const [user, setUser] = useState(null);
                const [schemes, setSchemes] = useState([]);
                const [applications, setApplications] = useState([]);
                const [notifications, setNotifications] = useState([]);
                const [loading, setLoading] = useState(false);
                
                useEffect(() => {
                    if (user) {
                        fetchData();
                    }
                }, [user]);
                
                const fetchData = async () => {
                    try {
                        const headers = {
                            'x-user-role': user.role,
                            'x-user-id': user.userId
                        };
                        
                        const [schemesRes, appsRes, notifsRes] = await Promise.all([
                            fetch('/api/schemes', { headers }),
                            fetch('/api/applications', { headers }),
                            fetch('/api/notifications', { headers })
                        ]);
                        
                        const schemesData = await schemesRes.json();
                        const appsData = await appsRes.json();
                        const notifsData = await notifsRes.json();
                        
                        setSchemes(schemesData.schemes || []);
                        setApplications(appsData.applications || []);
                        setNotifications(notifsData.notifications || []);
                    } catch (error) {
                        console.error('Error fetching data:', error);
                    }
                };
                
                const handleLogin = async (credentials) => {
                    setLoading(true);
                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(credentials)
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            setUser(data.user);
                            setCurrentView('dashboard');
                        } else {
                            alert(data.message);
                        }
                    } catch (error) {
                        alert('Login failed. Please try again.');
                    }
                    setLoading(false);
                };
                
                const handleLogout = () => {
                    setUser(null);
                    setCurrentView('login');
                    setSchemes([]);
                    setApplications([]);
                    setNotifications([]);
                };
                
                if (currentView === 'login') {
                    return <LoginPage onLogin={handleLogin} loading={loading} />;
                }
                
                return (
                    <div className="min-h-screen bg-gray-50">
                        <Navigation user={user} onLogout={handleLogout} currentView={currentView} setCurrentView={setCurrentView} notifications={notifications} />
                        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                            {currentView === 'dashboard' && <Dashboard user={user} schemes={schemes} applications={applications} />}
                            {currentView === 'schemes' && <SchemesPage schemes={schemes} user={user} />}
                            {currentView === 'applications' && <ApplicationsPage applications={applications} user={user} />}
                            {currentView === 'profile' && user?.role === 'employee' && <ProfilePage user={user} />}
                            {currentView === 'users' && user?.role === 'admin' && <UserManagementPage />}
                            {currentView === 'analytics' && user?.role === 'admin' && <AdminDashboard />}
                            {currentView === 'reports' && (user?.role === 'admin' || user?.role === 'approver') && <ReportsPage user={user} />}
                        </main>
                    </div>
                );
            }
            
            function LoginPage({ onLogin, loading }) {
                const [credentials, setCredentials] = useState({ employeeId: '', password: '' });
                
                const handleSubmit = (e) => {
                    e.preventDefault();
                    onLogin(credentials);
                };
                
                return (
                    <div className="min-h-screen flex items-center justify-center gradient-bg">
                        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
                            <div className="text-center mb-8">
                                <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900">LTET Portal</h1>
                                <p className="text-gray-600 mt-2">L&T Employee Trust Digital Platform</p>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., AB123456"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={credentials.employeeId}
                                        onChange={(e) => setCredentials({...credentials, employeeId: e.target.value.toUpperCase()})}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter your password"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    {loading ? 'Signing in...' : 'Sign In'}
                                </button>
                            </form>
                            
                            <div className="mt-6 p-4 bg-blue-50 rounded-md">
                                <h3 className="font-medium text-blue-900 mb-2">Demo Credentials:</h3>
                                <div className="text-sm text-blue-800 space-y-1">
                                    <div><strong>Employee:</strong> AB123456 / demo123</div>
                                    <div><strong>Admin:</strong> CD789012 / admin123</div>
                                    <div><strong>Approver:</strong> EF345678 / approver123</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function Navigation({ user, onLogout, currentView, setCurrentView, notifications }) {
                const unreadCount = notifications.filter(n => !n.read).length;
                
                // Role-based navigation items
                const getNavItems = () => {
                    const baseItems = [
                        { id: 'dashboard', name: '📊 Dashboard', roles: ['employee', 'admin', 'approver'] }
                    ];
                    
                    if (user.role === 'employee') {
                        return [
                            ...baseItems,
                            { id: 'schemes', name: '📋 Browse Schemes', roles: ['employee'] },
                            { id: 'applications', name: '📄 My Applications', roles: ['employee'] },
                            { id: 'profile', name: '👤 My Profile', roles: ['employee'] }
                        ];
                    } else if (user.role === 'approver') {
                        return [
                            ...baseItems,
                            { id: 'applications', name: '📋 Review Applications', roles: ['approver'] },
                            { id: 'schemes', name: '📚 Scheme Details', roles: ['approver'] },
                            { id: 'reports', name: '📊 Approval Reports', roles: ['approver'] }
                        ];
                    } else if (user.role === 'admin') {
                        return [
                            ...baseItems,
                            { id: 'schemes', name: '⚙️ Manage Schemes', roles: ['admin'] },
                            { id: 'applications', name: '📋 All Applications', roles: ['admin'] },
                            { id: 'users', name: '👥 User Management', roles: ['admin'] },
                            { id: 'analytics', name: '📈 Analytics', roles: ['admin'] },
                            { id: 'reports', name: '📊 System Reports', roles: ['admin'] }
                        ];
                    }
                    return baseItems;
                };
                
                const navItems = getNavItems();
                
                return (
                    <nav className="bg-white shadow-lg">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between h-16">
                                <div className="flex items-center space-x-8">
                                    <h1 className="text-xl font-bold text-gray-900">LTET Employee Trust Portal</h1>
                                    <div className="hidden md:flex space-x-6">
                                        {navItems.map(item => (
                                            <NavLink 
                                                key={item.id}
                                                active={currentView === item.id} 
                                                onClick={() => setCurrentView(item.id)}
                                            >
                                                {item.name}
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="relative">
                                        <button className="p-2 text-gray-600 hover:text-gray-900 relative">
                                            🔔
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-900">{user?.personalInfo?.name}</div>
                                        <div className="text-gray-500 capitalize">{user?.role}</div>
                                    </div>
                                    <button
                                        onClick={onLogout}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </nav>
                );
            }
            
            function NavLink({ children, active, onClick }) {
                return (
                    <button
                        onClick={onClick}
                        className={'px-3 py-2 text-sm font-medium rounded-md ' + (
                            active 
                                ? 'text-blue-600 bg-blue-50' 
                                : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                        )}
                    >
                        {children}
                    </button>
                );
            }
            
            function Dashboard({ user, schemes, applications }) {
                const recentApplications = applications.slice(0, 3);
                const recommendedSchemes = schemes.slice(0, 3);
                
                return (
                    <div className="space-y-8">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                Welcome back, {user?.personalInfo?.name}! 👋
                            </h2>
                            <p className="text-gray-600 mb-6">
                                {user.role === 'employee' && "Manage your scheme applications and discover new benefits"}
                                {user.role === 'approver' && "Review pending applications and manage approvals"}
                                {user.role === 'admin' && "Monitor system performance and manage configurations"}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard title="Total Applications" value={applications.length} icon="📄" color="blue" />
                                <StatCard title="Approved" value={applications.filter(a => a.status === 'approved').length} icon="✅" color="green" />
                                <StatCard title="Under Review" value={applications.filter(a => a.status === 'under_review').length} icon="⏳" color="yellow" />
                                <StatCard title="Available Schemes" value={schemes.length} icon="📋" color="purple" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Applications</h3>
                                <div className="space-y-4">
                                    {recentApplications.map(app => (
                                        <ApplicationCard key={app.id} application={app} />
                                    ))}
                                    {recentApplications.length === 0 && (
                                        <p className="text-gray-500 text-center py-4">No applications found</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Schemes</h3>
                                <div className="space-y-4">
                                    {recommendedSchemes.map(scheme => (
                                        <SchemeCard key={scheme.id} scheme={scheme} compact />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function StatCard({ title, value, icon, color }) {
                const colorClasses = {
                    blue: 'bg-blue-50 text-blue-600',
                    green: 'bg-green-50 text-green-600',
                    yellow: 'bg-yellow-50 text-yellow-600',
                    purple: 'bg-purple-50 text-purple-600'
                };
                
                return (
                    <div className="bg-white p-4 rounded-lg border card-hover">
                        <div className="flex items-center">
                            <div className={'p-2 rounded-lg ' + (colorClasses[color] || colorClasses.blue)}>
                                <span className="text-xl">{icon}</span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">{title}</p>
                                <p className="text-2xl font-bold text-gray-900">{value}</p>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function ApplicationCard({ application }) {
                const statusColors = {
                    approved: 'bg-green-100 text-green-800',
                    under_review: 'bg-yellow-100 text-yellow-800',
                    rejected: 'bg-red-100 text-red-800',
                    submitted: 'bg-blue-100 text-blue-800'
                };
                
                return (
                    <div className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium text-gray-900">{application.schemeName}</h4>
                                <p className="text-sm text-gray-600">₹{application.amount.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Submitted: {application.submittedDate}</p>
                            </div>
                            <span className={'px-2 py-1 text-xs rounded-full ' + statusColors[application.status]}>
                                {application.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </div>
                );
            }
            
            function SchemeCard({ scheme, compact = false }) {
                return (
                    <div className={'bg-white rounded-lg shadow p-6 card-hover ' + (compact ? 'border' : '')}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{scheme.title}</h3>
                                <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                    {scheme.category}
                                </span>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-green-600">₹{scheme.maxAmount.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Max Amount</p>
                            </div>
                        </div>
                        
                        <p className="text-gray-600 mb-4">{scheme.description}</p>
                        
                        {!compact && (
                            <>
                                <div className="mb-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Eligibility:</h4>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                        {scheme.eligibility.map((item, index) => (
                                            <li key={index}>• {item}</li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                                    <span>📊 {scheme.applicationCount} applications</span>
                                    <span>✅ {scheme.approvalRate}% approval rate</span>
                                </div>
                            </>
                        )}
                        
                        <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                            Apply Now
                        </button>
                    </div>
                );
            }
            
            function SchemesPage({ schemes, user }) {
                const [filter, setFilter] = useState('all');
                
                const filteredSchemes = filter === 'all' 
                    ? schemes 
                    : schemes.filter(s => s.category.toLowerCase() === filter);
                
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Schemes</h2>
                            <div className="flex space-x-4">
                                <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
                                    All Schemes
                                </FilterButton>
                                <FilterButton active={filter === 'medical'} onClick={() => setFilter('medical')}>
                                    Medical
                                </FilterButton>
                                <FilterButton active={filter === 'education'} onClick={() => setFilter('education')}>
                                    Education
                                </FilterButton>
                                <FilterButton active={filter === 'skill building'} onClick={() => setFilter('skill building')}>
                                    Skill Building
                                </FilterButton>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSchemes.map(scheme => (
                                <SchemeCard key={scheme.id} scheme={scheme} />
                            ))}
                        </div>
                    </div>
                );
            }
            
            function FilterButton({ children, active, onClick }) {
                return (
                    <button
                        onClick={onClick}
                        className={'px-4 py-2 rounded-md text-sm font-medium ' + (
                            active 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                    >
                        {children}
                    </button>
                );
            }
            
            function ApplicationsPage({ applications, user }) {
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                {user.role === 'approver' ? 'Applications for Review' : 
                                 user.role === 'admin' ? 'All Applications' : 'My Applications'}
                            </h2>
                            <p className="text-gray-600">
                                {user.role === 'approver' ? 'Review and approve pending applications' : 
                                 user.role === 'admin' ? 'Monitor all system applications' : 'Track the status of your scheme applications'}
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            {applications.map(application => (
                                <div key={application.id} className="bg-white rounded-lg shadow p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{application.schemeName}</h3>
                                            <p className="text-gray-600">Application ID: {application.id}</p>
                                            {user.role !== 'employee' && (
                                                <p className="text-gray-600">Applicant: {application.applicantName}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">₹{application.amount.toLocaleString()}</p>
                                            <span className={'px-3 py-1 text-sm rounded-full ' + (
                                                application.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                application.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                                                application.status === 'needs_clarification' ? 'bg-orange-100 text-orange-800' :
                                                'bg-blue-100 text-blue-800'
                                            )}>
                                                {application.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {application.timeline && (
                                        <div className="border-t pt-4">
                                            <h4 className="font-medium text-gray-900 mb-2">Timeline:</h4>
                                            <div className="space-y-2">
                                                {application.timeline.map((event, index) => (
                                                    <div key={index} className="flex items-center space-x-3">
                                                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {event.status.replace('_', ' ').toUpperCase()}
                                                            </span>
                                                            <span className="text-sm text-gray-500 ml-2">{event.date}</span>
                                                            <p className="text-sm text-gray-600">{event.comment}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }
            
            function ProfilePage({ user }) {
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">My Profile</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm text-gray-600">Name</label>
                                            <p className="font-medium">{user.personalInfo.name}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-600">Employee ID</label>
                                            <p className="font-medium">{user.employeeId}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-600">Email</label>
                                            <p className="font-medium">{user.personalInfo.email}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-600">Department</label>
                                            <p className="font-medium">{user.personalInfo.department}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function UserManagementPage() {
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">User Management</h2>
                            <p className="text-gray-600">Manage user roles and permissions</p>
                            <div className="mt-4 text-center text-gray-500">
                                <p>👥 User management interface coming soon...</p>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function ReportsPage({ user }) {
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                {user.role === 'admin' ? 'System Reports' : 'Approval Reports'}
                            </h2>
                            <p className="text-gray-600">
                                {user.role === 'admin' 
                                    ? 'Generate comprehensive system reports' 
                                    : 'View approval statistics and reports'
                                }
                            </p>
                            <div className="mt-4 text-center text-gray-500">
                                <p>📊 Advanced reporting interface coming soon...</p>
                            </div>
                        </div>
                    </div>
                );
            }
            
            function AdminDashboard() {
                const [analytics, setAnalytics] = useState(null);
                
                useEffect(() => {
                    fetch('/api/admin/analytics')
                        .then(res => res.json())
                        .then(data => setAnalytics(data.analytics));
                }, []);
                
                if (!analytics) return <div>Loading...</div>;
                
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics Dashboard</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard title="Total Applications" value={analytics.totalApplications} icon="📊" color="blue" />
                                <StatCard title="Pending Review" value={analytics.pendingReview} icon="⏳" color="yellow" />
                                <StatCard title="Approved This Month" value={analytics.approvedThisMonth} icon="✅" color="green" />
                                <StatCard title="Total Disbursed" value={'₹' + (analytics.totalDisbursed / 1000000).toFixed(1) + 'M'} icon="💰" color="purple" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheme Utilization</h3>
                                <div className="space-y-4">
                                    {analytics.schemeUtilization.map((scheme, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <p className="font-medium text-gray-900">{scheme.scheme}</p>
                                                <p className="text-sm text-gray-600">{scheme.applications} applications</p>
                                            </div>
                                            <p className="font-bold text-gray-900">₹{(scheme.amount / 1000000).toFixed(1)}M</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends</h3>
                                <div className="space-y-4">
                                    {analytics.monthlyTrends.map((month, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <p className="font-medium text-gray-900">{month.month} 2024</p>
                                                <p className="text-sm text-gray-600">{month.applications} applications</p>
                                            </div>
                                            <p className="font-bold text-gray-900">₹{(month.amount / 1000000).toFixed(1)}M</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            
            // Render the application
            ReactDOM.render(<App />, document.getElementById('root'));
        </script>
    </body>
    </html>
  `);
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