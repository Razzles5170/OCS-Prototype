CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    firstname TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    isOAuth BOOLEAN DEFAULT 0,
    profilePic TEXT,
    CustomPfp BOOLEAN DEFAULT 0
);


CREATE TABLE IF NOT EXISTS consultation_bookings (
    consultation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bookedfor DATETIME NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);


CREATE TABLE IF NOT EXISTS installation_bookings (
    installation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bookedfor DATETIME NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);


CREATE TABLE IF NOT EXISTS availability (
    availability_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    available_times TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS admin_users (
    admin_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


INSERT OR IGNORE INTO admin_users (admin_id, username, password)
VALUES ('admin1', 'admin', '$2b$12$tG/yPfsw6SXymnUJUqChW.BPtTkVE1qZbK2LZi3mD8e3vgPGv9tau'); -- password is 'admin123'
