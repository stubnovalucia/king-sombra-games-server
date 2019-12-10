var io;
var socket;
var gameRooms = [];
var games = {
    snake: {
        defaultScore: 0,
        minPlayers: 1,
        maxPlayers: 4
    },
    poker: {
        defaultScore: 1000,
        minPlayers: 1,
        maxPlayers: 10
    }
}
playerColors = ["#4DB6AC","#E57373","#64B5F6","#FFEE58","#BA68C8","#FFB74D","#4DB6AC","#F06292","#80DEEA","#AED581"]

exports.initializeSocket = function(initIo, initSocket){
    io = initIo;
    socket = initSocket;
    console.log('conn', socket.id)

    socket.emit('connected', { message: "You are connected!" });

    socket.on('timesync', function (data) {
        console.log('message', data);
        socket.emit('timesync', {
          id: data && 'id' in data ? data.id : null,
          result: Date.now()
        });
    });

    socket.on('disconnect', () => {
        socketDisconnected(initSocket.id)
    });

    //Public Screen
    socket.on('openRoom', newGameRoom);
    socket.on('roomState', updateRoomState);

    //Private Screen
    socket.on('joinRoom', joinGameRoom);
    socket.on('playerState', updatePlayerState);
    socket.on('startGame', startGame);
    socket.on('playerMove', playerMove)
}


//Public Screen
function newGameRoom(game) {
    var roomId = Math.floor(Math.random() * 1000000000) 
    gameRooms.push({
        socketId: socket.id,
        game: game,
        id: roomId,
        players: [],
        state: 'roomOpened'
    })
    console.log('new game room created')
    socket.emit('roomOpened', roomId);
}

function updateRoomState(room) {
    var gr = gameRooms.filter(gr => gr.id === room.id)[0]
    gr.state = room.state
    gr.players.map(p => p.socketId).forEach(socketId => {
        io.to(socketId).emit('roomState', room.state) 
    })

    if (room.state === 'gameEnded') {
        gr.players = gr.players.map(p => {
            return {...p, state: 'connected'} 
        })
        gr.players.map(p => p.socketId).forEach(socketId => {
            io.to(socketId).emit('playerState', 'connected') 
        })
    }

    if (room.state === 'gameStarted') {
        gr.players = gr.players.map(p => p.state == 'ready' ? {...p, state: 'playing'} : p)
        gr.players.filter(p => p.state == 'ready').map(p => p.socketId).forEach(socketId => {
            io.to(socketId).emit('playerState', 'playing') 
        })
    }
}

//Private Screen
function joinGameRoom (roomId) {
    console.log('joinRoom', roomId)

    var gameRoom = gameRooms.filter(gr => gr.id == roomId)
    if(gameRoom.length) {
        var newPlayer = {
            socketId: socket.id,
            id: gameRoom[0].players.length + 1,
            state: 'connected', 
            color: '#546E7A',
            score: games[gameRoom[0].game].defaultScore,
            position: -1
        }
        gameRoom[0].players = gameRoom[0].players.concat(newPlayer)

        if (readyPlayers(roomId).length === games[gameRoom[0].game].maxPlayers) {
            socket.emit('roomFull')
        }
        socket.emit('playerId', newPlayer.id)
        socket.emit('playerState', 'connected')
        socket.emit('roomState', gameRoom[0].state)
        console.log('socket',gameRoom[0].socketId)
        io.to(gameRoom[0].socketId).emit('players', gameRoom[0].players)
    } else {
        socket.emit('noSuchRoom')
    }
}

function readyPlayers(roomId) {
    var gameRoom = gameRooms.filter(gr => gr.id == roomId)[0] 
    return gameRoom.players.filter(p => p.state === 'ready')
}

function updatePlayerState(player) {
    var gr = gameRooms.filter(gr => gr.id == player.screenId)[0]
    var changedPlayer = gr.players.filter(p => p.id == player.id)[0]

    if (player.state == 'ready') {
        if (readyPlayers(gr.id).length < games[gr.game].maxPlayers) {
            var color = playerColors[getPlayerPosition(gr.id)]
            changedPlayer.position = getPlayerPosition(gr.id)
            changedPlayer.color = color
            changedPlayer.state = player.state
            io.to(changedPlayer.socketId).emit('playerState', changedPlayer.state)
            io.to(changedPlayer.socketId).emit('playerInfo', changedPlayer)

            if (readyPlayers(gr.id).length === games[gr.game].maxPlayers) {
                gr.players.filter(p => p.state === 'connected').map(p => p.socketId).forEach(socketId => {
                    io.to(socketId).emit('roomFull')
                })
            }
            // if(readyPlayers(gr.id).length === games[gr.game].minPlayers) {
            //     gr.state = 'roomReady'
            //     io.to(gr.socketId).emit('roomState', gr.state)
            //     gr.players.filter(p => p.state === 'ready').map(p => p.socketId).forEach(socketId => {
            //         io.to(socketId).emit('roomState', gr.state)
            //     })
            // }
        } else {
            socket.emit('roomFull')
        }
    } else {
        changedPlayer.state = player.state
    }

    io.to(gr.socketId).emit('players', gr.players)
    
}

function getPlayerPosition(roomId) {
    let found = false
    let pos = 0
    while (!found) {
        if (!readyPlayers(roomId).filter(p => p.position === pos).length) {
            return pos
        }
        pos++
    } 
}

function startGame(roomId) {
    console.log('Start game')
    var gr = gameRooms.filter(gr => gr.id == roomId)[0]
    io.to(gr.socketId).emit('startGame')
}

function socketDisconnected(socketId) {
    var gr = gameRooms.filter(gr => gr.socketId == socketId)
    var players = gameRooms.map(gr => gr.players)
    players = [].concat.apply([], players);
    var player = players.filter(p => p.socketId == socketId)
    if (gr.length) {
        console.log('room disconnection')
        gr[0].players.map(p => p.socketId).forEach(sid => {
            io.to(sid).emit('noSuchRoom') 
        })
    } else if (player.length) {
        console.log('player disconnection')
        var gameRoom = null
        gameRooms.forEach(gr => {
            if (gr.players.map(p => p.socketId).includes(socketId)) {
                gameRoom = gr
            } 
        })
        gameRoom.players = gameRoom.players.filter(p => p.id !== player[0].id)
        io.to(gameRoom.socketId).emit('players', gameRoom.players)
    }
}

function playerMove(data) {
    console.log('playermove', data)
    var gr = gameRooms.filter(gr => gr.id == data.screenId)[0]
    console.log("GR",gr)
    io.to(gr.socketId).emit('playerMove', data)
}
