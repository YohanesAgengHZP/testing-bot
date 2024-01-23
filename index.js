const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');

const token = '6890333729:AAEd2_s2HfhCY-MbOaJvcODJ-sqp9KBzFUg'; // Replace with your own bot token
const bot = new TelegramBot(token, { polling: true });

// MySQL database configuration
const dbConfig = {
    host: '127.0.0.1',
    user: 'sts',
    password: 'StsMySQL1!',
    database: 'db_billing'
  };

  // Create a connection to the database
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
    } else {
      console.log('Connected to MySQL database');
    }
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
  
    if (messageText === '/start') {
      bot.sendMessage(chatId, 'Hello TCEL!');
    } else if (messageText === '/report') {
      // Get the dates for h-2 and h-1
      const today = new Date();
      const h1Date = new Date(today);
      const h2Date = new Date(today);
      
      h1Date.setDate(today.getDate() - 1); // h-1
      h2Date.setDate(today.getDate() - 2); // h-2
  
      const formatDate = (date) => date.toISOString().split('T')[0];
  
      const h1DateString = formatDate(h1Date);
      const h2DateString = formatDate(h2Date);
  
      // Fetch data from MySQL for h-2 and h-1
      const queryH2 = `
        SELECT value
        FROM sms_transaction_summarize_dates
        WHERE summarize_code = 'TOTAL_SMS_P2P'
          AND date = '${h2DateString}'
      `;
  
      const queryH1 = `
        SELECT value
        From sms_transaction_summarize_dates
        GROUP BY summarize_code
          AND date = '${h1DateString}'
      `;

      connection.query(queryH2, (errorH2, resultsH2, fieldsH2) => {
        if (errorH2) {
          console.error('Error fetching h-2 data from MySQL:', errorH2);
          bot.sendMessage(chatId, 'Error fetching h-2 data from MySQL');
          return;
        }
  
        connection.query(queryH1, (errorH1, resultsH1, fieldsH1) => {
          if (errorH1) {
            console.error('Error fetching h-1 data from MySQL:', errorH1);
            bot.sendMessage(chatId, 'Error fetching h-1 data from MySQL');
            return;
          }

                      
  
          // Compare values and generate the report
          const h2Value = resultsH2.length > 0 ? resultsH2[0].value : 'N/A';
          const h1Value = resultsH1.length > 0 ? resultsH1[0].value : 'N/A';
  
          const reportData = `
            Comparison Report:
            h-2 (${h2DateString}): ${h2Value}
            h-1 (${h1DateString}): ${h1Value}
          `;
  
          bot.sendMessage(chatId, reportData);
        });
      });
    }
  });
  
  // Handle errors
  connection.on('error', (err) => {
    console.error('MySQL connection error:', err);
  });
  
  // Close the MySQL connection when the bot is stopped
  process.once('SIGINT', () => {
    connection.end();
    bot.stopPolling();
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });