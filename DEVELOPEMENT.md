Python version: 3.9.13 (so no requirements need to be changed)
Node version: 20.20.2
requirements unchanged besides flask-cors, because 3.1.1 apparently doesnt exist :
Flask==2.0.2
flask-cors==3.0.1
numpy==1.21.1
scipy==1.7.1

In helpers.ts the part with url the process.env.VUE_APP_WEB_SOCKET_URL was added because if not the program tried
to access a KIT server. Also, the .env was added with the url for local: 
VUE_APP_WEB_SOCKET_URL=ws://localhost:3000/websocket/

To start the project one needs to start all three component like in the other read me and then to get to
the starting page got to: http://localhost:8080/setup-device?aHCWFRZvlU=aWlzbTRldmVy&AbXHPCkszw=Tester123&wlmtdoqtqe=E

