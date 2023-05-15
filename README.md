Website source code for the domain www.FBP.lol A dynamic web application built 
with Node.js and Express, served behind Nginx, using the templating engine 
EJS for server-side rendering, Socket.IO for real-time communication, and
 Pocketbase as the database. It also uses sessions to help manage state and 
transfer data between different requests. Nginx runs on a digital ocean droplet
 running Ubuntu 22. It is anything but polished, as its not intutive what to do 
and in its current version it's more or less a proof of concept until more features are added.
 It is nowhere near crash proof and none of the code has been minified or compressed for production.
 But despite this, this release does allow for multiple concurrent users to not only play connect 5 with other users,
 but to chat in a global room while remaining anonomyous if they choose to and chat with an opponent in a seprate game room,
 track their wins, and track points all verified in the pocketbase database.

 In the UI, the lotties and the custom icon were
 both created with online generators.
 
 Any nginx and systemctl configurations have been left out for now.
