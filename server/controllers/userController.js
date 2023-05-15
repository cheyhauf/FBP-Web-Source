require('dotenv').config();
const bcrypt = require('bcrypt');
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090'); // Pocketbase does need to  be running for most of the app to work

// Page Handlers
exports.sendLoginPage = (req, res) => {
    message = req.session.successMessage;
    delete req.session.successMessage;
    res.render('pages/login', { message });
};

exports.sendSignupPage = (req, res) => {
    res.render('pages/signup', { error: null });
};

exports.sendProfilePage = (req, res) => {
    const username = req.session.username;
    const userAuthentication = req.session.auth;
    res.render('pages/profile', { userAuthentication, username });
};


// User Op handlers
exports.createUser = async (req, res) => {
    try {
        error = await sanitizeUser(req);
        if (error) {
            return res.render('pages/signup', { error });
        } else {
            const user = {
                username: req.body.username,
                password: req.body.password,
                passwordConfirm: req.body.confirmPassword,
                phash: '',
                userColor: req.body.selectedColor
            };
            bcrypt.hash(user.password, parseInt(process.env.SALTYSEASONINGS)).then((hash) => {
                user.phash = hash;
                pb.collection('users').create(user).then(() => {
                    req.session.successMessage = 'You have successfully registered';
                    return res.redirect('/login');
                }).catch((error) => {
                    return res.render('pages/signup', { error });
                });
            }).catch((error) => {
                return res.render('pages/signup', { error });
            });
        }
    } catch (error) {
        return res.render('pages/signup', { error });
    }
};

exports.loginUser = (req, res) => {
    const { username, password } = req.body;

    pb.admins.authWithPassword(process.env.DB_USER, process.env.DB_PASSWORD)
        .then(() => {
            pb.collection("users").getFirstListItem(`username='${username}'`)
                .then((user) => {
                    bcrypt.compare(password, user.phash).then((result) => {
                        if (result) {
                            pb.collection('users').authWithPassword(username, password).then((authRes) => {
                                req.session.auth = true;
                                req.session.username = username;
                                req.session.userID = user.id;
                                req.session.userColor = defineUserColor(user.userColor);
                                req.session.userPoints = user.userPoints;
                                req.session.userWins = user.userWins;
                                res.redirect('/');
                            }).catch((error) => {
                                res.render('pages/login', { message: error });
                            });
                        } else {
                            const error = { message: 'Invalid username or password' };
                            res.render('pages/login', { message: error });
                        }
                    }).catch((error) => {
                        res.render('pages/login', { message: error });
                    });
                }).catch((error) => {
                    res.render('pages/login', { message: error });
                }
                );
        }).catch((error) => {
            res.render('pages/login', { message: error });
        });
};

exports.logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        } else {
            pb.authStore.clear();
            res.redirect('/');
        }
    });
};

sanitizeUser = (req) => {
    const { username, password, confirmPassword } = req.body;

    return new Promise((resolve, reject) => {

        if (password !== confirmPassword) {
            const error = { message: 'Passwords do not match' };
            reject(error);
        }

        if (password.length < 8) {
            const error = { message: 'Password must be at least 8 characters' };
            reject(error);
        }

        if (password.length > 64) {
            const error = { message: 'Password must be less than 64 characters' };
            reject(error);
        }

        if (username.length < 4) {
            const error = { message: 'Username must be at least 4 characters' };
            reject(error);
        }

        if (username.length > 32) {
            const error = { message: 'Username must be less than 32 characters' };
            reject(error);
        }

        pb.admins.authWithPassword(process.env.DB_USER, process.env.DB_PASSWORD)
            .then(() => {
                pb.collection("users").getFirstListItem(`username='${username}'`)
                    .then((user) => {
                        if (user) {
                            const error = { message: 'Username already exists' };
                            reject(error);
                        } else {
                            resolve(false);
                        }
                    }).catch((err) => {
                        if (err.status == 404) {
                            resolve(false);
                        } else {
                            reject(err);
                        }
                    });
            })
            .catch((error) => {
                reject(error);
            });
    });
};

defineUserColor = (color) => {
    switch (color) {
        case 'color1': // red
            return '#ff0000';
        case 'color2': // green
            return '#00ff00';
        case 'color3': // blue
            return '#0000ff';
        case 'color4': // yellow
            return '#ffff00';
        case 'color5': // purple    
            return '#ff00ff';
        case 'admin': // admin
            return '#4497A1';
    }
};





logChatMessage = async (userID, text, senderName) => {
    const messageObject = {
        user: userID,
        message: text,
        username: senderName
    }
    const authData = await pb.admins.authWithPassword(process.env.DB_USER, process.env.DB_PASSWORD);
    const result = await pb.collection('messages').create(messageObject);
};

getChatMessages = async (req, res) => {
    const messages = [];
    const authData = await pb.admins.authWithPassword(process.env.DB_USER, process.env.DB_PASSWORD);
    const dbMessages = await pb.collection('messages').getList(1, 15, { sort: '-created' });
    for (const item of dbMessages.items.reverse()) {
        const username = item.username;
        const message = item.message;
        messages.push({ username, message });
    }
    return messages;
};

exports.refreshGlobalChat = ( sock, io ) => {
    sock.on('refreshGlobalChat', () => {
        getChatMessages().then((messages) => {
            for (const message of messages) {
                sock.emit('chat-message', { text: message.message, username: message.username });
            }
        }).catch((error) => {
            console.log(error);
        });
    });
};

exports.sendChatMessage = (sock, io, userID, username) => {
    // Handle chat events, userID, username
    sock.on("chat-message", (text, gameID) => {

        if (text.length > 256 || text.length < 1) {
            return;
        }

        if (gameID == 'global') {
            try {
                logChatMessage(userID, text, username);
            } catch (error) {
                console.log(error);
            }   
        }
        
        io.to(gameID).emit("chat-message", { text, username });
    });
};

exports.userWonGame = async (userID, userWins, userPoints) => {
    const authData = await pb.admins.authWithPassword(process.env.DB_USER, process.env.DB_PASSWORD);
    const user = await pb.collection('users').getFirstListItem(`id='${userID}'`);
    user.userWins = userWins;
    user.userPoints = userPoints;
    const result = await pb.collection('users').update(userID, user);
};

