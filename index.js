const TelegramBot = require('node-telegram-bot-api')
const mysql = require('mysql2/promise')
const moment = require('moment')

const token = '6890333729:AAEd2_s2HfhCY-MbOaJvcODJ-sqp9KBzFUg' // Replace with your own bot token
const bot = new TelegramBot(token, { polling: true })

// MySQL database configuration
const dbConfig = {
  host: '127.0.0.1',
  user: 'sts',
  password: 'StsMySQL1!',
  database: 'db_billing',
}
const connMysql = mysql.createPool(dbConfig)

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
        await sendReport(chatId)
        return
      }
    })
    return
  } catch (err) {
    console.error('Error nih : ', err)
  } finally {
  }
}

// ===== SEND REPORT =====
async function sendReport(chatId) {
  const conn = await connMysql.getConnection()

  await conn.beginTransaction()
  try {
    let mess = ``

    // Get the dates for h-2 and h-1
    const h1Day = moment().clone().subtract(1, 'days').format('YYYY-MM-DD')
    const h2Day = moment().clone().subtract(2, 'days').format('YYYY-MM-DD')

    // Get Total Delivered
    const qSql = await conn.execute(
      `SELECT SUM(value) AS total
        FROM sms_transaction_summarize_dates
        WHERE summarize_code LIKE 'TRAFFIC_A2P%'
          AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
          AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
          AND date BETWEEN ? AND ?`,
      [h2Day, h1Day]
    )

    // Get Top 5 Client
    const qSql2 = await conn.execute(
      `SELECT JSON_UNQUOTE(RESULT->'$.partner_name') AS partner_name,
              sum(value) AS total
        FROM sms_transaction_summarize_dates stsd
        WHERE summarize_code LIKE 'TRAFFIC_A2P%'
            AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
            AND JSON_UNQUOTE(RESULT->'$.partner_name') IS NOT NULL
            AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
            AND date BETWEEN ? AND ?
        GROUP BY JSON_UNQUOTE(RESULT->'$.partner_name')
        ORDER BY total DESC
        LIMIT 5`,
      [h2Day, h1Day]
    )

    // Get Top 5 SenderID
    const qSql3 = await conn.execute(
      `SELECT JSON_UNQUOTE(RESULT->'$.addr_src_digit') AS addr_src_digit,
              sum(value) AS total
        FROM sms_transaction_summarize_dates stsd
        WHERE JSON_UNQUOTE(RESULT->'$.aggr_name') IS NOT NULL
            AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
            AND JSON_UNQUOTE(RESULT->'$.addr_src_digit') IS NOT NULL
            AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
            AND date BETWEEN ? AND ?
        GROUP BY JSON_UNQUOTE(RESULT->'$.addr_src_digit')
        ORDER BY total DESC
        LIMIT 5`,
      [h2Day, h1Day]
    )

    mess += `Report (${h2Day} - ${h1Day}) \n`
    mess += `-----------\n`
    mess += `Total Delivered : ${qSql[0][0].total} \n`
    mess += `-----------\n`

    // Set Message Top 5 Client
    mess += `Top 5 Client\n`
    for await (const { partner_name, total } of qSql2[0]) {
      mess += ` • ${partner_name} : ${total}\n`
    }

    // Set Message Top 5 SenderId
    mess += `-----------\n`
    mess += `Top 5 SENDERID\n`

    for await (const { addr_src_digit, total } of qSql3[0]) {
      mess += ` • ${addr_src_digit} : ${total}\n`
    }

    bot.sendMessage(chatId, mess)
    return
  } catch (error) {
    console.log('Error nih : ', error)
    conn.rollback()
  } finally {
    conn.release()
  }
}

runBot()

process.once('SIGINT', () => {
  bot.stopPolling()
})
