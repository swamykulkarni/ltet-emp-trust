const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Health check - Railway requires this
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'
  });
});

// Root endpoint - redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LTET Employee Trust Portal - Login</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
            }
            .login-container { 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 15px 35px rgba(0,0,0,0.1); 
                width: 100%; 
                max-width: 400px; 
            }
            .logo { 
                text-align: center; 
                margin-bottom: 30px; 
            }
            .logo h1 { 
                color: #2563eb; 
                font-size: 2.2em; 
                font-weight: bold; 
                margin-bottom: 5px; 
            }
            .logo p { 
                color: #6b7280; 
                font-size: 0.9em; 
            }
            .form-group { 
                margin-bottom: 20px; 
            }
            label { 
                display: block; 
                margin-bottom: 8px; 
                color: #374151; 
                font-weight: 500; 
            }
            input[type="email"], input[type="password"] { 
                width: 100%; 
                padding: 12px; 
                border: 2px solid #e5e7eb; 
                border-radius: 6px; 
                font-size: 16px; 
                transition: border-color 0.3s; 
            }
            input[type="email"]:focus, input[type="password"]:focus { 
                outline: none; 
                border-color: #2563eb; 
            }
            .login-btn { 
                width: 100%; 
                padding: 12px; 
                background: #2563eb; 
                color: white; 
                border: none; 
                border-radius: 6px; 
                font-size: 16px; 
                font-weight: 600; 
                cursor: pointer; 
                transition: background 0.3s; 
            }
            .login-btn:hover { 
                background: #1d4ed8; 
            }
            .demo-info { 
                background: #eff6ff; 
                padding: 15px; 
                border-radius: 6px; 
                margin-top: 20px; 
                text-align: center; 
            }
            .demo-info h4 { 
                color: #1e40af; 
                margin-bottom: 8px; 
            }
            .demo-info p { 
                color: #3730a3; 
                font-size: 0.9em; 
            }
            .error { 
                background: #fef2f2; 
                color: #dc2626; 
                padding: 10px; 
                border-radius: 6px; 
                margin-bottom: 20px; 
                display: none; 
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <h1>🏢 LTET</h1>
                <p>Employee Trust Portal</p>
            </div>
            
            <div id="error" class="error"></div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" required>
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                
                <button type="submit" class="login-btn">Sign In</button>
            </form>
            
            <div class="demo-info">
                <h4>🎯 Demo Access</h4>
                <p><strong>Email:</strong> demo@ltet.com</p>
                <p><strong>Password:</strong> demo123</p>
            </div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('error');
                
                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        localStorage.setItem('authToken', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        window.location.href = '/dashboard';
                    } else {
                        errorDiv.textContent = data.message || 'Login failed';
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    errorDiv.textContent = 'Network error. Please try again.';
                    errorDiv.style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LTET Employee Trust Portal - Dashboard</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: #f8fafc; 
                min-height: 100vh; 
            }
            .header { 
                background: white; 
                padding: 15px 30px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
            }
            .logo { 
                color: #2563eb; 
                font-size: 1.5em; 
                font-weight: bold; 
            }
            .user-info { 
                display: flex; 
                align-items: center; 
                gap: 15px; 
            }
            .logout-btn { 
                background: #dc2626; 
                color: white; 
                border: none; 
                padding: 8px 16px; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 14px; 
            }
            .logout-btn:hover { 
                background: #b91c1c; 
            }
            .container { 
                max-width: 1200px; 
                margin: 30px auto; 
                padding: 0 20px; 
            }
            .welcome { 
                background: white; 
                padding: 30px; 
                border-radius: 12px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                margin-bottom: 30px; 
            }
            .welcome h2 { 
                color: #1f2937; 
                margin-bottom: 10px; 
            }
            .welcome p { 
                color: #6b7280; 
            }
            .cards { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
                gap: 20px; 
                margin-bottom: 30px; 
            }
            .card { 
                background: white; 
                padding: 25px; 
                border-radius: 12px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                transition: transform 0.2s; 
            }
            .card:hover { 
                transform: translateY(-2px); 
            }
            .card h3 { 
                color: #1f2937; 
                margin-bottom: 15px; 
                display: flex; 
                align-items: center; 
                gap: 10px; 
            }
            .card p { 
                color: #6b7280; 
                margin-bottom: 15px; 
            }
            .btn { 
                background: #2563eb; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 14px; 
                text-decoration: none; 
                display: inline-block; 
            }
            .btn:hover { 
                background: #1d4ed8; 
            }
            .schemes-list { 
                background: white; 
                padding: 25px; 
                border-radius: 12px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .scheme-item { 
                padding: 15px; 
                border: 1px solid #e5e7eb; 
                border-radius: 8px; 
                margin-bottom: 15px; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
            }
            .scheme-info h4 { 
                color: #1f2937; 
                margin-bottom: 5px; 
            }
            .scheme-info p { 
                color: #6b7280; 
                font-size: 14px; 
            }
            .amount { 
                color: #059669; 
                font-weight: bold; 
                font-size: 16px; 
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏢 LTET Employee Trust Portal</div>
            <div class="user-info">
                <span id="userName">Demo User</span>
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
        </div>

        <div class="container">
            <div class="welcome">
                <h2>Welcome to Your Employee Trust Portal</h2>
                <p>Manage your trust applications, view available schemes, and track your submissions all in one place.</p>
            </div>

            <div class="cards">
                <div class="card">
                    <h3>📋 My Applications</h3>
                    <p>View and track your submitted applications</p>
                    <button class="btn" onclick="showApplications()">View Applications</button>
                </div>

                <div class="card">
                    <h3>🎯 Available Schemes</h3>
                    <p>Explore trust schemes you're eligible for</p>
                    <button class="btn" onclick="showSchemes()">Browse Schemes</button>
                </div>

                <div class="card">
                    <h3>📄 New Application</h3>
                    <p>Start a new trust scheme application</p>
                    <button class="btn" onclick="newApplication()">Apply Now</button>
                </div>

                <div class="card">
                    <h3>👤 Profile</h3>
                    <p>Update your personal information</p>
                    <button class="btn" onclick="showProfile()">Manage Profile</button>
                </div>
            </div>

            <div class="schemes-list">
                <h3 style="margin-bottom: 20px; color: #1f2937;">🎯 Available Trust Schemes</h3>
                <div id="schemesList">
                    <div class="scheme-item">
                        <div class="scheme-info">
                            <h4>Medical Reimbursement</h4>
                            <p>Coverage for medical expenses and treatments</p>
                        </div>
                        <div class="amount">₹50,000</div>
                    </div>
                    <div class="scheme-item">
                        <div class="scheme-info">
                            <h4>Education Loan</h4>
                            <p>Financial assistance for educational purposes</p>
                        </div>
                        <div class="amount">₹2,00,000</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Check if user is logged in
            const token = localStorage.getItem('authToken');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (!token) {
                window.location.href = '/login';
            }
            
            if (user.name) {
                document.getElementById('userName').textContent = user.name;
            }

            function logout() {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }

            function showApplications() {
                alert('📋 Applications feature coming soon!\\n\\nThis would show:\\n• Submitted applications\\n• Application status\\n• Document requirements');
            }

            function showSchemes() {
                alert('🎯 Schemes browser coming soon!\\n\\nThis would show:\\n• Detailed scheme information\\n• Eligibility criteria\\n• Application process');
            }

            function newApplication() {
                alert('📄 New Application wizard coming soon!\\n\\nThis would include:\\n• Step-by-step application form\\n• Document upload\\n• Eligibility check');
            }

            function showProfile() {
                alert('👤 Profile management coming soon!\\n\\nThis would allow:\\n• Update personal details\\n• Change password\\n• Notification preferences');
            }

            // Load schemes from API
            fetch('/api/schemes')
                .then(response => response.json())
                .then(schemes => {
                    const schemesList = document.getElementById('schemesList');
                    schemesList.innerHTML = schemes.map(scheme => \`
                        <div class="scheme-item">
                            <div class="scheme-info">
                                <h4>\${scheme.name}</h4>
                                <p>Maximum benefit amount available</p>
                            </div>
                            <div class="amount">₹\${scheme.maxAmount.toLocaleString()}</div>
                        </div>
                    \`).join('');
                })
                .catch(error => console.error('Error loading schemes:', error));
        </script>
    </body>
    </html>
  `);
});

// Info page (moved from root)
app.get('/info', (req, res) => {
  res.send(`
    <h1>🏢 LTET Employee Trust Portal</h1>
    <p>✅ Server is running successfully!</p>
    <p>🌐 Port: ${PORT}</p>
    <p>🚂 Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}</p>
    <p>📊 <a href="/health">Health Check</a></p>
    <p>🎯 Demo Credentials: demo@ltet.com / demo123</p>
    <p><a href="/login">Go to Login Page</a></p>
  `);
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'demo@ltet.com' && password === 'demo123') {
    res.json({ success: true, token: 'demo-token', user: { name: 'Demo User' } });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/schemes', (req, res) => {
  res.json([
    { id: 1, name: 'Medical Reimbursement', maxAmount: 50000 },
    { id: 2, name: 'Education Loan', maxAmount: 200000 }
  ]);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🚂 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
});