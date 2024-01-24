'use strict';

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api')
const mysql = require('mysql2/promise')
const moment = require('moment')
const cron = require('node-cron');

const token = process.env.BOT_TOKEN // Replace with your own bot token
const bot = new TelegramBot(token, { polling: true })
const CHATID = process.env.CHAT_ID

// MySQL database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
}
const connMysql = mysql.createPool(dbConfig)

connMysql.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
  } else {
    console.log('Connected to MySQL!');
    // Release the connection back to the pool
    connection.release();
  }
});

// ===== SETUP BOT =====
async function runBot() {
  try {
    // Get message from input bot
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id
      const messageText = msg.text

      if (messageText === '/start') {
        bot.sendMessage(chatId, 'Hello TCEL!')
        return
      } else if (messageText === '/report') {
        await sendReport()
        return
      }
    })

    // bot.sendMessage(CHATID, 'Hello TCEL!')
    return
  } catch (err) {
    console.error('Error nih : ', err)
  } finally {
  }
}

async function cron_job() {
  cron.schedule('0 6 * * *', async () => { // Cron expression for every second
    try {
      await sendReport(CHATID);
    } catch (err) {
      console.error('Error nih : ', err);
    }
  });
}
// ===== SEND REPORT =====
async function sendReport() {
  const conn = await connMysql.getConnection()

  await conn.beginTransaction()
  try {
    let mess = ``

    // Get the dates for h-2 and h-1
    const dateReport = [moment().clone().subtract(2, 'days').format('YYYY-MM-DD'), moment().clone().subtract(1, 'days').format('YYYY-MM-DD')]

    for (const date of dateReport) {
      mess = ``
      // Get Total
      const qSqlTotal = await conn.execute(
        `SELECT SUM(value) AS total
          FROM sms_transaction_summarize_dates
          WHERE summarize_code LIKE 'TRAFFIC_A2P%'
            AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
            AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
            AND date = ?`,
        [date]
      )

      // Get Top 5 Client
      const qSqlTopClient = await conn.execute(
        `SELECT JSON_UNQUOTE(RESULT->'$.partner_name') AS partner_name,
                sum(value) AS total
          FROM sms_transaction_summarize_dates stsd
          WHERE summarize_code LIKE 'TRAFFIC_A2P%'
              AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
              AND JSON_UNQUOTE(RESULT->'$.partner_name') IS NOT NULL
              AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
              AND date = ?
          GROUP BY JSON_UNQUOTE(RESULT->'$.partner_name')
          ORDER BY total DESC
          LIMIT 5`,
        [date]
      )

      // Get Top 5 SenderID
      const qSqlTopSender = await conn.execute(
        `SELECT JSON_UNQUOTE(RESULT->'$.addr_src_digit') AS addr_src_digit,
          sum(value) AS total
    FROM sms_transaction_summarize_dates stsd
    WHERE JSON_UNQUOTE(RESULT->'$.aggr_name') IS NOT NULL
        AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
        AND JSON_UNQUOTE(RESULT->'$.addr_src_digit') IS NOT NULL
        AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
        AND date = ?
    GROUP BY JSON_UNQUOTE(RESULT->'$.addr_src_digit')
    ORDER BY total DESC
    LIMIT 5`,
        [date]
      )

      mess += `Report ${date}\n`
      mess += `---------------\n`
      mess += `Total Delivered : ${qSqlTotal[0][0].total} \n`
      mess += `---------------\n`

      mess += `Top 5 Client\n`
      qSqlTopClient[0].forEach(({ partner_name, total }) => {
        mess += ` • ${partner_name} : ${total}\n`
      })

      mess += `---------------\n`
      mess += `Top 5 SENDERID\n`
      qSqlTopSender[0].forEach(({ addr_src_digit, total }) => {
        mess += ` • ${addr_src_digit} : ${total}\n`
      })

      bot.sendMessage(CHATID, mess)
    }
    return
  } catch (error) {
    console.log('Error nih : ', error)
    conn.rollback()
  } finally {
    conn.release()
  }
}

runBot()
cron_job()

process.once('SIGINT', () => {
  bot.stopPolling()
})
