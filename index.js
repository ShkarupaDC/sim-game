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

            nodesCount = params.nodesCount;
            depth = levels.get(params.levelIdx);

            socket.emit("draw field");

            const game = new Game(nodesCount);
            const search = new AlphaBetaSearch(depth);

            socket.on("player move", (move) => {
                handlePlayerMove(socket, move, game, search);
            });
        });
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
            this.moves.push(emptyAdjList(
                nodesCount));
        }
    }

    makeMove(playerIdx, start, end) {

        this.moves[playerIdx][start].push(end);
        this.moves[playerIdx][end].push(start);
    }

    getPlayersMoves(playerIdx = -1) {
        return !~playerIdx ? this.moves : this.moves[playerIdx];
    }

    isOver(playerIdx) {
        return Game.isTerminalState(this.moves[playerIdx])
    }
 
    isValidMove(start, end) {
        
        for (let moves of this.moves) {
            if (moves[start].includes(end)) {
                return false;
            }
        }
        return true;
    }

    static addMove(state, moves, move) {
        let [start, end] = move;

        moves[start].push(end);
        moves[end].push(start);

        Game.updateState(state, start, end);
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
        
        let nodesCount = moves[0].length;
        let state = zeros(nodesCount);
        
        for (let i = 0; i < nodesCount; ++i) {
            for (let playerMoves of moves) {
                for (let j of playerMoves[i]) {
                    state[i][j] = state[j][i] = 1;
                }
            }
        }
        return state;
    }

    static isTerminalState(moves) {
        let cycleLength = 3;
        
        for (let i = 0; i < moves.length; ++i) {
            let visited = Array(moves.length).fill(false);
            
            if (Game.dfs(moves, visited, cycleLength, i, i)) {
                return true;
            }
        }
        return false;
    }

    static dfs(moves, visited, length, current, begin) {
        visited[current] = true;
        
        if (length == 1) {
            return moves[current].includes(begin);
        }
        
        for (let node of moves[current]) {
            if (visited[node] == false) {
                
                if (Game.dfs(moves, visited, length - 1,
                     node, begin)) { return true; }
            }
        }
    }

    static updateState(state, start, end) {
        
        state[start][end] ^= 1; 
        state[end][start] ^= 1;
    }

    static removeLastMove(state, moves, move) {
        let [start, end] = move;
        
        moves[start].pop();
        moves[end].pop();

        Game.updateState(state, start, end);
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

        this.maxValue(-Infinity, Infinity, current, 0);
        return this.move;
    }

    maxValue(alpha, beta, current, depth) {

        if (Game.isTerminalState(this.moves[
            current])) { return 1; }

        if (depth == this.maxDepth) {
            return this.eval();
        } 

        current = (current + 1) % 2; 
        let value = -Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.addMove(current, move);
            
            value = Math.max(value, this.minValue(
                alpha, beta, current, depth + 1));

            this.removeLastMove(current, move);
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

        if (depth == this.maxDepth) {
            return this.eval();
        } 

        current = (current + 1) % 2;
        let value = Infinity;
        
        for (let move of Game.getAllowedMoves(this.state)) {
            this.addMove(current, move);
            
            value = Math.min(value, this.maxValue(
                alpha, beta, current, depth + 1));

            this.removeLastMove(current, move);

            if (value <= alpha) { return value; }
            beta = Math.min(beta, value);
        }

        return value;
    }

    eval() {
        let cycle = 3, counts = [0, 0];
        
        for (let i = 0; i < this.moves.length; ++i) {
            for (let j = 0; j < this.moves[i].length; ++j) {
            
                let visited = Array(this.moves[i].length).fill(false);
                this.dfs(this.moves[i], visited, cycle, j, j, counts[i]);
            }
        }
        let value = counts[0] - counts[1];
        
        return value > 0 ? 0.5 : -0.5;
    }

    dfs(moves, visited, length, current, begin, count) {
        visited[current] = true;
        
        if (length == 1) {
            if (!this.state[current][begin]) {
                 count++; 
            }
            return;
        }
        
        for (let node of moves[current]) {
            if (!visited[node]) {
                Game.dfs(moves, visited, length - 1, node, begin); 
            }
        }
    }

    addMove(current, move) {
        
        return Game.addMove(this.state,
          this.moves[current], move);
    }

    removeLastMove(current, move) {
        
        return Game.removeLastMove(this.state,
            this.moves[current], move);
    }
}

function zeros(length) {
    
    return new Array(length).fill(null).map(() =>
        new Array(length).fill(0));
}

function emptyAdjList(length) {
    
    return new Array(length).fill(null).map(() => []);
}

function printAdjList(moves) {
    for (let i = 0; i < moves.length; ++i) {
        console.log(moves[i]);
    }
}