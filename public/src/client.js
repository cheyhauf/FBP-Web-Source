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
    input.value = '';

    if (text === '') return;

    sock.emit("chat-message", text, gameID);
};

(() => {
    const sock = io();

    
    sock.on("chat-message", (data) => log(data.text, data.username));

    sock.on('connect', () => {
        sock.emit('joinRoom', 'global');
        sock.emit('refreshGlobalChat');
    });

    

    document.querySelector('#input-form').addEventListener('submit', onChatSubmitted(sock, 'global'));

    const hostGameButton = document.querySelector('.host-game');
    hostGameButton.addEventListener('click', () => {
        sock.emit('createGame');
    });

    sock.on('gameCreatorID', (gameID, username, sockID) => {
        hostGame(username, sockID, sock, gameID); 
    });

    sock.on('cancelHostGame', (gameID, sockID) => {
        removeHostGame(gameID, sock, sockID);
    });

    sock.on('joinGame', (gameID, username, sockID) => {
        joinGame(username, sock, gameID, sockID);
    });

    sock.on('leaveGame', (gameID, username, sockID) => {
        leaveGame(username, gameID, sock, sockID);
    });

    sock.on('startGame', (gameURL) => {
        window.location.href = gameURL;
    });
    
})();


function clearMessages() {
    // Get the parent element that contains the messages
    const messageContainer = document.getElementById('message-container');

    // Remove all child elements from the parent element
    while (messageContainer.firstChild) {
        messageContainer.removeChild(messageContainer.firstChild);
    }
}

const hostGame = (username, sockID, sock, gameID) => {
    const parent = document.querySelector('.gamelist');
    const listItem = document.createElement('li');
    listItem.className = username + "-hosted-game";
    listItem.id = gameID;
    const gamelistItem = document.createElement('div');
    gamelistItem.className = 'gamelist-item';
    const gamelistUsername = document.createElement('div');
    gamelistUsername.className = 'gamelist-username';
    gamelistUsername.innerText = username;
    const gamelistJoinButton = document.createElement('div');
    gamelistJoinButton.className = 'gamelist-join';
    gamelistJoinButton.innerText = 'Join';
    const gamelistPlaceholder = document.createElement('div');
    gamelistPlaceholder.className = 'gamelist-placeholder';
    gamelistPlaceholder.innerText = 'Joinable';
    const undoIcon = document.createElement('span');
    undoIcon.addEventListener('click', () => {
        sock.emit('cancelHostGame', gameID);
        document.querySelector('.host-game').style.display = 'block';
    });
    undoIcon.className = 'undo-icon';
    undoIcon.innerHTML = '&times;';
    gamelistItem.appendChild(gamelistUsername);
    if (sockID != sock.id) {
        gamelistItem.appendChild(gamelistJoinButton);
        gamelistJoinButton.addEventListener('click', () => {
            sock.emit('joinGame', gameID);
        });
        gamelistItem.appendChild(gamelistPlaceholder);
        listItem.appendChild(gamelistItem);
        parent.appendChild(listItem);    
    } else {
        gamelistItem.appendChild(gamelistPlaceholder);
        gamelistItem.appendChild(undoIcon);
        listItem.appendChild(gamelistItem);
        parent.appendChild(listItem);
        document.querySelector('.host-game').style.display = 'none';
    }
};

const removeHostGame = ( gameID, sock, sockID ) => {
    document.getElementById(gameID).remove();
    if (sock.id != sockID) {
        document.querySelector('.host-game').style.display = 'block';
    }
};

const joinGame = (username, sock, gameID, sockID) => {
    listItem = document.getElementById(gameID);

    const loadingIcon = document.createElement('span');
    loadingIcon.id = 'loading-icon';
    loadingIcon.className= 'bodymovin'
    listItem.querySelector('.gamelist-username').insertAdjacentElement('afterend', loadingIcon);
    var animation = bodymovin.loadAnimation({
        container: document.getElementById('loading-icon'),
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/media/lotties/loadingFinish.json',
    })
    animation.addEventListener('complete', () => {
        if (document.getElementById(gameID) != null && document.getElementById(gameID).querySelector('.gamelist-placeholder').innerHTML != 'Joinable') {
            sock.emit('startGame', gameID);
            document.getElementById(gameID).remove();
        }
    });

    if (sock.id == sockID) {
        // If there are any games hosted by the user, remove them
        try {
            const hostedGames = document.querySelectorAll('.' + username + '-hosted-game');
            for (let i = 0; i < hostedGames.length; i++) {
                sock.emit('cancelHostGame', hostedGames[i].id, username);
            }
        } catch (e) {
            // Do nothing
        }
        
        document.querySelector('.host-game').style.display = 'none';
        listItem.querySelector('.gamelist-join').remove();
        const leaveButton = document.createElement('span');
        leaveButton.className = 'player-leave';
        leaveButton.innerHTML = '&times;';
        leaveButton.addEventListener('click', () => {
            sock.emit('leaveGame', gameID, username);
            document.querySelector('.host-game').style.display = 'block';
        });
        listItem.querySelector('.gamelist-item').appendChild(leaveButton);
    }
    listItem.querySelector('.gamelist-placeholder').innerHTML = username;

};

const leaveGame = (username, gameID, sock, sockID) => {
    listItem = document.getElementById(gameID);
    if (sock.id == sockID) {
        listItem.querySelector('.player-leave').remove();
        const joinButton = document.createElement('div');
        joinButton.className = 'gamelist-join';
        joinButton.innerText = 'Join';
        joinButton.addEventListener('click', () => {
            sock.emit('joinGame', gameID);
        });
        listItem.querySelector('.gamelist-item').insertBefore(joinButton, listItem.querySelector('.gamelist-placeholder'));
    }
    listItem.querySelector('.gamelist-placeholder').innerHTML = 'Joinable';
    listItem.querySelector('#loading-icon').remove();
};


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



