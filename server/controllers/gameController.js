const createBoard = (size) => {
    let board; 

    const clearBoard = () => {
        board = new Array(size).fill().map(() => new Array(size).fill(null));
    };

    const getBoard = () => board;

    const makeMove = (x, y, player) => {

        if (board[y][x] !== null) {
            // Cell is already occupied, return 'invalid_move'
            return 'invalid_move';
        }
        
        board[y][x] = player;
        return isWinningMove(x, y);
    };

    const inBounds = (x, y) => {
        return y >= 0 && y < board.length && x >= 0 && x < board[y].length;
    };

    const numMatches = (x, y, dx, dy) => {
        let i = 1;
        while (inBounds(x + i * dx, y + i * dy) && board[y + i * dy][x + i * dx] === board[y][x]) {
            i++;
        };
        return i - 1;
    };

    const isWinningMove = (x, y) => {
        for (let dx = -1; dx <= 2; dx++) {
            for (let dy = -1; dy <= 2; dy++) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                if ((numMatches(x, y, dx, dy) + numMatches(x, y, -dx, -dy) + 1) >= 5) {
                    return true;
                }
            }
        }
        return false;
    };

    return { clearBoard, getBoard, makeMove };
};

module.exports = createBoard;