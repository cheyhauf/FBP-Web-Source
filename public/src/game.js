const log = (text, username) => {
    const parent = document.querySelector('#message-container');
    const messageObj = document.createElement('div');
    messageObj.className = 'message';


    const messageID = document.createElement('span');
    messageID.className = 'user';
    messageID.innerText = username + ' >';

    const messageText = document.createElement('span');
    messageText.className = 'text';
    messageText.innerText = text;

    messageObj.appendChild(messageID);
    messageObj.appendChild(messageText);
    parent.appendChild(messageObj);

    parent.scrollTop = parent.scrollHeight;
};

const onChatSubmitted = (sock, gameID) => (e) => {
    e.preventDefault();

    const input = document.querySelector('#chat');
    const text = input.value;
    if (text === '') return;
    input.value = '';

    sock.emit("chat-message", text, gameID);
};

const getBoard = (canvas, numCells = 15) => {

    const gameCtx = canvas.getContext('2d');
    const cellSize = Math.floor(canvas.width / numCells);

    const fillCell = (x, y, color) => {
        gameCtx.fillStyle = color;
        gameCtx.fillRect(x*cellSize+1, y*cellSize+1, cellSize-2, cellSize-2);
    };

    const drawGrid = () => {
        gameCtx.beginPath();
        for (let i = 1; i < numCells ; i++) {
            gameCtx.moveTo(i * cellSize, 0);
            gameCtx.lineTo(i * cellSize, cellSize * numCells);
            gameCtx.moveTo(0, i * cellSize);
            gameCtx.lineTo(cellSize * numCells, i * cellSize);
        }
        gameCtx.stroke();
    };

    const clearBoard = () => {
        gameCtx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const renderBoard = (board = []) => {
        board.forEach((row, y) => {
            row.forEach((player, x) => {
                player && fillCell(x, y);
            });
        });
    };

    const resetBoard = (board) => {
        clearBoard();
        drawGrid();
        renderBoard(board);
    };

    const getCellCoordinates = (x, y) => {
        return {
            x: Math.floor(x / cellSize),
            y: Math.floor(y / cellSize)
        };
    };


    return { fillCell, resetBoard, getCellCoordinates };

};

const getClickCoordinates = (element, e) => {
    const { top, left } = element.getBoundingClientRect();
    const { clientX, clientY } = e;

    return {
        x: clientX - left,
        y: clientY - top
    };
};

(() => {
    const sock = io();
    gameID = window.location.pathname.split('/')[2];
    const gameCanvas = document.querySelector('canvas');
    const { fillCell, resetBoard, getCellCoordinates } = getBoard(gameCanvas);
    let GAMEDATA = {};

    sock.emit('joinRoom', gameID);
    sock.emit('getGameInfo', gameID);

    sock.on("chat-message", (data) => log(data.text, data.username));


    // Begin game logistics
    sock.on('playerGameInfo', (data) => {
        GAMEDATA = data;
    });

    resetBoard();

    sock.on('board', resetBoard); 
    
    const onclick = (e) => {
        const { x, y } = getClickCoordinates(gameCanvas, e);
        sock.emit('gameTurn', getCellCoordinates(x, y), gameID, GAMEDATA.currentUser);
    };

    sock.on('gameTurn', ({ x, y, color }) => fillCell(x, y, color));

    sock.on('gameOver', () => {
        gameCanvas.removeEventListener('click', onclick);
        // send user back to lobby after 5 seconds
        setTimeout(() => {
            window.location.href = '/';
        }, 5000);
    });

    gameCanvas.addEventListener('click', onclick);

    document.querySelector('#input-form').addEventListener('submit', onChatSubmitted(sock, gameID));

    // show dropdown menu when user clicks on the button
    document.querySelector('#options-btn').addEventListener('click', () => {
        document.querySelector('#dropdown-menu').classList.toggle("a");
    });

    // Add click event listener to document
    document.addEventListener("click", (event) => {
        if (!document.querySelector('#dropdown-menu').contains(event.target) && !document.querySelector('#options-btn').contains(event.target)) {
            document.querySelector('#dropdown-menu').classList.remove("a");
        }
    });

    document.querySelector('#option_chatClear').addEventListener('click', () => {
        clearMessages();
    });
})();

