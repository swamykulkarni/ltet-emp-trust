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

// Mock Applications API
app.get('/api/applications', (req, res) => {
  const applications = [
    {
      id: 'app_001',
      schemeId: 'scheme_medical_1',
      schemeName: 'Medical Reimbursement',
      applicantName: 'Rajesh Kumar',
      amount: 25000,
      status: 'approved',
      submittedDate: '2024-01-15',
      lastUpdated: '2024-01-20',
      documents: ['medical_bill.pdf', 'prescription.pdf'],
      timeline: [
        { status: 'submitted', date: '2024-01-15', comment: 'Application submitted' },
        { status: 'under_review', date: '2024-01-16', comment: 'Under review by approver' },
        { status: 'approved', date: '2024-01-20', comment: 'Approved for full amount' }
      ]
    },
    {
      id: 'app_002',
      schemeId: 'scheme_education_1',
      schemeName: 'Education Loan Assistance',
      applicantName: 'Rajesh Kumar',
      amount: 150000,
      status: 'under_review',
      submittedDate: '2024-01-25',
      lastUpdated: '2024-01-26',
      documents: ['admission_letter.pdf', 'fee_structure.pdf'],
      timeline: [
        { status: 'submitted', date: '2024-01-25', comment: 'Application submitted' },
        { status: 'under_review', date: '2024-01-26', comment: 'Document verification in progress' }
      ]
    }
  ];
  
  res.json({
    success: true,
    applications,
    total: applications.length
  });
});

// Mock Application Submission
app.post('/api/applications', (req, res) => {
  const { schemeId, amount, documents, personalInfo } = req.body;
  
  const newApplication = {
    id: `app_${Date.now()}`,
    schemeId,
    amount,
    status: 'submitted',
    submittedDate: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString().split('T')[0],
    documents: documents || [],
    timeline: [
      { 
        status: 'submitted', 
        date: new Date().toISOString().split('T')[0], 
        comment: 'Application submitted successfully' 
      }
    ]
  };
  
  res.json({
    success: true,
    application: newApplication,
    message: 'Application submitted successfully'
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

// Mock Document Upload
app.post('/api/documents/upload', (req, res) => {
  // Simulate file upload
  setTimeout(() => {
    res.json({
      success: true,
      documentId: `doc_${Date.now()}`,
      filename: req.body.filename || 'uploaded_document.pdf',
      size: req.body.size || 1024000,
      uploadedAt: new Date().toISOString()
    });
  }, 1000);
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
  // For now, serve a comprehensive demo page that showcases the LTET system
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
                        const [schemesRes, appsRes, notifsRes] = await Promise.all([
                            fetch('/api/schemes'),
                            fetch('/api/applications'),
                            fetch('/api/notifications')
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
                            {currentView === 'schemes' && <SchemesPage schemes={schemes} />}
                            {currentView === 'applications' && <ApplicationsPage applications={applications} />}
                            {currentView === 'admin' && user?.role === 'admin' && <AdminDashboard />}
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
                
                return (
                    <nav className="bg-white shadow-lg">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between h-16">
                                <div className="flex items-center space-x-8">
                                    <h1 className="text-xl font-bold text-gray-900">LTET Employee Trust Portal</h1>
                                    <div className="hidden md:flex space-x-6">
                                        <NavLink active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}>
                                            📊 Dashboard
                                        </NavLink>
                                        <NavLink active={currentView === 'schemes'} onClick={() => setCurrentView('schemes')}>
                                            📋 Schemes
                                        </NavLink>
                                        <NavLink active={currentView === 'applications'} onClick={() => setCurrentView('applications')}>
                                            📄 My Applications
                                        </NavLink>
                                        {user?.role === 'admin' && (
                                            <NavLink active={currentView === 'admin'} onClick={() => setCurrentView('admin')}>
                                                ⚙️ Admin
                                            </NavLink>
                                        )}
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
                                    <span className="text-sm text-gray-700">Welcome, {user?.personalInfo?.name}</span>
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
                        className={\`px-3 py-2 text-sm font-medium rounded-md \${
                            active 
                                ? 'text-blue-600 bg-blue-50' 
                                : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                        }\`}
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome back, {user?.personalInfo?.name}! 👋</h2>
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
                    <div className="bg-white p-4 rounded-lg border">
                        <div className="flex items-center">
                            <div className={\`p-2 rounded-lg \${colorClasses[color]}\`}>
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
                            <span className={\`px-2 py-1 text-xs rounded-full \${statusColors[application.status]}\`}>
                                {application.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </div>
                );
            }
            
            function SchemeCard({ scheme, compact = false }) {
                return (
                    <div className={\`bg-white rounded-lg shadow p-6 card-hover \${compact ? 'border' : ''}\`}>
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
            
            function SchemesPage({ schemes }) {
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
                        className={\`px-4 py-2 rounded-md text-sm font-medium \${
                            active 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }\`}
                    >
                        {children}
                    </button>
                );
            }
            
            function ApplicationsPage({ applications }) {
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">My Applications</h2>
                            <p className="text-gray-600">Track the status of your scheme applications</p>
                        </div>
                        
                        <div className="space-y-4">
                            {applications.map(application => (
                                <div key={application.id} className="bg-white rounded-lg shadow p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{application.schemeName}</h3>
                                            <p className="text-gray-600">Application ID: {application.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">₹{application.amount.toLocaleString()}</p>
                                            <span className={\`px-3 py-1 text-sm rounded-full \${
                                                application.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                application.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-blue-100 text-blue-800'
                                            }\`}>
                                                {application.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="border-t pt-4">
                                        <h4 className="font-medium text-gray-900 mb-2">Timeline:</h4>
                                        <div className="space-y-2">
                                            {application.timeline.map((event, index) => (
                                                <div key={index} className="flex items-center space-x-3">
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-900">{event.status.replace('_', ' ')}</span>
                                                        <span className="text-sm text-gray-500 ml-2">{event.date}</span>
                                                        <p className="text-sm text-gray-600">{event.comment}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard title="Total Applications" value={analytics.totalApplications} icon="📊" color="blue" />
                                <StatCard title="Pending Review" value={analytics.pendingReview} icon="⏳" color="yellow" />
                                <StatCard title="Approved This Month" value={analytics.approvedThisMonth} icon="✅" color="green" />
                                <StatCard title="Total Disbursed" value={\`₹\${(analytics.totalDisbursed / 1000000).toFixed(1)}M\`} icon="💰" color="purple" />
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
            
            ReactDOM.render(<App />, document.getElementById('root'));
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 LTET Employee Trust Portal running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Web app: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Demo credentials:`);
  console.log(`   Employee: AB123456 / demo123`);
  console.log(`   Admin: CD789012 / admin123`);
  console.log(`   Approver: EF345678 / approver123`);
});