const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Health check - Railway requires this
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Root endpoint - Login page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LTET Employee Trust Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f2f5; }
            .container { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #1877f2; margin: 0; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #1877f2; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
            button:hover { background: #166fe5; }
            .demo { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-top: 20px; text-align: center; }
            .error { background: #ffebee; color: #c62828; padding: 10px; border-radius: 4px; margin-bottom: 15px; display: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>🏢 LTET Portal</h1>
                <p>Employee Trust System</p>
            </div>
            
            <div id="error" class="error"></div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label>Email:</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label>Password:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            
            <div class="demo">
                <strong>Demo Login:</strong><br>
                Email: demo@ltet.com<br>
                Password: demo123
            </div>
        </div>

        <script>
            document.getElementById('loginForm').onsubmit = async function(e) {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        window.location.href = '/dashboard';
                    } else {
                        document.getElementById('error').textContent = data.message;
                        document.getElementById('error').style.display = 'block';
                    }
                } catch (error) {
                    document.getElementById('error').textContent = 'Login failed. Please try again.';
                    document.getElementById('error').style.display = 'block';
                }
            };
        </script>
    </body>
    </html>
  `);
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LTET Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; background: #f0f2f5; }
            .header { background: white; padding: 15px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
            .logo { color: #1877f2; font-size: 20px; font-weight: bold; }
            .logout { background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
            .container { max-width: 1000px; margin: 20px auto; padding: 0 20px; }
            .welcome { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .card h3 { margin-top: 0; color: #333; }
            .btn { background: #1877f2; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
            .btn:hover { background: #166fe5; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏢 LTET Employee Trust Portal</div>
            <button class="logout" onclick="logout()">Logout</button>
        </div>

        <div class="container">
            <div class="welcome">
                <h2>Welcome, Demo User!</h2>
                <p>Manage your trust applications and explore available schemes.</p>
            </div>

            <div class="cards">
                <div class="card">
                    <h3>📋 My Applications</h3>
                    <p>View and track your applications</p>
                    <button class="btn" onclick="alert('Applications feature coming soon!')">View Applications</button>
                </div>

                <div class="card">
                    <h3>🎯 Available Schemes</h3>
                    <p>Medical: ₹50,000<br>Education: ₹2,00,000</p>
                    <button class="btn" onclick="alert('Schemes browser coming soon!')">Browse Schemes</button>
                </div>

                <div class="card">
                    <h3>📄 New Application</h3>
                    <p>Start a new application</p>
                    <button class="btn" onclick="alert('Application form coming soon!')">Apply Now</button>
                </div>

                <div class="card">
                    <h3>👤 Profile</h3>
                    <p>Manage your profile</p>
                    <button class="btn" onclick="alert('Profile management coming soon!')">Edit Profile</button>
                </div>
            </div>
        </div>

        <script>
            function logout() {
                window.location.href = '/';
            }
        </script>
    </body>
    </html>
  `);
});

// API endpoints
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'demo@ltet.com' && password === 'demo123') {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.json({ success: false, message: 'Invalid email or password' });
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
  console.log(`🚀 LTET Portal running on port ${PORT}`);
  console.log(`🌐 Ready to accept connections`);
});