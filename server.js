var express = require('express');
var gameRooms = require('./gameRooms');

var app = express();
var server = require('http').createServer(app);
server.listen(80, function() {
    console.log('Server listening on 8080.');
});
var io = require('socket.io').listen(server);

// app.get('/', function(req, res){
//     res.sendFile(__dirname + '/index.html');
// });

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.sockets.on('connection', function (socket) {
    gameRooms.initializeSocket(io, socket);
});
