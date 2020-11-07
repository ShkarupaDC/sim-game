const socket = io(); let nodes;

let canvas = document.querySelector("canvas");
let context = canvas.getContext("2d");

listenSocketEvents();

function listenSocketEvents() {

    startNewGame();

    socket.on("choose level", (options) => {
        handleMenu(options);
    });

    socket.on("draw field", () => { 

        let nodesCount = parseInt(document.querySelector(
            "#nodes").value);

        if (nodesCount < 6) { nodesCount = 6; }

        hideOptions(); drawNodes(nodesCount);
        nodes = document.querySelectorAll(".node");

        nodes.forEach((node, nodeIdx) => {
            
            node.addEventListener("click", (event) => { 
                handleNodeClick(event, nodeIdx);
            })
        })
    });

    socket.on("is valid move", valid => {
        if (valid.isValid) {
            drawLine(valid.move, "red");
        }
        nodes[valid.move.end].classList.remove("active");
    })

    socket.on("bot move", (move) => {
        drawLine(move, "blue");
    })

    socket.on("game over", playerId => {
        alert(`Player ${playerId} wins!`);
    })

}

function startNewGame() {
    socket.emit("new game");
}

function handleNodeClick(event, nodeIdx) {
    event.preventDefault();

    let activeIdx = Array.from(nodes).findIndex(elem =>
        elem.classList.contains("active"));
    
    if (!~activeIdx || activeIdx == nodeIdx) {
        nodes[nodeIdx].classList.add("active");
    
    } else {      
        let move = {start : nodeIdx, end : activeIdx};
        socket.emit("player move", move);
    }
}

function handleMenu(options) {

    drawMenu(options);
    let levels = document.querySelectorAll(".option");

    levels.forEach((level) => {

        level.addEventListener("click", (event) => {
            event.preventDefault();

            let nodesCount = parseInt(document.querySelector(
                "#nodes").value);
            
            if (nodesCount < 6) { nodesCount = 6; }
            
            socket.emit("level", {nodesCount, "levelIdx" 
                : event.target.innerText});
        })
    });
}

function drawMenu(options) {
    
    document.querySelector(".menu").style.display = "";
    let menu = document.querySelector(".options");

    for (let i = 0; i < options.length; ++i) {
        let option = document.createElement("div");
        
        option.className = "option";
        option.innerText =  options[i];
        
        let color = "#" + ((1<<24)*Math.random()|0).toString(16);
        option.style.border = `2px solid ${color}`;

        option.onmouseover = (event) => {
            event.target.style.backgroundColor = color;
        };
        option.onmouseout = (event) => {
            event.target.style.backgroundColor = "";
        };

        menu.append(option);
    }
}

function drawNodes(nodesCount = 6, radius = 250) {
    
    let field = document.querySelector(".game");
    let deltaAngle = 2 * Math.PI / nodesCount;

    centerX = field.clientWidth / 2;
    centerY = field.clientHeight / 2;
    
    for (let i = 0; i < nodesCount; ++i) {
        let node = document.createElement("div");
        
        node.className = "node";
        node.style.width = node.style.height = "12px";

        node.style.top = `${-Math.sin(deltaAngle * i) * radius - 
            parseInt(node.style.width) / 2 + centerY}px`;
        node.style.left = `${Math.cos(deltaAngle * i) * radius -
            parseInt(node.style.height) / 2 + centerX}px`;

        field.append(node);
    }
}

function drawLine(move, color, lineWidth = 2) {
    
    let from = nodes[move.start],
        to = nodes[move.end];

    let nodeOffset = (from.clientWidth - lineWidth) / 2

    let fromX = nodeOffset + parseFloat(from.style.left);
    let fromY = nodeOffset + parseFloat(from.style.top);

    let toX = nodeOffset + parseFloat(to.style.left);
    let toY = nodeOffset + parseFloat(to.style.top);

    context.strokeStyle = color;
    context.lineWidth = lineWidth;

    context.beginPath();
    
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();

    context.closePath();
}

function hideOptions() {
    
    document.querySelectorAll(".option").forEach((option) => {
        option.remove();
    });
    document.querySelector(".menu").style.display = "None";
}

function hideNodes() {
    
    document.querySelectorAll(".node").forEach((node) => {
        node.remove();
    });
}

document.querySelector("img").onclick = (event) => {
    
    hideOptions(); hideNodes();
    context.clearRect(0, 0, canvas.width, canvas.height);
    startNewGame();
};