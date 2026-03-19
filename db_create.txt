CREATE DATABASE booking;
USE booking;

CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255)
);

CREATE TABLE organizers (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255)
);

CREATE TABLE events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organizer_id INT,
    title VARCHAR(200),
    description TEXT,
    date DATE,
    time TIME,
    location VARCHAR(200),
    total_seats INT,
    available_seats INT,
    tier1_price INT DEFAULT 1000,
    tier2_price INT DEFAULT 500,
    tier3_price INT DEFAULT 200,
    FOREIGN KEY (organizer_id) REFERENCES organizers(id)
);

CREATE TABLE bookings (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    event_id INT,
    booking_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    num_tickets INT,
    total_price INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);
