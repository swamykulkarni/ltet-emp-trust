const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Login page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LTET Portal</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 8px; }
            input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
            button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; }
            .demo { background: #e7f3ff; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏢 LTET Employee Portal</h1>
            <form id="loginForm">
                <input type="email" id="email" placeholder="Email" required>
                <input type="password" id="password" placeholder="Password" required>
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
                
                if (email === 'demo@ltet.com' && password === 'demo123') {
                    window.location.href = '/dashboard';
                } else {
                    alert('Invalid credentials');
                }
            };
        </script>
    </body>
    </html>
  `);
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LTET Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; background: #f5f5f5; }
            .header { background: white; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .container { max-width: 800px; margin: 20px auto; padding: 20px; }
            .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>🏢 LTET Employee Trust Portal</h2>
        </div>
        <div class="container">
            <div class="card">
                <h3>Welcome, Demo User!</h3>
                <p>✅ Login successful - Portal is working!</p>
            </div>
            <div class="card">
                <h3>📋 Available Features</h3>
                <p>• Medical Reimbursement: ₹50,000</p>
                <p>• Education Loan: ₹2,00,000</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 LTET Portal running on port ${PORT}`);
});