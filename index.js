require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const methodOverride = require('method-override');
const mysql = require('mysql2');
const session = require('express-session');

// ✅ Railway MySQL connection
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    ssl: {
        rejectUnauthorized: false
    }
});

// ✅ DB connection check
db.connect(err => {
    if (err) {
        console.error("DB connection failed:", err);
    } else {
        console.log("Connected to Railway MySQL");
    }
});

// ✅ Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretkey-1010',
    resave: false,
    saveUninitialized: false
}));

app.use(methodOverride('_method'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ================= USER =================

// Login page
app.get('/', (req, res) => {
    const showError = req.query.error === '1';
    res.render('login', { showError });
});

// Login
app.post('/', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.send("Database error");

        const user = results[0];

        if (user && user.password_hash === password) {
            req.session.userId = user.id;
            res.redirect('/home');
        } else {
            res.redirect('/?error=1');
        }
    });
});

// Signup
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;

    db.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, password],
        err => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.render('signup', { error: 'Email already in use' });
                }
                return res.send("Database error");
            }
            res.redirect('/');
        }
    );
});

// Home
app.get('/home', (req, res) => {
    db.query('SELECT * FROM events', (err, results) => {
        if (err) return res.send("Error loading events");
        res.render('home', { event: results });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Booking
app.get('/book/:eid', (req, res) => {
    res.render('book_ticket', { eventid: req.params.eid });
});

app.patch('/book/:eid', (req, res) => {
    const { tier, quantity } = req.body;
    const qty = parseInt(quantity);

    db.query(
        'SELECT * FROM events WHERE id = ?',
        [req.params.eid],
        (err, results) => {
            if (err) return res.send("Database error");

            const event = results[0];

            if (event.available_seats >= qty) {
                let totalprice = 0;

                if (tier === "tier1") totalprice = qty * event.tier1_price;
                if (tier === "tier2") totalprice = qty * event.tier2_price;
                if (tier === "tier3") totalprice = qty * event.tier3_price;

                res.render('payment', {
                    eventid: req.params.eid,
                    eventName: event.title,
                    tier,
                    qty,
                    totalprice
                });
            } else {
                res.render('book_ticket', {
                    eventid: req.params.eid,
                    error: 'Not enough seats available'
                });
            }
        }
    );
});

// Payment
app.post('/pay', (req, res) => {
    const { eventid, qty, totalprice } = req.body;
    const userId = req.session.userId;

    db.query('SELECT available_seats FROM events WHERE id = ?', [eventid], (err, results) => {
        if (err) return res.send("Database error");

        const updatedSeats = results[0].available_seats - parseInt(qty);

        db.query('UPDATE events SET available_seats = ? WHERE id = ?', [updatedSeats, eventid], () => {
            db.query(
                'INSERT INTO bookings (user_id, event_id, num_tickets, total_price) VALUES (?,?,?,?)',
                [userId, eventid, qty, totalprice],
                () => res.redirect('/confirm')
            );
        });
    });
});

// My tickets
app.get('/mytickets', (req, res) => {
    db.query(
        `SELECT b.*, e.title FROM bookings b 
         JOIN events e ON b.event_id = e.id 
         WHERE b.user_id = ?`,
        [req.session.userId],
        (err, results) => {
            if (err) return res.send("Database error");
            res.render('mytickets', { tickets: results });
        }
    );
});

app.get('/confirm', (req, res) => {
    res.render('confirm');
});

// ================= HOST =================

// Host login
app.get('/host', (req, res) => {
    const showError = req.query.error === '1';
    res.render('host_login', { showError });
});

app.post('/host', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM organizers WHERE email = ?', [email], (err, results) => {
        if (err) return res.send("Database error");

        const user = results[0];

        if (user && user.password_hash === password) {
            req.session.userId = user.id;
            res.redirect('/host_home');
        } else {
            res.redirect('/host?error=1');
        }
    });
});

// ✅ FIXED HOST SIGNUP (supports BOTH routes)

// Original route (used by your EJS)
app.get('/host_signup', (req, res) => {
    res.render('host_signup');
});

app.post('/host_signup', (req, res) => {
    const { name, email, password } = req.body;

    db.query(
        'INSERT INTO organizers (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, password],
        err => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.render('host_signup', { error: 'Email already in use' });
                }
                return res.send("Database error");
            }
            res.redirect('/host');
        }
    );
});

// New route (redirects to old one)
app.get('/host/signup', (req, res) => {
    res.redirect('/host_signup');
});

app.post('/host/signup', (req, res) => {
    res.redirect('/host_signup');
});

// Host home
app.get('/host_home', (req, res) => {
    db.query(
        'SELECT * FROM events WHERE organizer_id = ?',
        [req.session.userId],
        (err, results) => {
            if (err) return res.send("Database error");
            res.render('host_home', { events: results });
        }
    );
});

// Create event
app.get('/host_create', (req, res) => {
    res.render('host_create');
});

app.post('/host_create', (req, res) => {
    const organizer_id = req.session.userId;
    const {
        title, description, date, time,
        location, total_seats,
        tier1_price, tier2_price, tier3_price
    } = req.body;

    const available_seats = total_seats;

    db.query(
        `INSERT INTO events 
        (organizer_id, title, description, date, time, location,
         total_seats, available_seats, tier1_price, tier2_price, tier3_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            organizer_id, title, description, date, time, location,
            total_seats, available_seats, tier1_price, tier2_price, tier3_price
        ],
        err => {
            if (err) return res.render('host_create', { error: 'Database error' });
            res.redirect('/host_home');
        }
    );
});

// Delete event
app.delete('/delete/:eid', (req, res) => {
    db.query('DELETE FROM events WHERE id = ?', [req.params.eid], () => {
        res.redirect('/host_home');
    });
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});