const express = require('express');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');
const http = require('http');

// Initialize express and create an HTTP server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const io = require('socket.io')(server);

let socketsConected = new Set();
io.on('connection', onConnected);

function onConnected(socket) {
    console.log('Socket connected', socket.id);
    socketsConected.add(socket.id);
    io.emit('clients-total', socketsConected.size);

    socket.on('disconnect', () => {
        console.log('Socket disconnected', socket.id);
        socketsConected.delete(socket.id);
        io.emit('clients-total', socketsConected.size);
    });

    socket.on('message', (data) => {
        socket.broadcast.emit('chat-message', data);
    });

    socket.on('feedback', (data) => {
        socket.broadcast.emit('feedback', data);
    });
}

// Google OAuth client setup
const client = new OAuth2Client('1041634902803-ijfujr1kj7sqqjcaosff9dm8k36mdkst.apps.googleusercontent.com');

// Session setup
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database configuration
const dbConfig = {
    user: 'sagarkarar',
    password: 'S1g1r@K1r1r',
    server: 'sagar-server.database.windows.net',
    database: 'sagar_db',
};

// Check database connection
sql.connect(dbConfig, err => {
    if (err) {
        console.error('Database connection failed: ', err.message);
    } else {
        console.log('Connected to the database successfully!');
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle Google Sign-In callback
app.post('/auth/google/callback', async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: '1041634902803-ijfujr1kj7sqqjcaosff9dm8k36mdkst.apps.googleusercontent.com'
        });
        const payload = ticket.getPayload();

        // Save user information in session
        req.session.user = {
            name: payload.name,
            picture: payload.picture,
            email: payload.email
        };

        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({ message: 'Authentication failed' });
    }
});

// Serve user data for homepage
app.get('/auth/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ message: 'User not logged in' });
    }
});

// Handle Sign-Out
app.post('/auth/signout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Sign out failed' });
        }
        res.json({ message: 'Signed out successfully' });
    });
});

// Login route
app.post('/login', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const result = await sql.query`SELECT * FROM useradmin WHERE username = ${username} AND email = ${email}`;
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            if (password == user.password) {
                return res.send('Login successful');
            }
        }
        res.status(401).send('Incorrect credentials');
    } catch (err) {
        console.error('Error querying the database: ', err);
        res.status(500).send('Server error');
    } finally {
        sql.close();
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
