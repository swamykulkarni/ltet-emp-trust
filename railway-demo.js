const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock data for demo
const mockUsers = {
  'demo@ltet.com': {
    userId: 'EMP001',
    employeeId: 'AB123456',
    email: 'demo@ltet.com',
    personalInfo: {
      name: 'Rajesh Kumar',
      designation: 'Senior Engineer',
      department: 'Construction',
      ic: 'L&T Construction',
      dateOfJoining: '2018-03-15',
      employeeType: 'Permanent',
      grade: 'E3',
      location: 'Chennai'
    },
    contactInfo: {
      mobile: '+91-9876543210',
      alternateEmail: 'rajesh.kumar@personal.com',
      address: {
        line1: '123 Anna Nagar',
        line2: 'Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600040'
      }
    },
    bankDetails: {
      accountNumber: '1234567890',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branchName: 'Anna Nagar'
    },
    dependents: [
      {
        id: 'DEP001',
        name: 'Priya Kumar',
        relationship: 'Spouse',
        dateOfBirth: '1985-07-20',
        isActive: true
      },
      {
        id: 'DEP002',
        name: 'Arjun Kumar',
        relationship: 'Son',
        dateOfBirth: '2010-12-15',
        isActive: true
      }
    ]
  }
};

const mockSchemes = [
  {
    id: 'SCH001',
    name: 'Medical Reimbursement',
    category: 'Medical',
    description: 'Reimbursement for medical expenses incurred by employee and dependents',
    maxAmount: 50000,
    eligibility: ['Permanent Employee', 'Retiree'],
    documents: ['Medical Bills', 'Prescription', 'Discharge Summary'],
    deadline: '2024-12-31',
    isActive: true,
    applicationWindow: 'Year Round',
    processingTime: '15 days'
  },
  {
    id: 'SCH002',
    name: 'Education Loan',
    category: 'Education',
    description: 'Interest-free loan for higher education of employee children',
    maxAmount: 200000,
    eligibility: ['Permanent Employee'],
    documents: ['Admission Letter', 'Fee Structure', 'Academic Records'],
    deadline: '2024-08-31',
    isActive: true,
    applicationWindow: 'April - August',
    processingTime: '30 days'
  },
  {
    id: 'SCH003',
    name: 'Skill Development Grant',
    category: 'Skill Building',
    description: 'Financial assistance for professional certification and skill enhancement',
    maxAmount: 25000,
    eligibility: ['Permanent Employee'],
    documents: ['Course Details', 'Cost Breakdown', 'Certification Body'],
    deadline: '2024-10-31',
    isActive: true,
    applicationWindow: 'January - October',
    processingTime: '10 days'
  }
];

