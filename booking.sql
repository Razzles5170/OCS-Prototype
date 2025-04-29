DROP TABLE IF EXISTS consultation_bookings;
DROP TABLE IF EXISTS installation_bookings;

CREATE TABLE IF NOT EXISTS consultation_bookings
(
    consultation_id TEXT PRIMARY KEY NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    bookedfor TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS installation_bookings
(
    installation_id TEXT PRIMARY KEY NOT NULL, 
    user_id VARCHAR(255) NOT NULL,
    bookedfor TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);


CREATE TABLE IF NOT EXISTS availability
(
    date TEXT NOT NULL PRIMARY KEY,
    available_times TEXT NOT NULL
);
