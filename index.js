const express = require("express");
const socket = require("socket.io");

const app = express();
const PORT = 8080;

const server = app.listen(PORT, function() {
    console.log(`Listening http://localhost:${PORT}`)
})

app.get("/", function(request, response) {
    response.sendFile(__dirname + "/public/index.html");
})

app.use(express.static("public"));
const io = socket(server);

const player = 0, bot = 1;

const levels = new Map([ 
    ["HIGH", 14],
    ["MIDDLE", 10],
    ["LOW", 6]
])

io.on("connection", function(socket) {
    console.log("New connection!");

    socket.on("new game", () => {
        socket.emit("choose level", Array.from(levels.keys()));

        socket.on("level", (params) => {

            console.log(socket.eventNames());
            
            nodesCount = params.nodesCount;
            depth = levels[params.levelIdx];

            socket.emit("draw field");

            const game = new Game(nodesCount);
            const search = new AlphaBetaSearch(depth);

            socket.on("player move", (move) => {
                handlePlayerMove(socket, move, game, search);
            });
        });
    });

    socket.on("reload", () => {
        
        socket.off();
        console.log(socket.eventNames());
    })

    socket.on("disconnect", () => {
        console.log("Connection was lost!");
    })
})

function handlePlayerMove(socket, move, game, search) {
    
    let {start, end} = move;
    
    let isValid = game.isValidMove(start, end);
    socket.emit("is valid move", {isValid, move});

    if (isValid) {
        game.makeMove(player, start, end);

        if (game.isOver(player)) {
            socket.emit("game over", bot); return;
        }

        moves = game.getPlayersMoves(); let botmove = {};
        [botmove.start, botmove.end] = search.run(moves, player);

        game.makeMove(bot, botmove.start, botmove.end);
        socket.emit("bot move", botmove);
        
        if (game.isOver(bot)) {
            socket.emit("game over", player); return;
        }
    }
}

class Game {

    constructor(nodesCount) {
        
        this.nodesCount = nodesCount;
        this.moves = new Array();
        
        for (let i = 0; i < 2; ++i) {
            this.moves.push(zeros(nodesCount));
        }
    }

    static getAllowedMoves(moves) {
        let successors = new Array();
        
        for (let i = 0; i < moves.length; ++i) {
            for (let j = i + 1; j < moves.length; ++j) {        
                
                if (moves[i][j] == false) { 
                    successors.push([i, j]);
                }
            }
        }
        return successors;
    }

    makeMove(playerIdx, start, end) {

        this.moves[playerIdx][start][end] = 1;
        this.moves[playerIdx][end][start] = 1;
    }

    getPlayersMoves(playerIdx = -1) {
        return !~playerIdx ? this.moves : this.moves[playerIdx];
    }

    static isTerminalState(moves) {
        let cycleLength = 3;
        
        for (let i = 0; i < moves.length; ++i) {
            let visited = Array(this.nodesCount).fill(false);
            
            if (Game.dfs(moves, visited, cycleLength, i, i)) {
                return true;
            }
        }
        return false;
    }

    isOver(playerIdx) {
        return Game.isTerminalState(this.moves[playerIdx])
    }

    static dfs(moves, visited, length, current, start) {
        visited[current] = true;
        
        if (length == 1) {
            return Boolean(moves[current][start]);
        }
        
        for (let j = 0; j < moves.length; ++j) {
            if (!visited[j] && moves[current][j]) {
                if (Game.dfs(moves, visited, length - 1, j, start)) {
                    return true;
                }
            }
        }
    }
 
    static updateState(state, moves, move) {
        let [start, end] = move;

        moves[start][end] ^= 1; moves[end][start] ^= 1;
        state[start][end] ^= 1; state[end][start] ^= 1;
    }

    isValidMove(start, end) {
        
        for (let moves of this.moves) {
            if (moves[start][end]) {
                return false;
            }
        }
        return true;
    }
}

class AlphaBetaSearch { 

    constructor(depth) {
        this.maxDepth = depth;
    }

    run(moves, current) {
        
        this.move = null;
        this.state = getState(moves[0], moves[1]);
        this.moves = moves;

        this.maxValue(-Infinity, Infinity, current, 0);
        return this.move;
    }

    maxValue(alpha, beta, current, depth) {

        if (Game.isTerminalState(this.moves[
            current])) { return 1; }

        current = (current + 1) % 2; 
        let value = -Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.updateState(current, move);
            
            value = Math.max(value, this.minValue(
                alpha, beta, current, depth + 1));

            this.updateState(current, move);
            if (value >= beta) { return value; }
            
            if (value > alpha) {
                if (!depth) { this.move = move; }
                alpha = value;
            }
        }

        return value;
    }

    minValue(alpha, beta, current, depth) {

        if (Game.isTerminalState(this.moves[
            current])) { return -1; }

        current = (current + 1) % 2;
        let value = Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.updateState(current, move);
            
            value = Math.min(value, this.maxValue(
                alpha, beta, current, depth + 1));

            this.updateState(current, move);

            if (value <= alpha) { return value; }
            beta = Math.min(beta, value);
        }

        return value;
    }

    updateState(current, move) {
        return Game.updateState(this.state,
          this.moves[current], move);
    }
}

function zeros(length) {
    return new Array(length).fill(null).map(() =>
        Array(length).fill(0));
}

function getState(player, bot) {
    let state = zeros(player.length);
    
    for (let i = 0; i < player.length; ++i) {
        for (let j = i + 1; j < player[i].length; ++j) {
            
            state[i][j] = state[j][i] = (
                player[i][j] + bot[i][j]) % 2;
        }
    }

    return state;
}

function printMatrix(matrix) {
    for (let i = 0; i < matrix.length; ++i) {
        console.log(matrix[i]);
    }
}