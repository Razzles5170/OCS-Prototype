DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users
(
    user_id VARCHAR(255) PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    password VARCHAR(255) NOT NULL,
    firstname TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    isOAuth BOOLEAN NOT NULL DEFAULT False,
    profilePic TEXT DEFAULT 'default_pfp.svg',
    CustomPfp BOOLEAN NOT NULL DEFAULT False
    
);