const mockApplications = [
  {
    id: 'APP001',
    userId: 'EMP001',
    schemeId: 'SCH001',
    schemeName: 'Medical Reimbursement',
    status: 'Under Review',
    submittedDate: '2024-01-15',
    requestedAmount: 15000,
    approvedAmount: null,
    documents: ['medical_bill_001.pdf', 'prescription_001.pdf'],
    timeline: [
      { status: 'Submitted', date: '2024-01-15', comment: 'Application submitted successfully' },
      { status: 'Under Review', date: '2024-01-16', comment: 'Assigned to reviewer' }
    ]
  },
  {
    id: 'APP002',
    userId: 'EMP001',
    schemeId: 'SCH003',
    schemeName: 'Skill Development Grant',
    status: 'Approved',
    submittedDate: '2023-12-01',
    requestedAmount: 20000,
    approvedAmount: 20000,
    documents: ['course_details.pdf', 'cost_breakdown.pdf'],
    timeline: [
      { status: 'Submitted', date: '2023-12-01', comment: 'Application submitted successfully' },
      { status: 'Under Review', date: '2023-12-02', comment: 'Assigned to reviewer' },
      { status: 'Approved', date: '2023-12-10', comment: 'Application approved for full amount' }
    ]
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'LTET Employee Trust Portal',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Authentication API
app.post('/api/auth/login', (req, res) => {
  const { email, password, employeeId } = req.body;
  
  // Demo credentials
  if ((email === 'demo@ltet.com' || employeeId === 'AB123456') && password === 'demo123') {
    const user = mockUsers['demo@ltet.com'];
    res.json({
      success: true,
      user: user,
      token: 'demo-jwt-token-' + Date.now()
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// User Profile API
app.get('/api/user/profile/:userId', (req, res) => {
  const user = mockUsers['demo@ltet.com'];
  res.json({
    success: true,
    data: user
  });
});

// Schemes API
app.get('/api/schemes', (req, res) => {
  const { category, search } = req.query;
  let filteredSchemes = [...mockSchemes];
  
  if (category && category !== 'all') {
    filteredSchemes = filteredSchemes.filter(scheme => 
      scheme.category.toLowerCase() === category.toLowerCase()
    );
  }
  
  if (search) {
    filteredSchemes = filteredSchemes.filter(scheme =>
      scheme.name.toLowerCase().includes(search.toLowerCase()) ||
      scheme.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({
    success: true,
    data: filteredSchemes,
    total: filteredSchemes.length
  });
});

app.get('/api/schemes/:id', (req, res) => {
  const scheme = mockSchemes.find(s => s.id === req.params.id);
  if (scheme) {
    res.json({ success: true, data: scheme });
  } else {
    res.status(404).json({ success: false, message: 'Scheme not found' });
  }
});

// Applications API
app.get('/api/applications', (req, res) => {
  const { userId } = req.query;
  const userApplications = mockApplications.filter(app => app.userId === userId);
  
  res.json({
    success: true,
    data: userApplications,
    total: userApplications.length
  });
});

app.post('/api/applications', (req, res) => {
  const newApplication = {
    id: 'APP' + String(Date.now()).slice(-3),
    ...req.body,
    status: 'Submitted',
    submittedDate: new Date().toISOString().split('T')[0],
    timeline: [
      { 
        status: 'Submitted', 
        date: new Date().toISOString().split('T')[0], 
        comment: 'Application submitted successfully' 
      }
    ]
  };
  
  mockApplications.push(newApplication);
  
  res.json({
    success: true,
    data: newApplication,
    message: 'Application submitted successfully'
  });
});

app.get('/api/applications/:id', (req, res) => {
  const application = mockApplications.find(app => app.id === req.params.id);
  if (application) {
    res.json({ success: true, data: application });
  } else {
    res.status(404).json({ success: false, message: 'Application not found' });
  }
});

// Document upload API (mock)
app.post('/api/documents/upload', (req, res) => {
  // Simulate document upload
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        documentId: 'DOC' + Date.now(),
        filename: req.body.filename || 'document.pdf',
        uploadDate: new Date().toISOString(),
        status: 'Uploaded',
        ocrStatus: 'Processed'
      }
    });
  }, 1000);
});

// Notifications API
app.get('/api/notifications', (req, res) => {
  const notifications = [
    {
      id: 'NOT001',
      title: 'Application Status Update',
      message: 'Your Medical Reimbursement application is under review',
      type: 'info',
      date: '2024-01-16',
      isRead: false
    },
    {
      id: 'NOT002',
      title: 'New Scheme Available',
      message: 'Skill Development Grant applications are now open',
      type: 'success',
      date: '2024-01-10',
      isRead: true
    }
  ];
  
  res.json({
    success: true,
    data: notifications
  });
});

// Admin APIs (mock)
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalApplications: 1250,
      pendingReview: 45,
      approvedThisMonth: 89,
      totalDisbursed: 2500000,
      schemeStats: {
        medical: { applications: 650, approved: 580 },
        education: { applications: 400, approved: 320 },
        skill: { applications: 200, approved: 180 }
      }
    }
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LTET Employee Trust Portal</title>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card-hover { transition: all 0.3s ease; }
            .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body class="bg-gray-50">
        <div id="root"></div>
        
        <script type="text/babel">
            const { useState, useEffect } = React;
            
            // Simple Router Component
            function Router() {
                const [currentPath, setCurrentPath] = useState(window.location.pathname);
                
                useEffect(() => {
                    const handlePopState = () => setCurrentPath(window.location.pathname);
                    window.addEventListener('popstate', handlePopState);
                    return () => window.removeEventListener('popstate', handlePopState);
                }, []);
                
                const navigate = (path) => {
                    window.history.pushState({}, '', path);
                    setCurrentPath(path);
                };
                
                return (
                    <div>
                        {currentPath === '/' && <LoginPage navigate={navigate} />}
                        {currentPath === '/dashboard' && <DashboardPage navigate={navigate} />}
                        {currentPath === '/schemes' && <SchemesPage navigate={navigate} />}
                        {currentPath === '/applications' && <ApplicationsPage navigate={navigate} />}
                    </div>
                );
            }
            
            // Login Component
            function LoginPage({ navigate }) {
                const [credentials, setCredentials] = useState({ email: '', password: '' });
                const [isLoading, setIsLoading] = useState(false);
                const [error, setError] = useState('');
                
                const handleSubmit = async (e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    setError('');
                    
                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(credentials)
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            localStorage.setItem('user', JSON.stringify(data.user));
                            localStorage.setItem('token', data.token);
                            navigate('/dashboard');
                        } else {
                            setError(data.message);
                        }
                    } catch (err) {
                        setError('Login failed. Please try again.');
                    } finally {
                        setIsLoading(false);
                    }
                };
                
                return (
                    <div className="min-h-screen flex items-center justify-center gradient-bg">
                        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 m-4">
                            <div className="text-center mb-8">
                                <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900">LTET Portal</h1>
                                <p className="text-gray-600 mt-2">L&T Employee Trust Digital Platform</p>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter your email"
                                        value={credentials.email}
                                        onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter your password"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                                    />
                                </div>
                                
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                                        {error}
                                    </div>
                                )}
                                
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50"
                                >
                                    {isLoading ? 'Signing in...' : 'Sign In'}
                                </button>
                            </form>
                            
                            <div className="mt-6 p-4 bg-blue-50 rounded-md">
                                <p className="text-sm text-blue-800 font-medium">Demo Credentials:</p>
                                <p className="text-sm text-blue-700">Email: demo@ltet.com</p>
                                <p className="text-sm text-blue-700">Password: demo123</p>
                            </div>
                        </div>
                    </div>
                );
            }
            
            // Navigation Component
            function Navigation({ navigate, user, onLogout }) {
                return (
                    <nav className="bg-white shadow-lg">
                        <div className="max-w-7xl mx-auto px-4">
                            <div className="flex justify-between h-16">
                                <div className="flex items-center space-x-8">
                                    <h1 className="text-xl font-bold text-gray-900">LTET Portal</h1>
                                    <div className="hidden md:flex space-x-6">
                                        <button onClick={() => navigate('/dashboard')} className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                                            Dashboard
                                        </button>
                                        <button onClick={() => navigate('/schemes')} className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                                            Schemes
                                        </button>
                                        <button onClick={() => navigate('/applications')} className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                                            Applications
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="text-sm text-gray-700">Welcome, {user?.personalInfo?.name}</span>
                                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm">
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </nav>
                );
            }
            
            // Dashboard Component
            function DashboardPage({ navigate }) {
                const [user, setUser] = useState(null);
                const [schemes, setSchemes] = useState([]);
                const [applications, setApplications] = useState([]);
                const [notifications, setNotifications] = useState([]);
                
                useEffect(() => {
                    const userData = JSON.parse(localStorage.getItem('user') || '{}');
                    setUser(userData);
                    
                    // Fetch data
                    Promise.all([
                        fetch('/api/schemes').then(r => r.json()),
                        fetch('/api/applications?userId=' + userData.userId).then(r => r.json()),
                        fetch('/api/notifications').then(r => r.json())
                    ]).then(([schemesRes, appsRes, notifRes]) => {
                        setSchemes(schemesRes.data || []);
                        setApplications(appsRes.data || []);
                        setNotifications(notifRes.data || []);
                    });
                }, []);
                
                const handleLogout = () => {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/');
                };
                
                if (!user?.userId) {
                    navigate('/');
                    return null;
                }
                
                return (
                    <div className="min-h-screen bg-gray-50">
                        <Navigation navigate={navigate} user={user} onLogout={handleLogout} />
                        
                        <main className="max-w-7xl mx-auto py-6 px-4">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                                <p className="text-gray-600">Welcome back, {user.personalInfo?.name}</p>
                            </div>
                            
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-lg shadow card-hover">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm text-gray-600">Available Schemes</p>
                                            <p className="text-2xl font-bold text-gray-900">{schemes.length}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-lg shadow card-hover">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm text-gray-600">My Applications</p>
                                            <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-lg shadow card-hover">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-yellow-100 rounded-lg">
                                            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm text-gray-600">Pending Review</p>
                                            <p className="text-2xl font-bold text-gray-900">{applications.filter(a => a.status === 'Under Review').length}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-lg shadow card-hover">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h10a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm text-gray-600">Notifications</p>
                                            <p className="text-2xl font-bold text-gray-900">{notifications.filter(n => !n.isRead).length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Recent Applications */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Applications</h3>
                                    <div className="space-y-4">
                                        {applications.slice(0, 3).map(app => (
                                            <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                                <div>
                                                    <p className="font-medium text-gray-900">{app.schemeName}</p>
                                                    <p className="text-sm text-gray-600">₹{app.requestedAmount?.toLocaleString()}</p>
                                                </div>
                                                <span className={\`px-2 py-1 text-xs rounded-full \${
                                                    app.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                    app.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }\`}>
                                                    {app.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => navigate('/applications')}
                                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        View All Applications →
                                    </button>
                                </div>
                                
                                {/* Available Schemes */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Schemes</h3>
                                    <div className="space-y-4">
                                        {schemes.slice(0, 3).map(scheme => (
                                            <div key={scheme.id} className="p-3 bg-gray-50 rounded">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{scheme.name}</p>
                                                        <p className="text-sm text-gray-600">Max: ₹{scheme.maxAmount?.toLocaleString()}</p>
                                                    </div>
                                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                                        {scheme.category}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => navigate('/schemes')}
                                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        Explore All Schemes →
                                    </button>
                                </div>
                            </div>
                        </main>
                    </div>
                );
            }
            
            // Schemes Page Component
            function SchemesPage({ navigate }) {
                const [user, setUser] = useState(null);
                const [schemes, setSchemes] = useState([]);
                const [filteredSchemes, setFilteredSchemes] = useState([]);
                const [selectedCategory, setSelectedCategory] = useState('all');
                const [searchTerm, setSearchTerm] = useState('');
                
                useEffect(() => {
                    const userData = JSON.parse(localStorage.getItem('user') || '{}');
                    setUser(userData);
                    
                    fetch('/api/schemes').then(r => r.json()).then(res => {
                        setSchemes(res.data || []);
                        setFilteredSchemes(res.data || []);
                    });
                }, []);
                
                useEffect(() => {
                    let filtered = schemes;
                    
                    if (selectedCategory !== 'all') {
                        filtered = filtered.filter(scheme => scheme.category.toLowerCase() === selectedCategory.toLowerCase());
                    }
                    
                    if (searchTerm) {
                        filtered = filtered.filter(scheme =>
                            scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            scheme.description.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                    }
                    
                    setFilteredSchemes(filtered);
                }, [schemes, selectedCategory, searchTerm]);
                
                const handleLogout = () => {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/');
                };
                
                if (!user?.userId) {
                    navigate('/');
                    return null;
                }
                
                return (
                    <div className="min-h-screen bg-gray-50">
                        <Navigation navigate={navigate} user={user} onLogout={handleLogout} />
                        
                        <main className="max-w-7xl mx-auto py-6 px-4">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Available Schemes</h2>
                                <p className="text-gray-600">Discover and apply for employee welfare schemes</p>
                            </div>
                            
                            {/* Filters */}
                            <div className="bg-white p-6 rounded-lg shadow mb-6">
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search schemes..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <select
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                        >
                                            <option value="all">All Categories</option>
                                            <option value="medical">Medical</option>
                                            <option value="education">Education</option>
                                            <option value="skill building">Skill Building</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Schemes Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredSchemes.map(scheme => (
                                    <div key={scheme.id} className="bg-white rounded-lg shadow card-hover p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={\`px-3 py-1 text-xs rounded-full \${
                                                scheme.category === 'Medical' ? 'bg-red-100 text-red-800' :
                                                scheme.category === 'Education' ? 'bg-blue-100 text-blue-800' :
                                                'bg-green-100 text-green-800'
                                            }\`}>
                                                {scheme.category}
                                            </span>
                                            <span className="text-sm text-gray-500">{scheme.processingTime}</span>
                                        </div>
                                        
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{scheme.name}</h3>
                                        <p className="text-gray-600 text-sm mb-4">{scheme.description}</p>
                                        
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Max Amount:</span>
                                                <span className="text-sm font-medium">₹{scheme.maxAmount?.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Deadline:</span>
                                                <span className="text-sm font-medium">{scheme.deadline}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-600 mb-1">Required Documents:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {scheme.documents?.slice(0, 2).map(doc => (
                                                    <span key={doc} className="px-2 py-1 bg-gray-100 text-xs rounded">
                                                        {doc}
                                                    </span>
                                                ))}
                                                {scheme.documents?.length > 2 && (
                                                    <span className="px-2 py-1 bg-gray-100 text-xs rounded">
                                                        +{scheme.documents.length - 2} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition duration-200">
                                            Apply Now
                                        </button>
                                    </div>
                                ))}
                            </div>
                            
                            {filteredSchemes.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-gray-500">No schemes found matching your criteria.</p>
                                </div>
                            )}
                        </main>
                    </div>
                );
            }
            
            // Applications Page Component
            function ApplicationsPage({ navigate }) {
                const [user, setUser] = useState(null);
                const [applications, setApplications] = useState([]);
                
                useEffect(() => {
                    const userData = JSON.parse(localStorage.getItem('user') || '{}');
                    setUser(userData);
                    
                    fetch('/api/applications?userId=' + userData.userId)
                        .then(r => r.json())
                        .then(res => setApplications(res.data || []));
                }, []);
                
                const handleLogout = () => {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/');
                };
                
                if (!user?.userId) {
                    navigate('/');
                    return null;
                }
                
                return (
                    <div className="min-h-screen bg-gray-50">
                        <Navigation navigate={navigate} user={user} onLogout={handleLogout} />
                        
                        <main className="max-w-7xl mx-auto py-6 px-4">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">My Applications</h2>
                                <p className="text-gray-600">Track and manage your scheme applications</p>
                            </div>
                            
                            <div className="space-y-6">
                                {applications.map(app => (
                                    <div key={app.id} className="bg-white rounded-lg shadow p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{app.schemeName}</h3>
                                                <p className="text-sm text-gray-600">Application ID: {app.id}</p>
                                            </div>
                                            <span className={\`px-3 py-1 text-sm rounded-full \${
                                                app.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                app.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                                                app.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }\`}>
                                                {app.status}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm text-gray-600">Submitted Date</p>
                                                <p className="font-medium">{app.submittedDate}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Requested Amount</p>
                                                <p className="font-medium">₹{app.requestedAmount?.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Approved Amount</p>
                                                <p className="font-medium">
                                                    {app.approvedAmount ? \`₹\${app.approvedAmount.toLocaleString()}\` : 'Pending'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-sm text-gray-600 mb-2">Application Timeline</p>
                                            <div className="space-y-2">
                                                {app.timeline?.map((event, index) => (
                                                    <div key={index} className="flex items-center space-x-3">
                                                        <div className={\`w-3 h-3 rounded-full \${
                                                            event.status === 'Approved' ? 'bg-green-500' :
                                                            event.status === 'Under Review' ? 'bg-yellow-500' :
                                                            'bg-blue-500'
                                                        }\`}></div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium">{event.status}</span>
                                                                <span className="text-xs text-gray-500">{event.date}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-600">{event.comment}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="flex space-x-3">
                                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
                                                View Details
                                            </button>
                                            {app.status === 'Under Review' && (
                                                <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded">
                                                    Upload Documents
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {applications.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500 mb-4">No applications found.</p>
                                    <button 
                                        onClick={() => navigate('/schemes')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                                    >
                                        Browse Schemes
                                    </button>
                                </div>
                            )}
                        </main>
                    </div>
                );
            }
            
            // Render the app
            ReactDOM.render(<Router />, document.getElementById('root'));
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 LTET Employee Trust Portal running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
  console.log(`📝 Demo credentials: demo@ltet.com / demo123`);
});