

process.env.NODE_ENV = 'production';
// 3rd party modules
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const http = require('http');
var path = require('path');
const socketio = require('socket.io');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');


// Local modules
const mainController = require('./controllers/mainController');
const errorController = require('./controllers/errorController');
const userController = require('./controllers/userController');
const gameController = require('./controllers/gameController');


// Initialize express and socket.io server
const app = express();
const server = http.createServer(app);
const io = socketio(server);



// Middleware configuration
const sessionMiddleware = session({
    secret: process.env.NEOSECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        //secure: true, // Enable when ready for https connection
        maxAge: 24 * 60 * 60 * 1000
    },
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    }),
});


app.set('view engine', 'ejs');
app.use(express.static(`${__dirname}/../public`));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Middleware for socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next);  
});

// Runs when a client connects
const boards = {};
io.on('connection', (sock) => { 

    const username = sock.request.session.username || `${sock.request.headers.cookie.split('=')[1].slice(16, 24)}`;
    const userID = sock.request.session.userID || '99y3og926z3kbbe';
    const sockID = sock.id;
    const userColor = sock.request.session.userColor || '#FFFFFF';

    // Gather chats from database cache them in chatMessages array
    

    // Handle which room to join
    sock.on('joinRoom', (room) => {
        sock.join(room);
        io.to(room).emit('chat-message', {text: `${username} has joined the room`, username: 'Server'});
    });

    userController.refreshGlobalChat(sock, io);

    // Handle Host game event
    sock.on('createGame', () => {
        const gameID = uuidv4();
        const clientIsHost = true;
        io.to('global').emit('gameCreatorID', gameID, username, sockID, clientIsHost);
        sock.join(gameID);
        io.to(gameID).emit('chat-message', {text: `${username} has created a game`, username: 'Server'});

        if (!boards[gameID]) {
            boards[gameID] = gameController(15) // Replace 5 with your desired board size
            boards[gameID].clearBoard();
            // Add username to board
            boards[gameID].userHost = { username, turn: true, hasWon: false, color: userColor };
        } 
    });

    // Cancel host game event
    sock.on('cancelHostGame', (gameID) => {
        sock.leave(gameID);
        io.emit('cancelHostGame', gameID, sock.id);
    });

    // Handle Join game event
    sock.on('joinGame', (gameID) => {
        sock.join(gameID);
        io.to(gameID).emit('chat-message', {text: `${username} has joined the game`, username: 'Server'});
        boards[gameID].userGuest = { username, turn: false, hasWon: false, color: userColor };
        io.emit('joinGame', gameID, username, sock.id);
    });

    // Handle Leave game event
    sock.on('leaveGame', (gameID, username) => {
        sock.leave(gameID);
        io.to(gameID).emit('chat-message', {text: `${username} has left the game`, username: 'Server'});
        io.emit('leaveGame', gameID, username, sock.id);
    });

    sock.on('startGame', (gameID) => {
        const socketsInRoom = io.sockets.adapter.rooms.get(gameID);
        // make sure there are 2 players in the room
        if (socketsInRoom.size !== 2) {
            return;
        }
        const gameURL = '/game/' + gameID;
        io.to(gameID).emit('startGame', gameURL);
    });

    sock.on('getGameInfo', (gameID) => {
        const gameInformation = {
            currentUser: username,
            currentHost: boards[gameID].userHost.username,
            HostColor: boards[gameID].userHost.color,
            currentGuest: boards[gameID].userGuest.username,
            GuestColor: boards[gameID].userGuest.color,
        };

        sock.emit('playerGameInfo', gameInformation);
    });

    sock.on('gameTurn', ({ x, y }, gameID, user) => {
        if (boards[gameID]) {

            // Determine color of player
            let color;
            if (user == boards[gameID].userHost.username) {
                color = boards[gameID].userHost.color;
            } else if (user == boards[gameID].userGuest.username) {
                color = boards[gameID].userGuest.color;
            } else {
                color = 'white';
            }

            const isUsersTurn = (user === boards[gameID].userHost.username && boards[gameID].userHost.turn) || (user === boards[gameID].userGuest.username && boards[gameID].userGuest.turn);

            if (!isUsersTurn) {
                return;
            }

            const result = boards[gameID].makeMove(x, y, username);

            if (result === 'invalid_move') {
                return;
            } else {
                io.to(gameID).emit('gameTurn', { x, y, color }, username);

                if (user == boards[gameID].userHost.username) {
                    boards[gameID].userHost.turn = false;
                    boards[gameID].userGuest.turn = true;
                } else if (user == boards[gameID].userGuest.username) {
                    boards[gameID].userGuest.turn = false;
                    boards[gameID].userHost.turn = true;
                } else {
                    return;
                }
            }

            if (result === true) {
                sock.emit('chat-message', { text: 'You have Won!', username: 'Server' });
                io.to(gameID).emit('chat-message', { text: 'Game Over!', username: 'Server' });
                // increment session win and points if user is logged in
                if (userID != '99y3og926z3kbbe') {
                    sock.request.session.userWins += 1;
                    // random amount of points between 1 and 10
                    const points = Math.floor(Math.random() * 35) + 25;
                    sock.request.session.userPoints += points;
                    // update database
                    sock.request.session.save();
                    userController.userWonGame(userID, sock.request.session.userWins, sock.request.session.userPoints);
                }

                boards[gameID].clearBoard();
                // emit game over
                io.to(gameID).emit('gameOver');
                // io.to(gameID).emit('board', boards[gameID].getBoard());
            }
        }
    });


    

    
    userController.sendChatMessage(sock, io, userID, username);


    sock.on('disconnect', () => {
        // Object.keys(boards).forEach((key) => {
        //     const socketsInRoom = io.sockets.adapter.rooms.get(key);
        //     if (!socketsInRoom || socketsInRoom.size === 0) {
        //         delete boards[key];
        //     }
        // });
    });
});




// Routes
app.get('/', mainController.sendHomePage);
app.get('/profile', userController.sendProfilePage);
app.get('/signup', userController.sendSignupPage);
app.get('/login', userController.sendLoginPage);
app.get('/game/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    if (boards[gameId]) {
        const hostName = boards[gameId].userHost.username;
        const guestName = boards[gameId].userGuest.username;
        // Render the game template with the game ID
        res.render('pages/game', { hostName, guestName });
    } else {
        res.redirect('/');
    }
});


// Posts
app.post('/register', userController.createUser);
app.post('/login', userController.loginUser);
app.post('/logout', userController.logoutUser);

app.use(errorController.respondNoResourceFound);
app.use(errorController.respondInternalError);

server.listen(5234, () => {
    console.log("Server started on port 5234");
});

