const express=require('express');
const app=express();
const path=require('path');
const methodOverride = require('method-override');
const mysql = require('mysql2');
const session = require('express-session');
const e = require('express');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'vikas82',      // use your MySQL password
    database: 'booking'
});

db.connect(err => {
    if (err) throw err;
    console.log("Connected to MySQL database");
});

app.use(session({
    secret: 'secretkey-1010',
    resave: false,
    saveUninitialized: false
}));

app.use(methodOverride('_method'));

app.use(express.static('public'));

app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs')

app.get('/', (req, res) => {
    const showError = req.query.error === '1';
    res.render('login', { showError });
});

app.post('/', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) throw err;

        const user = results[0];

        if (user && user.password_hash === password) {
            req.session.userId = user.id;
            res.redirect('/home');
        } else {
            console.log('Invalid credentials');
            res.redirect('/?error=1');
        }
    });
});

app.get('/signup',(req,res)=>{
    res.render('signup');
})

app.post('/signup',(req,res)=>{
    const {name,email,password} = req.body;
    db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, password], err => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.render('signup', { error: 'Email already in use' });
            }
            throw err;
        }
        res.redirect('/');
    });
})

app.get('/home',(req,res)=>{
    const userId = req.session.userId;
    db.query('SELECT * FROM events', (err, results) => {
        if (err) throw err;
        res.render('home', { event: results });
    });
})

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error logging out');
        }
        res.redirect('/');
    });
});

app.get('/book/:eid',(req,res)=>{
    const eventid=req.params.eid;
    res.render('book_ticket',{eventid});
})

app.patch('/book/:eid', (req, res) => {
    const eventid = req.params.eid;
    const { tier, quantity } = req.body;
    const qty = parseInt(quantity);
    const userId = req.session.userId;

    db.query('SELECT title, available_seats, tier1_price, tier2_price, tier3_price FROM events WHERE id = ?', [eventid], (err, results) => {
        if (err) throw err;
        const event = results[0];
        const available = event.available_seats;

        if (available >= qty) {
            const updatedSeats = available - qty;

            let totalprice = 0;
            if (tier === "tier1") totalprice = qty * event.tier1_price;
            if (tier === "tier2") totalprice = qty * event.tier2_price;
            if (tier === "tier3") totalprice = qty * event.tier3_price;

            res.render('payment', { eventid, eventName: event.title, tier, qty, totalprice });

        } else {
            res.render('book_ticket', { eventid, error: 'Not enough seats available' });
        }
    });
});

app.post('/pay', (req, res) => {
    const { eventid, tier, qty, totalprice } = req.body;
    const userId = req.session.userId;

    db.query('SELECT available_seats FROM events WHERE id = ?', [eventid], (err, results) => {
        if (err) throw err;

        const available = results[0].available_seats;
        const quantity = parseInt(qty);
        const updatedSeats = available - quantity;

        db.query('UPDATE events SET available_seats = ? WHERE id = ?', [updatedSeats, eventid], (err) => {
            if (err) throw err;

            db.query('INSERT INTO bookings (user_id, event_id, num_tickets, total_price) VALUES (?,?,?,?)',
                [userId, eventid, quantity, totalprice], err => {
                    if (err) throw err;
                    res.redirect('/confirm'); 
                });
        });
    });
});

app.get('/mytickets',(req,res)=>{
    const userId = req.session.userId;
    const query = `
        SELECT b.*, e.title 
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.user_id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) throw err;
        res.render('mytickets', { tickets: results });
    });
})

app.get('/confirm',(req,res)=>{
    res.render('confirm');
})

app.get('/host', (req, res) => {
    const showError = req.query.error === '1';
    res.render('host_login', { showError });
});

app.post('/host', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM organizers WHERE email = ?', [email], (err, results) => {
        if (err) throw err;

        const user = results[0];

        if (user && user.password_hash === password) {
            req.session.userId = user.id;
            res.redirect('/host_home');
        } else {
            console.log('Invalid credentials');
            res.redirect('/host?error=1');
        }
    });
});

app.get('/host_signup',(req,res)=>{
    res.render('host_signup');
})

app.post('/host_signup',(req,res)=>{
    const {name,email,password} = req.body;
    db.query('INSERT INTO organizers (name, email, password_hash) VALUES (?, ?, ?)', [name, email, password], err => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.render('host_signup', { error: 'Email already in use' });
            }
            throw err;
        }
        res.redirect('/host');
    });
})

app.get('/host_home',(req,res)=>{
    const userId = req.session.userId;
    const query = `
        SELECT * FROM events
        WHERE organizer_id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) throw err;
        res.render('host_home', { events: results });
    });
})

app.get('/host_create',(req,res)=>{
    res.render('host_create');
})

app.post('/host_create', (req, res) => {
    const organizer_id = req.session.userId;
    const {
        title, description, date, time,
        location, total_seats,
        tier1_price, tier2_price, tier3_price
    } = req.body;

    if (!title || !description || !date || !time || !location || !total_seats) {
        return res.render('host_create', { error: 'Enter values in all fields' });
    }

    const available_seats = total_seats;

    const query = `
        INSERT INTO events (
            organizer_id, title, description, date, time, location,
            total_seats, available_seats, tier1_price, tier2_price, tier3_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        organizer_id, title, description, date, time, location,
        total_seats, available_seats, tier1_price, tier2_price, tier3_price
    ];

    db.query(query, values, (err) => {
        if (err) {
            console.error(err);
            return res.render('host_create', { error: 'Database error. Try again.' });
        }
        res.redirect('/host_home');
    });
});

app.delete('/delete/:eid',(req,res)=>{
    const {eid} = req.params;
    db.query("delete from events where id=?",[eid],(err, results)=>{
        if(err) throw err
        res.redirect('/host_home');
    });
})

app.listen(3000,()=>{
    console.log("On port 3000");
})