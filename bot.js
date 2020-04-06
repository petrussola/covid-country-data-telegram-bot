// DEPENDENCIES
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const axios = require('axios');

// data
const { countries } = require('./data/countries');

// telegrapm api token
const token = process.env.TELEGRAM_TOKEN;
const baseApi = process.env.BASE_API;

let bot;

if (process.env.NODE_ENV === 'production') {
	bot = new TelegramBot(token);
	bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
	bot = new TelegramBot(token, { polling: true });
}

console.log(`Bot started in the ${process.env.NODE_ENV} mode`);

bot.on('message', async (msg) => {
	commands = ['/start', '/help'];
	const input = msg.text;
	// is user types /start or /help
	if (commands.includes(input)) {
		bot.sendMessage(
			msg.chat.id,
			'Welcome! Please type an ISO country code to get the latest COVID-19 official data i.e. Ireland => IE, France => FR, etc'
		);
	} else {
		const countryCode = msg.text;
		country = countries.filter((item) => {
			return item['ISO2'] === countryCode.toUpperCase();
		});
		// if message sent does not match a country, return error message
		if (country.length === 0) {
			bot.sendMessage(
				msg.chat.id,
				"The text you wrote doesn't seem to match an ISO country code. Please try another one."
			);
		} else {
			countryName = country[0]['Country'];
			try {
				// data from API
				confirmed = await axios.get(
					`${baseApi}${countryName}/status/confirmed`
				);
				confirmedData = confirmed.data;
				recovered = await axios.get(
					`${baseApi}${countryName}/status/recovered`
				);
				recoveredData = recovered.data;
				death = await axios.get(`${baseApi}${countryName}/status/deaths`);
				deathData = death.data;
				// last and before last available data index
				lastDateIndex = confirmedData.length - 1;
				beforeLastDateIndex = confirmedData.length - 2;
				// we get the latest date available
				lastYear = confirmedData[confirmedData.length - 1]['Date'].substring(
					0,
					4
				);
				lastMonth = confirmedData[confirmedData.length - 1]['Date'].substring(
					5,
					7
				);
				lastDay = confirmedData[confirmedData.length - 1]['Date'].substring(
					8,
					10
				);
				diffConfirmed =
					confirmedData[lastDateIndex]['Cases'] -
					confirmedData[beforeLastDateIndex]['Cases'];
				diffRecovered =
					recoveredData[lastDateIndex]['Cases'] -
					recoveredData[beforeLastDateIndex]['Cases'];
				diffDeaths =
					deathData[lastDateIndex]['Cases'] -
					deathData[beforeLastDateIndex]['Cases'];
				bot.sendMessage(
					msg.chat.id,
					`Last data available for <b>${countryName}</b> is for <b>${lastDay}-${lastMonth}-${lastYear}</b>.\n\nConfirmed: ${confirmedData[
						lastDateIndex
					]['Cases'].toLocaleString()} cases [${
						diffConfirmed > 0 ? '+' : '-'
					}${diffConfirmed.toLocaleString()} new].\nRecovered: ${recoveredData[
						lastDateIndex
					]['Cases'].toLocaleString()} cases [${
						diffRecovered > 0 ? '+' : '-'
					}${diffRecovered.toLocaleString()} new].\nDeaths: ${deathData[
						lastDateIndex
					]['Cases'].toLocaleString()} cases [${
						diffDeaths > 0 ? '+' : '-'
					}${diffDeaths.toLocaleString()} new].\n\nData source: Johns Hopkins University Center for Systems Science and Engineering.`,
					{ parse_mode: 'HTML' }
				);
			} catch (error) {
				bot.sendMessage(
					msg.chat.id,
					'We could not fetch the data requested. Please try again.'
				);
			}
		}
	}
});

module.exports = bot;
