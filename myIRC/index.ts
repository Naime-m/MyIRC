import express, { query, response } from 'express';
import http, { IncomingMessage, request } from 'http';
import bodyParser from 'body-parser';
import { db } from './db';
import expressSession, { SessionData } from 'express-session';
import { RowDataPacket } from 'mysql2';
import { Server, Socket } from 'socket.io';
import { Request, Response } from 'express';

declare module 'express-session' {
    interface SessionData {
        user?: { id: number, username: string };
    }
};

interface SessionIncomingMessage extends IncomingMessage {
    session: SessionData;
};

interface SessionSocket extends Socket {
    request: SessionIncomingMessage
};

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const session = expressSession({
    secret: 'verysecret',
    resave: false,
    saveUninitialized: true,
    cookie: {}
})

const wrapper = (middleware: any) => (socket: Socket, next: any) => middleware(socket.request, {}, next);
io.use(wrapper(session));

const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: true });
app.use(express.static('public'));
app.use(jsonParser);
app.use(urlencodedParser);
app.use(session);

app.get('/', (request: Request, response: Response) => {
    response.sendFile(__dirname + "/home.html");
});

app.get('/register', (request: Request, response: Response) => {
    response.sendFile(__dirname + "/register.html");
});

app.post('/register', (request: Request, response: Response) => {
    const username = request.body.username;
    const password = request.body.password;
    const query = `INSERT INTO \`users\` (username, password, role_id) VALUES ("${username}", "${password}", 1)`;
    db.query(query, (error, result) => {
        if (error) {
            console.log(error);
        } else {
            response.redirect('/login');


        }
    });
});

app.get('/login', (request: Request, response: Response) => {
    response.sendFile(__dirname + "/login.html");
});

app.post('/login', (request: Request, response: Response) => {
    const username = request.body.username;
    const password = request.body.password;
    if (username && password) {
        const query = `select * from users where username = ? AND password = ?`;
        db.query(query, [username, password], (error, result) => {
            if (error) {
                console.log(error);
                response.send("Error");

            } else {
                if (result.length > 0) {
                    console.log("user found");
                    const data = <RowDataPacket>result;
                    request.session.user = {
                        id: data[0].id,
                        username: data[0].username
                    }
                    response.redirect('/chat');
                }
                else {
                    response.send("Wrong user or password");

                };
            }

        });
    }
    else {
        console.log("username or password missing");
    }
})

app.get('/chat', (request, response) => {
    if (request.session.user) {
        response.sendFile(__dirname + "/chat.html");
    }
    else {
        response.redirect('/');
    }
});


io.on('connection', (defaultSocket: Socket) => {
    let currentRoom = "";
    const socket = <SessionSocket>defaultSocket;
    const userSession = socket.request.session.user;
    if (userSession) {
        socket.on('room join', (room) => {
            socket.join(room);
            currentRoom = room;

        });

        socket.emit('private room', socket.id);

        socket.on('chat message', (msg) => {
            if (currentRoom === "") {
                currentRoom = socket.id;
                io.to(currentRoom).emit('chat message', userSession.username + ": " + msg);
                socket.emit('current room', currentRoom);
            }
            else if (currentRoom !== socket.id) {
                io.to(currentRoom).emit('chat message', userSession.username + ": " + msg);
                socket.emit('current room', currentRoom);
            }
            else if (currentRoom === socket.id) {
                io.to(currentRoom).emit('chat message', userSession.username + ": " + msg);
                socket.emit('current room', currentRoom);
            }
        })
        socket.on('room create', (room) => {
            io.emit('room create', room);
            const query = `INSERT IGNORE INTO \`channels\` (name) VALUES ("${room}")`;

            db.query(query, (error, result) => {
                if (error) {
                    console.log(error);
                }
                else {
                    console.log(room);
                }
            });

        });
        socket.on('charge rooms', () => {
            const query = `SELECT * FROM channels`;
            db.query(query, (error, result) => {
                if (error) {
                    console.log(error);
                }
                else {
                    socket.emit('existing rooms', result);
                }
            });
        });


        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    }
});

httpServer.listen(8080);

