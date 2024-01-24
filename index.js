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

    const qSqlTotal1 = await conn.execute(
      `SELECT SUM(value) AS total
        FROM sms_transaction_summarize_dates
        WHERE summarize_code LIKE 'TRAFFIC_A2P%'
          AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
          AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
          AND date = ?`,
      [h1Day]
    )

    const qSqlTotal2 = await conn.execute(
      `SELECT SUM(value) AS total
        FROM sms_transaction_summarize_dates
        WHERE summarize_code LIKE 'TRAFFIC_A2P%'
          AND JSON_UNQUOTE(RESULT->'$.status') = 'DELIVERED'
          AND lower(JSON_UNQUOTE(RESULT->'$.aggr_name')) NOT IN ('telin')
          AND date = ?`,
      [h2Day]
    )

    // Get Top 5 Client h-1
    const qSql2 = await conn.execute(
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
      [h1Day]
    )

    // Get Top 5 Client H - 2
    const qSql3 = await conn.execute(
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
      [h2Day]
    )

    // Get Top 5 SenderID
    const qSql4 = await conn.execute(
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
      [h1Day]
    )

    const qSql5 = await conn.execute(
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
      [h2Day]
    )
  // Message for Total Delivered
    let messTotalDelivered = `Report (${h2Day} - ${h1Day}) \n`;
    messTotalDelivered += `-----------\n`;
    messTotalDelivered += `Total Delivered - ${h1Day} : ${qSqlTotal1[0][0].total} \n`;
    messTotalDelivered += `Total Delivered - ${h2Day} : ${qSqlTotal2[0][0].total} \n`;
    messTotalDelivered += `-----------\n`;

    // Set Message Top 5 Client
    let messTop5Client1 = `Top 5 Client - ${h1Day} \n`;
    qSql2[0].forEach(({ partner_name, total }) => {
      messTop5Client1 += ` • ${partner_name} : ${total}\n`;
    });

    let messTop5Client2 = `Top 5 Client - ${h2Day}\n`;
    qSql3[0].forEach(({ partner_name, total }) => {
      messTop5Client2 += ` • ${partner_name} : ${total}\n`;
    });

    // Set Message Top 5 SenderId
    let messTop5SenderId1 = `-----------\nTop 5 SENDER ID - ${h1Day}\n`;
    qSql4[0].forEach(({ addr_src_digit, total }) => {
      messTop5SenderId1 += ` • ${addr_src_digit} : ${total}\n`;
    });

    let messTop5SenderId2 = `Top 5 SENDER ID - ${h2Day}\n`;
    qSql5[0].forEach(({ addr_src_digit, total }) => {
      messTop5SenderId2 += ` • ${addr_src_digit} : ${total}\n`;
    });

    // Array of messages
    const messages = [
      messTotalDelivered,
      messTop5Client1,
      messTop5Client2,
      messTop5SenderId1,
      messTop5SenderId2,
    ];

    // Send messages using forEach
    messages.forEach((message) => {
      bot.sendMessage(chatId, message);
    });

    return;
  } catch (error) {
    console.log('Error nih : ', error);
    conn.rollback();
  } finally {
    conn.release();
  }
}

runBot()

process.once('SIGINT', () => {
  bot.stopPolling()
})
