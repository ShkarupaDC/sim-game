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

    let game, search, nodesCount, depth;

    socket.on("new game", () => {
        socket.emit("choose level", Array.from(levels.keys()));
    });

    socket.on("level", (params) => {

        nodesCount = params.nodesCount;
        depth = levels.get(params.levelIdx);

        socket.emit("draw field");

        game = new Game(nodesCount);
        search = new AlphaBetaSearch(depth);
    });

    socket.on("player move", (move) => {
        handlePlayerMove(socket, move, game, search);
    });

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

        if (game.isOver(player, Object.values(move))) {
            socket.emit("game over", bot); return;
        }

        moves = game.getPlayersMoves(); let botmove = {};
        [botmove.start, botmove.end] = search.run(moves, player);

        game.makeMove(bot, botmove.start, botmove.end);
        socket.emit("bot move", botmove);
        
        if (game.isOver(bot, Object.values(botmove))) {
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

    makeMove(playerIdx, start, end) {

        this.moves[playerIdx][start][end] = 1;
        this.moves[playerIdx][end][start] = 1;
    }

    getPlayersMoves(playerIdx = -1) {
        return !~playerIdx ? this.moves : this.moves[playerIdx];
    }

    isOver(playerIdx, move) {
        return Game.isTerminalState(this.moves[playerIdx], move);
    }
 
    isValidMove(start, end) {
        
        for (let moves of this.moves) {
            if (moves[start][end]) {
                return false;
            }
        }
        return true;
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

    static getState(moves) {
        let state = zeros(moves[0].length);

        for (let i = 0; i < moves[0].length; ++i) {
            for (let j = i + 1; j < moves[0].length; ++j) {
                state[i][j] = state[j][i] = 
                    (moves[0][i][j] + moves[1][i][j]) % 2;
            }
        }
        return state;
    }

    static isTerminalState(moves, move) {
        let [start, end] = move;

        for (let i = 0; i < moves.length; ++i) {
            if (moves[start][i] && moves[end][i]) {
                return true;
            }
        }
        return false; 
    }

    static updateState(moves, state, move) {
        let [start, end] = move;

        moves[start][end] ^= 1; moves[end][start] ^= 1;
        state[start][end] ^= 1; state[end][start] ^= 1;
    }
}

class AlphaBetaSearch { 

    constructor(depth) {
        this.maxDepth = depth;
    }

    run(moves, current) {
        
        this.move = null;
        this.state = Game.getState(moves);
        this.moves = moves;

        this.maxValue(-Infinity, Infinity, null, current, 0);
        return this.move;
    }

    maxValue(alpha, beta, prev, current, depth) {

        if (depth && Game.isTerminalState(this.moves[current],
            prev)) { return 1; }

        if (depth == this.maxDepth) {
            return this.heuristicFn();
        } 

        current = (current + 1) % 2; 
        let value = -Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.updateState(current, move);
            
            value = Math.max(value, this.minValue(
                alpha, beta, move, current, depth + 1));

            this.updateState(current, move);
            if (value >= beta) { return value; }
            
            if (value > alpha) {
                if (!depth) { this.move = move; }
                alpha = value;
            }
        }

        return value;
    }

    minValue(alpha, beta, prev, current, depth) {

        if (Game.isTerminalState(this.moves[current],
             prev)) { return -1; }

        if (depth == this.maxDepth) {
            return this.heuristicFn();
        } 

        current = (current + 1) % 2;
        let value = Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.updateState(current, move);
            
            value = Math.min(value, this.maxValue(
                alpha, beta, move, current, depth + 1));

            this.updateState(current, move);

            if (value <= alpha) { return value; }
            beta = Math.min(beta, value);
        }

        return value;
    }

    heuristicFn() {
        
        let counts = new Array(2).fill(0),
            nodesCount = this.moves[0].length;
        
        for (let i = 0; i < 2; ++i) {
            for (let j = 0; j < nodesCount; ++j) {
            
                let visited = new Array(nodesCount).fill(false);
                this.dfs(this.moves[i], visited, 3, j, j, counts[i]);
            }
        }
        
        let value = counts[0] - counts[1];
        return value > 0 ? 0.5 : -0.5;
    }

    dfs(moves, visited, length, current, begin, count) {
        visited[current] = true;
        
        if (length == 1) {
            if (!this.state[current][begin]) { count++; }
            return;
        }

        for (let i = 0; i < moves.length; ++i) {
            if (!visited[i] && moves[current][i]) {
                this.dfs(moves, visited, length - 1, i, begin); 
            }
        }
    }

    updateState(current, move) {
        
        return Game.updateState(this.moves[current],
             this.state, move);
    }
}

function zeros(length) {
    
    return new Array(length).fill(null).map(() =>
        new Array(length).fill(0));
}