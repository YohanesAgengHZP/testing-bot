FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# RUN npm i -g nodemon && npm install
# If you are building your code for production
RUN npm ci --only=production

COPY ./index.js ./

# CMD [ "node", "--require", "./instrumentation.js" ,"app.js" ]
CMD [ "node", "index.js" ]
